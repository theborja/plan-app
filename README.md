# plan-app

Web app mobile-first para seguimiento de entrenamiento, nutricion, progreso y medidas con persistencia 100% en PostgreSQL (sin localStorage de negocio).

## Requisitos

- Node.js 18.18.0 o superior (recomendado: Node.js 20 LTS)
- npm
- PostgreSQL accesible

## Instalacion

```bash
npm install
```

## Arranque en desarrollo

```bash
npm run dev
```

La app queda disponible en `http://localhost:3000`.

## Scripts disponibles

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:clean-domain
```

## Base de datos (PostgreSQL)

Variable obligatoria:

`DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public`

Flujo recomendado en entorno nuevo:

1. Configura `DATABASE_URL`.
2. Genera cliente Prisma:

```bash
npm run db:generate
```

3. (Opcional para entorno sucio) limpia solo dominio, manteniendo auth (`User`/`Session`):

```bash
npm run db:clean-domain
```

4. Aplica migraciones:

```bash
npm run db:migrate
```

5. Carga usuarios base:

```bash
npm run db:seed
```

Usuarios seed:

- `admin / admin`
- `borja / borja`
- `user / user`
- `mock / mock`

## Importacion de planes (admin)

1. Entra a `/import` con usuario admin.
2. Selecciona el usuario destino.
3. Sube un `.xlsx`.
4. Revisa preview.
5. Pulsa `Guardar y asignar plan`.

La importacion:

- parsea `PLAN NUTRICIONAL` y `PLAN ENTRENAMIENTO`.
- crea nuevo plan del usuario destino en BBDD.
- desactiva el plan activo previo del mismo usuario.
- mantiene historico de planes.

## Persistencia

La app persiste en BBDD:

- plan activo + historico por usuario
- seleccion nutricional diaria
- sesiones de entreno + pesos por serie
- progreso y graficos
- medidas semanales

`localStorage` solo se usa para preferencias visuales (tema), no para datos de negocio.

## Branding (logo, favicon, iconos)

Coloca tus logos en:

- `public/brand/logo-transparent.png`
- `public/brand/logo-bg.png`

## Design System (UI)

Tokens base en `app/globals.css` y componentes en `components/` (`Card`, `BottomNav`, `BottomSheet`, `EmptyState`, `Toast`).