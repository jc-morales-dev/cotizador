-- Un presupuesto emitible de verdad: número, moneda, descuento, IVA, validez,
-- notas y condiciones.
--
-- Hasta acá el documento salía siempre en dólares (la moneda estaba fija en el
-- código), sin impuestos y sin número. Sirve para mostrar cómo funciona el link
-- público, no para mandárselo a un cliente.

-- ---------------------------------------------------------------------------
-- Columnas nuevas
-- ---------------------------------------------------------------------------
alter table public.cotizaciones
  add column numero integer,
  add column moneda text not null default 'UYU'
    check (moneda in ('UYU', 'USD', 'ARS', 'EUR')),
  -- Porcentajes, no importes: es como se piensan y como se escriben.
  add column descuento numeric(5,2) not null default 0
    check (descuento >= 0 and descuento <= 100),
  add column iva numeric(5,2) not null default 0
    check (iva >= 0 and iva <= 100),
  add column valido_hasta date,
  add column notas text check (notas is null or length(notas) <= 2000),
  add column condiciones text check (condiciones is null or length(condiciones) <= 2000);

-- Las cotizaciones que ya existían se mostraron siempre en dólares, porque la
-- moneda estaba fija en el código. Dejarlas en el default nuevo (UYU) les
-- cambiaría el precio a la vista sin que nadie lo haya pedido.
update public.cotizaciones set moneda = 'USD';

-- ---------------------------------------------------------------------------
-- Numeración correlativa por usuario
-- ---------------------------------------------------------------------------
-- Un cliente espera "Presupuesto #14", no un uuid. El correlativo es por usuario:
-- cada uno empieza en 1 y no ve saltos por lo que emitan los demás.
with numerados as (
  select id, row_number() over (partition by user_id order by created_at, id) as n
  from public.cotizaciones
)
update public.cotizaciones c
set numero = numerados.n
from numerados
where numerados.id = c.id;

alter table public.cotizaciones alter column numero set not null;

-- El índice es lo único que garantiza que no se repita. La asignación en
-- guardar_cotizacion es un max()+1 y tiene una carrera teórica: si dos altas del
-- mismo usuario entran a la vez, una falla con violación de unicidad y se
-- reintenta. Preferimos eso a un número repetido en dos documentos ya enviados.
alter table public.cotizaciones
  add constraint cotizaciones_numero_por_usuario unique (user_id, numero);

-- ---------------------------------------------------------------------------
-- El desglose, calculado en un solo lugar
-- ---------------------------------------------------------------------------
-- El total lo muestran tres pantallas (editor, lista y página pública) y lo
-- calculan dos motores distintos (JavaScript y Postgres). Que el desglose viva
-- en una sola función acá, y en una sola función allá (computeTotals en
-- src/lib/money.ts), es lo que evita que discrepen.
--
-- El orden importa y es el que espera cualquiera que lea un presupuesto:
--   subtotal (suma de líneas ya redondeadas) -> descuento sobre el subtotal ->
--   IVA sobre el neto ya descontado.
--
-- security invoker a propósito: llamada desde la vista corre como el usuario y
-- el RLS de items filtra lo suyo; llamada desde cotizacion_publica (definer)
-- corre como el dueño de la función, que es justo lo que necesita la lectura
-- pública.
create or replace function public.totales_cotizacion(
  p_cotizacion_id uuid,
  p_descuento numeric,
  p_iva numeric
)
returns table (
  subtotal numeric,
  descuento_monto numeric,
  neto numeric,
  iva_monto numeric,
  total numeric
)
language sql
security invoker
stable
set search_path = ''
as $$
  select
    s.subtotal,
    d.descuento_monto,
    n.neto,
    round(n.neto * p_iva / 100, 2) as iva_monto,
    n.neto + round(n.neto * p_iva / 100, 2) as total
  from (
    -- round por línea y no sobre la suma: es el importe que la persona ve escrito
    -- en cada renglón, y la columna tiene que sumar el total que está abajo.
    select coalesce(sum(round(i.cantidad * i.precio, 2)), 0)::numeric(14,2) as subtotal
    from public.items i
    where i.cotizacion_id = p_cotizacion_id
  ) s
  cross join lateral (select round(s.subtotal * p_descuento / 100, 2) as descuento_monto) d
  cross join lateral (select s.subtotal - d.descuento_monto as neto) n;
$$;

revoke all on function public.totales_cotizacion(uuid, numeric, numeric) from public;
grant execute on function public.totales_cotizacion(uuid, numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- Vista con el desglose
-- ---------------------------------------------------------------------------
-- Hay que tirarla y rehacerla: `create or replace view` solo permite AGREGAR
-- columnas al final, y las columnas nuevas de cotizaciones caen en el medio
-- porque la vista arrancaba con `c.*`.
--
-- Ya que va, las columnas quedan explícitas. Postgres expande el asterisco al
-- crear la vista, así que con `c.*` cada columna nueva de la tabla obliga igual
-- a rehacerla, pero sin que se note al leer el SQL.
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
  t.subtotal,
  t.descuento_monto,
  t.neto,
  t.iva_monto,
  t.total
from public.cotizaciones c
cross join lateral public.totales_cotizacion(c.id, c.descuento, c.iva) t;

-- ---------------------------------------------------------------------------
-- Lectura pública por slug
-- ---------------------------------------------------------------------------
-- Sigue sin devolver id ni user_id. Ahora manda el desglose ya calculado: la
-- página pública no recalcula el total, solo lo imprime.
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

-- ---------------------------------------------------------------------------
-- Guardado transaccional
-- ---------------------------------------------------------------------------
-- Cambia la firma, así que hay que TIRAR la anterior primero. `create or replace`
-- con parámetros distintos crea una SOBRECARGA en vez de reemplazar, y después
-- PostgREST no sabe cuál de las dos llamar.
drop function if exists public.guardar_cotizacion(text, text, text, jsonb, uuid);

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
    insert into public.cotizaciones (
      cliente, titulo, estado, moneda, descuento, iva, valido_hasta, notas, condiciones, numero
    )
    values (
      p_cliente, p_titulo, p_estado, p_moneda, p_descuento, p_iva,
      p_valido_hasta, p_notas, p_condiciones,
      -- El RLS del select ya lo acota a las cotizaciones de quien llama, así que
      -- el correlativo sale por usuario sin nombrar a auth.uid().
      coalesce((select max(numero) from public.cotizaciones), 0) + 1
    )
    returning id into v_id;
  else
    update public.cotizaciones
    set cliente = p_cliente,
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

revoke all on function public.guardar_cotizacion(text, text, text, jsonb, text, numeric, numeric, date, text, text, uuid) from public;
grant execute on function public.guardar_cotizacion(text, text, text, jsonb, text, numeric, numeric, date, text, text, uuid) to authenticated;
