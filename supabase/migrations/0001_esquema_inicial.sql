-- Coti — esquema completo.
-- Pegalo entero en el SQL editor de Supabase para levantar el proyecto de cero.

-- ---------------------------------------------------------------------------
-- Slug del link público
-- ---------------------------------------------------------------------------
-- El slug ES la credencial del link: quien lo tiene, ve el presupuesto.
-- 9 bytes aleatorios en base64url = 12 caracteres y 72 bits de entropía,
-- así que no se puede enumerar a fuerza bruta.
create or replace function public.generar_slug()
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_')
$$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente text not null check (length(trim(cliente)) between 1 and 120),
  titulo text not null check (length(trim(titulo)) between 1 and 160),
  estado text not null default 'borrador' check (estado in ('borrador', 'enviada', 'aprobada', 'cobrada')),
  slug text unique not null default public.generar_slug(),
  created_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones(id) on delete cascade,
  descripcion text not null check (length(trim(descripcion)) between 1 and 300),
  cantidad numeric(12,2) not null default 1 check (cantidad >= 0),
  precio numeric(12,2) not null default 0 check (precio >= 0),
  -- El orden de las líneas de un presupuesto importa; sin esto el select las
  -- devuelve en orden arbitrario.
  posicion integer not null default 0
);

create index cotizaciones_user_id_idx on public.cotizaciones (user_id, created_at desc);
create index items_cotizacion_id_idx on public.items (cotizacion_id, posicion);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.cotizaciones enable row level security;
alter table public.items enable row level security;

-- Solo el dueño logueado toca sus filas.
-- `anon` no recibe NINGUNA política: no lee estas tablas directamente jamás.
create policy "dueno cotizaciones"
on public.cotizaciones for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "dueno items"
on public.items for all to authenticated
using (exists (select 1 from public.cotizaciones c where c.id = items.cotizacion_id and c.user_id = auth.uid()))
with check (exists (select 1 from public.cotizaciones c where c.id = items.cotizacion_id and c.user_id = auth.uid()));

-- Un link ya enviado a un cliente no puede cambiar porque se edite la cotización.
create or replace function public.proteger_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug then
    raise exception 'El slug de una cotizacion no se puede cambiar';
  end if;
  return new;
end;
$$;

create trigger cotizaciones_slug_inmutable
before update on public.cotizaciones
for each row execute function public.proteger_slug();

-- ---------------------------------------------------------------------------
-- Vista con el total
-- ---------------------------------------------------------------------------
-- security_invoker hace que la vista respete el RLS de quien consulta. Sin esa
-- opción correría con permisos del creador y filtraría las cotizaciones de todos.
create view public.cotizaciones_con_total
with (security_invoker = true) as
select
  c.*,
  coalesce((select sum(i.cantidad * i.precio) from public.items i where i.cotizacion_id = c.id), 0)::numeric(14,2) as total
from public.cotizaciones c;

-- ---------------------------------------------------------------------------
-- Lectura pública por slug
-- ---------------------------------------------------------------------------
-- Única puerta de entrada del visitante sin cuenta.
--
-- Por qué no basta una política RLS del tipo `using (estado <> 'borrador')`:
-- las políticas permissive se combinan con OR, así que esa política dejaría a
-- cualquiera con la anon key hacer `select * from cotizaciones` y listar los
-- clientes de TODOS los usuarios. RLS filtra filas, no puede exigir que quien
-- consulta conozca el slug. Además `items` no tendría política para anon, así
-- que la página pública se vería sin líneas y con total 0.
--
-- No devolvemos id ni user_id: el cliente no necesita identificadores internos.
create or replace function public.cotizacion_publica(p_slug text)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'cliente', c.cliente,
    'titulo', c.titulo,
    'estado', c.estado,
    'slug', c.slug,
    'created_at', c.created_at,
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
    'total', coalesce((
      select sum(i.cantidad * i.precio)
      from public.items i
      where i.cotizacion_id = c.id
    ), 0)
  )
  from public.cotizaciones c
  where c.slug = p_slug
    and c.estado <> 'borrador';
$$;

revoke all on function public.cotizacion_publica(text) from public;
grant execute on function public.cotizacion_publica(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Guardado transaccional
-- ---------------------------------------------------------------------------
-- Guardar es "reemplazar los ítems", y hacerlo en dos llamadas sueltas desde el
-- navegador deja la cotización sin líneas si la red se corta entre el delete y
-- el insert. Acá todo ocurre en una transacción.
-- security invoker: el RLS del dueño sigue aplicando.
create or replace function public.guardar_cotizacion(
  p_cliente text,
  p_titulo text,
  p_estado text,
  p_items jsonb,
  p_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_id is null then
    insert into public.cotizaciones (cliente, titulo, estado)
    values (p_cliente, p_titulo, p_estado)
    returning id into v_id;
  else
    update public.cotizaciones
    set cliente = p_cliente, titulo = p_titulo, estado = p_estado
    where id = p_id
    returning id into v_id;

    -- Si el RLS filtró la fila, v_id queda null: no es tuya o no existe.
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

revoke all on function public.guardar_cotizacion(text, text, text, jsonb, uuid) from public;
grant execute on function public.guardar_cotizacion(text, text, text, jsonb, uuid) to authenticated;
