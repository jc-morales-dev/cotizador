-- Dejar de retipear: clientes reutilizables y duplicar un presupuesto.
--
-- Emitir presupuestos es repetitivo por naturaleza. El mismo cliente vuelve, y
-- el presupuesto nuevo suele ser el anterior con dos líneas cambiadas. Hasta acá
-- había que escribir todo otra vez.

-- ---------------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------------
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) between 1 and 120),
  email text check (email is null or length(trim(email)) between 3 and 160),
  created_at timestamptz not null default now(),
  -- Dos fichas con el mismo nombre para el mismo usuario no son dos clientes,
  -- son un error de tipeo. Es también lo que hace posible el "buscar o crear"
  -- de guardar_cotizacion sin pantalla de alta.
  unique (user_id, nombre)
);

create index clientes_user_id_idx on public.clientes (user_id, nombre);

alter table public.clientes enable row level security;

create policy "dueno clientes"
on public.clientes for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- `cotizaciones.cliente` NO se va a ningún lado, y no es redundancia.
--
-- El texto es una foto del momento en que se emitió: si mañana corregís el nombre
-- en la ficha del cliente, un presupuesto que ya mandaste no puede cambiar. El
-- documento que la persona abrió tiene que decir siempre lo mismo. Es el mismo
-- criterio por el que el slug es inmutable.
--
-- `cliente_id` es la otra mitad: sirve para agrupar, autocompletar y reusar.
alter table public.cotizaciones
  add column cliente_id uuid references public.clientes(id) on delete set null;

-- Cada nombre distinto que ya se haya usado pasa a ser una ficha.
insert into public.clientes (user_id, nombre)
select distinct user_id, trim(cliente)
from public.cotizaciones
on conflict (user_id, nombre) do nothing;

update public.cotizaciones c
set cliente_id = cl.id
from public.clientes cl
where cl.user_id = c.user_id and cl.nombre = trim(c.cliente);

-- ---------------------------------------------------------------------------
-- El veredicto del cliente no se pisa desde el panel
-- ---------------------------------------------------------------------------
-- Mover una aprobada a "cobrada" es normal y tiene que seguir andando. Lo que no
-- puede pasar es que el panel contradiga lo que el cliente contestó: devolver a
-- borrador algo ya aceptado reabriría un link que la persona ya respondió, y dar
-- vuelta un rechazo a mano convierte la constancia en un adorno.
--
-- No es una defensa contra un atacante —es tu propia fila y tu propia sesión—,
-- es una defensa contra el clic equivocado.
create or replace function public.proteger_respuesta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Si respondido_at recién se está seteando, es responder_cotizacion haciendo su
  -- trabajo: old.respondido_at todavía es null y no hay nada que proteger.
  if old.respondido_at is null then
    return new;
  end if;

  if new.estado is not distinct from old.estado then
    return new;
  end if;

  if old.estado = 'rechazada' then
    raise exception 'El cliente rechazó este presupuesto: no se puede cambiar el estado a mano';
  end if;

  if new.estado not in ('aprobada', 'cobrada') then
    raise exception 'El cliente aprobó este presupuesto: solo puede pasar a aprobada o cobrada';
  end if;

  return new;
end;
$$;

create trigger cotizaciones_respuesta_inmutable
before update on public.cotizaciones
for each row execute function public.proteger_respuesta();

-- ---------------------------------------------------------------------------
-- Duplicar
-- ---------------------------------------------------------------------------
-- La acción más frecuente de todas y la que no existía. Copia cabecera e ítems;
-- estrena slug y número, vuelve a borrador y no arrastra la respuesta del cliente
-- anterior: es un presupuesto nuevo, no una copia del papel firmado.
--
-- security invoker: el RLS del dueño ya alcanza, tanto para leer el original como
-- para que la copia nazca a nombre de quien llama.
create or replace function public.duplicar_cotizacion(p_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nuevo uuid;
begin
  insert into public.cotizaciones (
    cliente, cliente_id, titulo, estado, moneda, descuento, iva,
    valido_hasta, notas, condiciones, numero
  )
  select
    c.cliente,
    c.cliente_id,
    left(c.titulo || ' (copia)', 160),
    'borrador',
    c.moneda,
    c.descuento,
    c.iva,
    c.valido_hasta,
    c.notas,
    c.condiciones,
    coalesce((select max(numero) from public.cotizaciones), 0) + 1
  from public.cotizaciones c
  where c.id = p_id
  returning id into v_nuevo;

  -- Si el RLS filtró la fila, no hubo insert: no es tuya o no existe.
  if v_nuevo is null then
    raise exception 'La cotizacion no existe o no es tuya';
  end if;

  insert into public.items (cotizacion_id, descripcion, cantidad, precio, posicion)
  select v_nuevo, i.descripcion, i.cantidad, i.precio, i.posicion
  from public.items i
  where i.cotizacion_id = p_id;

  return v_nuevo;
end;
$$;

revoke all on function public.duplicar_cotizacion(uuid) from public;
grant execute on function public.duplicar_cotizacion(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Guardar: el cliente se busca o se crea solo
-- ---------------------------------------------------------------------------
-- Cambia la firma otra vez, así que va el drop de la anterior. `create or replace`
-- con parámetros distintos crea una SOBRECARGA y PostgREST no sabe cuál llamar.
drop function if exists public.guardar_cotizacion(text, text, text, jsonb, text, numeric, numeric, date, text, text, uuid);

create or replace function public.guardar_cotizacion(
  p_cliente text,
  p_titulo text,
  p_estado text,
  p_items jsonb,
  p_moneda text,
  p_descuento numeric,
  p_iva numeric,
  p_valido_hasta date,
  p_notas text,
  p_condiciones text,
  p_cliente_email text default null,
  p_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_cliente text := trim(p_cliente);
  v_email text := nullif(trim(coalesce(p_cliente_email, '')), '');
  v_cliente_id uuid;
begin
  -- Buscar o crear, sin pantalla de alta. El select ya viene acotado por RLS a
  -- los clientes de quien llama, así que no hace falta nombrar a auth.uid().
  select id into v_cliente_id from public.clientes where nombre = v_cliente;

  if v_cliente_id is null then
    insert into public.clientes (nombre, email)
    values (v_cliente, v_email)
    returning id into v_cliente_id;
  elsif v_email is not null then
    -- Escribir un email nuevo actualiza la ficha; dejarlo vacío no borra el que había.
    update public.clientes set email = v_email where id = v_cliente_id;
  end if;

  if p_id is null then
    insert into public.cotizaciones (
      cliente, cliente_id, titulo, estado, moneda, descuento, iva,
      valido_hasta, notas, condiciones, numero
    )
    values (
      v_cliente, v_cliente_id, p_titulo, p_estado, p_moneda, p_descuento, p_iva,
      p_valido_hasta, p_notas, p_condiciones,
      coalesce((select max(numero) from public.cotizaciones), 0) + 1
    )
    returning id into v_id;
  else
    update public.cotizaciones
    set cliente = v_cliente,
        cliente_id = v_cliente_id,
        titulo = p_titulo,
        estado = p_estado,
        moneda = p_moneda,
        descuento = p_descuento,
        iva = p_iva,
        valido_hasta = p_valido_hasta,
        notas = p_notas,
        condiciones = p_condiciones
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'La cotizacion no existe o no es tuya';
    end if;

    delete from public.items where cotizacion_id = v_id;
  end if;

  insert into public.items (cotizacion_id, descripcion, cantidad, precio, posicion)
  select
    v_id,
    linea->>'descripcion',
    (linea->>'cantidad')::numeric,
    (linea->>'precio')::numeric,
    (orden - 1)::integer
  from jsonb_array_elements(p_items) with ordinality as t(linea, orden);

  return v_id;
end;
$$;

revoke all on function public.guardar_cotizacion(text, text, text, jsonb, text, numeric, numeric, date, text, text, text, uuid) from public;
grant execute on function public.guardar_cotizacion(text, text, text, jsonb, text, numeric, numeric, date, text, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- La vista suma el email del cliente
-- ---------------------------------------------------------------------------
-- El nombre sale de `cotizaciones.cliente` (la foto congelada) y el email de la
-- ficha (el dato actual): el editor tiene que proponer el email de hoy, no el de
-- cuando se emitió.
drop view if exists public.cotizaciones_con_total;

create view public.cotizaciones_con_total
with (security_invoker = true) as
select
  c.id,
  c.user_id,
  c.cliente,
  c.cliente_id,
  cl.email as cliente_email,
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
left join public.clientes cl on cl.id = c.cliente_id
cross join lateral public.totales_cotizacion(c.id, c.descuento, c.iva) t
cross join lateral (
  select max(vi.vista_at) as ultima_vista, count(*)::integer as veces_vista
  from public.vistas vi
  where vi.cotizacion_id = c.id
) v;
