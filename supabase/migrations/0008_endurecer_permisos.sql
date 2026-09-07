-- Sacar de la API pública todo lo que no tiene que estar ahí.
--
-- Las migraciones anteriores venían escribiendo, para cada función:
--
--     revoke all on function ... from public;
--     grant execute on function ... to authenticated;
--
-- y eso NO alcanza. Es la trampa de este archivo.
--
-- `revoke ... from public` saca el permiso del pseudo-rol PUBLIC, que es el que
-- Postgres otorga por defecto. Pero Supabase, además, deja configurado un
--
--     alter default privileges in schema public grant execute on functions to anon, authenticated;
--
-- así que cada función nueva nace con un grant EXPLÍCITO a `anon`. Ese grant es
-- otra entrada en la ACL y el revoke a PUBLIC ni lo roza. Resultado: funciones
-- pensadas "solo para usuarios logueados" quedaban publicadas en
-- /rest/v1/rpc/… para cualquiera con la anon key.
--
-- Comprobado que no era explotable, y vale la pena entender POR QUÉ: las tres
-- son `security invoker`, así que corrían como `anon` y el RLS las frenaba —
-- `guardar_cotizacion` moría con "new row violates row-level security policy" y
-- `duplicar_cotizacion` con "no existe o no es tuya". Si alguna hubiera sido
-- `security definer`, el mismo descuido era un agujero de verdad. La defensa que
-- funcionó fue el RLS, no el grant; este archivo repone la que faltaba.

-- ---------------------------------------------------------------------------
-- Solo para usuarios logueados
-- ---------------------------------------------------------------------------
revoke all on function public.guardar_cotizacion(text, text, text, jsonb, text, numeric, numeric, date, text, text, text, uuid) from anon;
revoke all on function public.duplicar_cotizacion(uuid) from anon;
revoke all on function public.totales_cotizacion(uuid, numeric, numeric) from anon;

-- ---------------------------------------------------------------------------
-- Funciones de trigger: no las llama nadie desde la API
-- ---------------------------------------------------------------------------
-- Postgres rechaza llamar una función `returns trigger` fuera de un trigger, así
-- que tampoco eran explotables; eran ruido en el Security Advisor, y con el ruido
-- se pierde la señal. Lo que hay que poder decir es que todo lo que quedó
-- expuesto está expuesto a propósito.
--
-- Revocar es seguro: el EXECUTE de una función de trigger se chequea al CREAR el
-- trigger, no cada vez que dispara.
revoke all on function public.crear_perfil_al_registrarse() from public, anon, authenticated;
revoke all on function public.proteger_slug() from public, anon, authenticated;
revoke all on function public.proteger_respuesta() from public, anon, authenticated;

-- `generar_slug()` NO se toca aunque también esté publicada: es el default de la
-- columna `slug`, y los defaults se evalúan con los permisos de quien inserta.
-- Revocarla rompería la creación de cotizaciones.

-- ---------------------------------------------------------------------------
-- Lo que queda alcanzable, y por qué
-- ---------------------------------------------------------------------------
--   anon + authenticated
--     cotizacion_publica    leer el presupuesto con el slug, sin cuenta
--     registrar_vista       dejar constancia de que se abrió, sin cuenta
--     responder_cotizacion  aceptar o rechazar, sin cuenta
--     generar_slug          default de columna, no devuelve nada de nadie
--
--   solo authenticated
--     guardar_cotizacion, duplicar_cotizacion, totales_cotizacion
--
-- Las tres primeras son SECURITY DEFINER a propósito y el Security Advisor las
-- va a marcar: son la puerta pública, y el linter no puede saber que la
-- exposición es deliberada.
