-- El registro pide nombre y apellido, así que el perfil se crea solo.
-- Sin esto, cada usuario nuevo tendría que pasar por "Tus datos" antes de que su
-- primer presupuesto dejara de salir sin firmar.

create or replace function public.crear_perfil_al_registrarse()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text;
begin
  v_nombre := nullif(
    trim(concat_ws(' ',
      new.raw_user_meta_data->>'nombre',
      new.raw_user_meta_data->>'apellido'
    )),
    ''
  );

  -- Sin nombre en el registro (por ejemplo, un alta desde el panel de Supabase)
  -- usamos la parte local del email para no dejar el perfil vacío.
  insert into public.perfiles (user_id, nombre, email_contacto)
  values (
    new.id,
    coalesce(v_nombre, split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger crear_perfil_al_registrarse
after insert on auth.users
for each row execute function public.crear_perfil_al_registrarse();
