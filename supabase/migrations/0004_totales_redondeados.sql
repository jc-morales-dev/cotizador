-- Los totales de Postgres y los del navegador no daban lo mismo.
--
-- El navegador redondea CADA LÍNEA al centavo (`lineTotalCents` en src/lib/money.ts)
-- y después suma. Postgres sumaba los productos sin redondear. Con cantidad 1,5 y
-- precio 33,33 la línea muestra 50,00 (round(49,995)) y el total decía 49,99: la
-- columna de importes no sumaba el total que estaba abajo, en un documento que el
-- cliente lee para decidir si paga.
--
-- La fuente de verdad es el redondeo por línea, porque es el número que la persona
-- ve escrito. Postgres lo imita con round(..., 2) dentro del sum.

-- ---------------------------------------------------------------------------
-- Vista con el total
-- ---------------------------------------------------------------------------
-- Mismas columnas, mismos tipos y mismo orden que la versión anterior, así que
-- `create or replace` alcanza y no hay que tirar la vista abajo.
create or replace view public.cotizaciones_con_total
with (security_invoker = true) as
select
  c.*,
  coalesce((
    select sum(round(i.cantidad * i.precio, 2))
    from public.items i
    where i.cotizacion_id = c.id
  ), 0)::numeric(14,2) as total
from public.cotizaciones c;

-- ---------------------------------------------------------------------------
-- Lectura pública por slug
-- ---------------------------------------------------------------------------
-- Idéntica a 0002 salvo el round del total. Se repite entera porque
-- `create or replace function` reemplaza el cuerpo completo.
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
    'total', coalesce((
      select sum(round(i.cantidad * i.precio, 2))
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
