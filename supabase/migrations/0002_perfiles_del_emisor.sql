-- Datos de quien emite el presupuesto.
-- Sin esto el cliente recibe un documento anónimo: sabe cuánto sale, pero no de quién viene.

create table public.perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) between 1 and 120),
  email_contacto text check (email_contacto is null or length(trim(email_contacto)) between 3 and 160),
  telefono text check (telefono is null or length(trim(telefono)) <= 40),
  actualizado_at timestamptz not null default now()
);

alter table public.perfiles enable row level security;

create policy "dueno perfil"
on public.perfiles for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- La lectura pública ahora incluye al emisor. Sigue sin exponer id ni user_id:
-- solo el nombre y el contacto que el dueño decidió publicar.
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
