# Coti

Cotizaciones con ítems, total y link público para el cliente.

Armás un presupuesto, le ponés los ítems con cantidad y precio, y compartís un link
tipo `/c/QiLn0LfQBdxX` que tu cliente abre desde el celular sin crear ninguna cuenta.

**[Ver demo](https://cotizador-opal-five.vercel.app)** · Entrá con el botón **“Entrar como demo”**, sin registrarte.

Ejemplo de link público, tal como lo recibe un cliente:
**[cotizador-opal-five.vercel.app/c/Gh4zJFsjA4O2](https://cotizador-opal-five.vercel.app/c/Gh4zJFsjA4O2)**

## Stack

React 19, TypeScript, Vite 7, Tailwind v4, React Router 7 y Supabase (Postgres + Auth).

## Correr

```bash
npm i
cp .env.example .env.local   # completá URL y anon key de tu proyecto Supabase
npm run dev
```

Para levantar la base de datos, pegá `supabase/migrations/0001_esquema_inicial.sql`
entero en el SQL editor de Supabase.

## Cómo está resuelto el acceso público

Es la parte interesante del proyecto, así que vale la pena explicarla.

La página `/c/:slug` la abre alguien **sin cuenta**, y aun así no puede ver nada que no
sea el presupuesto exacto cuyo link recibió.

El camino obvio sería una política RLS del estilo `using (estado <> 'borrador')`.
No sirve, por dos motivos:

1. Las políticas permissive se combinan con **OR**. Esa política dejaría que cualquiera
   con la anon key hiciera `select * from cotizaciones` y listara los clientes y los
   títulos de **todos** los usuarios. RLS filtra filas; no puede exigir que quien
   consulta conozca el slug.
2. `items` no tendría política para visitantes anónimos, así que la página pública se
   vería sin líneas y con el total en cero.

La solución es que `anon` **no tenga ninguna política** sobre las tablas — no las lee
nunca — y entre por una única función `security definer` que recibe el slug y devuelve
la cotización con sus ítems ya armada:

```sql
create function public.cotizacion_publica(p_slug text)
returns jsonb
security definer
set search_path = ''
...
where c.slug = p_slug and c.estado <> 'borrador';
```

Detalles que van con eso:

- **El slug es la credencial**, así que son 12 caracteres base64url (72 bits): no se
  enumera a fuerza bruta.
- Un slug **inexistente** y una cotización en **borrador** devuelven exactamente el
  mismo mensaje, para no confirmar desde fuera qué presupuestos existen.
- La función **no devuelve `id` ni `user_id`**: el cliente no necesita identificadores
  internos.
- Un trigger hace el **slug inmutable**: un link ya enviado no cambia porque edites la
  cotización.
- La vista `cotizaciones_con_total` usa `security_invoker = true`; sin esa opción
  correría con permisos del creador y filtraría las cotizaciones de todos.

Sobre la anon key que va en el bundle: es pública por diseño y no es una filtración.
Lo que protege los datos es el RLS y la ausencia de políticas para `anon`. Por eso
mismo las variables de la demo están en `vercel.json`: acaban en el JavaScript que se
descarga el navegador de cualquier forma, así que esconderlas no aportaría nada.
La `service_role` key, esa sí secreta, no se usa en ningún lado de este proyecto.

## Otras decisiones

- **Guardado transaccional.** Guardar es "reemplazar los ítems". Hacerlo en un `delete`
  y un `insert` sueltos desde el navegador deja el presupuesto sin líneas si la red se
  corta en el medio. Va todo en una función, en una sola transacción.
- **Los importes se suman en centavos enteros.** En coma flotante `0.1 + 0.2` da
  `0.30000000000000004`, y un total que descuadra un centavo respecto al que ve el
  cliente no es aceptable.
- **Los inputs numéricos guardan texto, no números.** Si se convirtiera en cada tecla,
  borrar el contenido de un campo lo dejaría en `NaN`.
- **La página pública es imprimible.** `Ctrl+P` da un PDF limpio, sin botones ni barras.

## Estados

`borrador` → `enviada` → `aprobada` → `cobrada`.

En borrador el link público no muestra nada; hay que pasarla a “enviada” para compartirla.
