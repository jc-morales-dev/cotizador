-- El cliente puede responder, y vos te enterás de que lo abrió.
--
-- Hasta acá el link público era de solo lectura: el cliente miraba el presupuesto
-- y te tenía que escribir por otro lado para decirte que sí. Vos, además, no
-- sabías si lo había abierto siquiera.
--
-- Esto es la contracara exacta de la lectura pública: una ESCRITURA sin sesión
-- que tampoco abre RLS ni un milímetro. `anon` sigue sin políticas sobre las
-- tablas; entra por funciones `security definer` que reciben el slug y hacen una
-- sola cosa cada una.

-- ---------------------------------------------------------------------------
-- Estado nuevo: rechazada
-- ---------------------------------------------------------------------------
-- Un check no se modifica en el lugar: hay que tirarlo y volver a crearlo.
alter table public.cotizaciones drop constraint cotizaciones_estado_check;

alter table public.cotizaciones
  add constraint cotizaciones_estado_check
  check (estado in ('borrador', 'enviada', 'aprobada', 'rechazada', 'cobrada'));

alter table public.cotizaciones
  add column respondido_at timestamptz,
  add column respondido_por text check (respondido_por is null or length(trim(respondido_por)) between 1 and 120),
  add column comentario_cliente text check (comentario_cliente is null or length(comentario_cliente) <= 1000);

-- ---------------------------------------------------------------------------
-- Vistas del link
-- ---------------------------------------------------------------------------
-- A propósito NO guarda IP ni user agent. Para responder "¿lo abrió?" alcanza con
-- la fecha, y todo lo demás son datos personales de un tercero que nunca aceptó
-- nada: el cliente no tiene cuenta acá y no firmó ninguna política.
create table public.vistas (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones(id) on delete cascade,
  vista_at timestamptz not null default now()
);

create index vistas_cotizacion_id_idx on public.vistas (cotizacion_id, vista_at desc);

alter table public.vistas enable row level security;

-- Solo lectura, y solo de las cotizaciones propias. Escribir es exclusivo de
-- registrar_vista: nadie inserta una visita a mano.
create policy "dueno vistas"
on public.vistas for select to authenticated
using (
  exists (
    select 1 from public.cotizaciones c
    where c.id = vistas.cotizacion_id and c.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- Registrar que alguien abrió el link
-- ---------------------------------------------------------------------------
create or replace function public.registrar_vista(p_slug text)
returns void
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_id uuid;
  v_dueno uuid;
begin
  select c.id, c.user_id into v_id, v_dueno
  from public.cotizaciones c
  where c.slug = p_slug
    and c.estado <> 'borrador';

  -- Slug inexistente o borrador: no pasa nada, y sin distinguir un caso del otro.
  if v_id is null then
    return;
  end if;

  -- Que el dueño abra su propio link para revisarlo no es "el cliente lo vio".
  -- Sin esto, "Visto hace 2 minutos" mentiría cada vez que revisás cómo quedó.
  if v_dueno = auth.uid() then
    return;
  end if;

  -- Recargar la página cinco veces seguidas es una visita, no cinco.
  if exists (
    select 1 from public.vistas v
    where v.cotizacion_id = v_id
      and v.vista_at > now() - interval '30 minutes'
  ) then
    return;
  end if;

  insert into public.vistas (cotizacion_id) values (v_id);
end;
$$;

revoke all on function public.registrar_vista(text) from public;
grant execute on function public.registrar_vista(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Aceptar o rechazar, sin cuenta
-- ---------------------------------------------------------------------------
-- Lo que hace segura a esta función es una sola línea: `and estado = 'enviada'`.
--
-- De ahí sale todo lo demás. Un borrador no se puede responder porque para el
-- mundo exterior no existe. Una ya respondida no se puede volver a tocar, así
-- que quien tenga el link no puede darle vuelta al resultado ni llenarte la
-- tabla a fuerza de reintentos: la primera respuesta gana y las demás son
-- no-ops. La operación queda idempotente sin necesidad de autenticar a nadie.
--
-- El modelo de confianza es el mismo que el de la lectura: el slug ES la
-- credencial. Quien tiene el link puede leer el presupuesto y puede responderlo,
-- igual que quien recibe un presupuesto en papel puede firmarlo.
--
-- Devuelve el estado nuevo, o null si no aplicaba. La página muestra el mismo
-- mensaje en los dos casos: desde fuera no se deduce por qué falló.
create or replace function public.responder_cotizacion(
  p_slug text,
  p_respuesta text,
  p_nombre text,
  p_comentario text default null
)
returns text
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_estado text;
begin
  if p_respuesta is null or p_respuesta not in ('aprobada', 'rechazada') then
    return null;
  end if;

  -- El nombre no se valida por formalidad: es lo único que queda como constancia
  -- de quién aceptó, así que un presupuesto no se aprueba en el anonimato.
  if p_nombre is null or length(trim(p_nombre)) = 0 then
    return null;
  end if;

  update public.cotizaciones
  set estado = p_respuesta,
      respondido_at = now(),
      -- Recortado acá y no rechazado: el visitante no tiene por qué pelearse con
      -- un límite de caracteres del que nadie le avisó.
      respondido_por = left(trim(p_nombre), 120),
      comentario_cliente = nullif(left(trim(coalesce(p_comentario, '')), 1000), '')
  where slug = p_slug
    and estado = 'enviada'
  returning estado into v_estado;

  return v_estado;
end;
$$;

revoke all on function public.responder_cotizacion(text, text, text, text) from public;
grant execute on function public.responder_cotizacion(text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- La vista suma la respuesta y las visitas
-- ---------------------------------------------------------------------------
-- Es la información por la que uno abre el panel: si lo vieron y qué dijeron.
drop view if exists public.cotizaciones_con_total;

create view public.cotizaciones_con_total
with (security_invoker = true) as
select
  c.id,
  c.user_id,
  c.cliente,
  c.titulo,
  c.estado,
  c.slug,
  c.created_at,
  c.numero,
  c.moneda,
  c.descuento,
  c.iva,
  c.valido_hasta,
  c.notas,
  c.condiciones,
  c.respondido_at,
  c.respondido_por,
  c.comentario_cliente,
  v.ultima_vista,
  v.veces_vista,
  t.subtotal,
  t.descuento_monto,
  t.neto,
  t.iva_monto,
  t.total
from public.cotizaciones c
cross join lateral public.totales_cotizacion(c.id, c.descuento, c.iva) t
cross join lateral (
  select max(vi.vista_at) as ultima_vista, count(*)::integer as veces_vista
  from public.vistas vi
  where vi.cotizacion_id = c.id
) v;

-- ---------------------------------------------------------------------------
-- La página pública muestra el sello de la respuesta
-- ---------------------------------------------------------------------------
-- `comentario_cliente` vuelve a salir a la página pública a propósito: lo escribió
-- el propio cliente y verlo confirmado es parte de la constancia.
create or replace function public.cotizacion_publica(p_slug text)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'numero', c.numero,
    'cliente', c.cliente,
    'titulo', c.titulo,
    'estado', c.estado,
    'slug', c.slug,
    'created_at', c.created_at,
    'moneda', c.moneda,
    'descuento', c.descuento,
    'iva', c.iva,
    'valido_hasta', c.valido_hasta,
    'notas', c.notas,
    'condiciones', c.condiciones,
    'respondido_at', c.respondido_at,
    'respondido_por', c.respondido_por,
    'comentario_cliente', c.comentario_cliente,
    'emisor', (
      select jsonb_build_object(
               'nombre', p.nombre,
               'email_contacto', p.email_contacto,
               'telefono', p.telefono
             )
      from public.perfiles p
      where p.user_id = c.user_id
    ),
    'items', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'descripcion', i.descripcion,
                 'cantidad', i.cantidad,
                 'precio', i.precio
               )
               order by i.posicion, i.id
             )
      from public.items i
      where i.cotizacion_id = c.id
    ), '[]'::jsonb),
    'subtotal', t.subtotal,
    'descuento_monto', t.descuento_monto,
    'neto', t.neto,
    'iva_monto', t.iva_monto,
    'total', t.total
  )
  from public.cotizaciones c
  cross join lateral public.totales_cotizacion(c.id, c.descuento, c.iva) t
  where c.slug = p_slug
    and c.estado <> 'borrador';
$$;

revoke all on function public.cotizacion_publica(text) from public;
grant execute on function public.cotizacion_publica(text) to anon, authenticated;
