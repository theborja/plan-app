# plan-app

Web app personal mobile-first para seguimiento de plan de entrenamiento y nutricion.

## Requisitos

- Node.js 18.18.0 o superior (recomendado: Node.js 20 LTS)
- npm

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
```

## Branding (logo, favicon, iconos)

Coloca tus logos en:

- `public/brand/logo-transparent.png` (sin fondo)
- `public/brand/logo-bg.png` (con fondo)

Con esos archivos, la app usa automaticamente:

- favicon / iconos de navegador
- `apple-touch-icon`
- Open Graph / Twitter image
- `manifest` PWA

## Base de datos (PostgreSQL)

La app usa Prisma con PostgreSQL para login/registro y sesiones.

Variable obligatoria:

`DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public`

Puedes copiar `.env.example` a `.env` en local y rellenar la URL.

Flujo recomendado:

1. Configura `DATABASE_URL` en local y en Vercel (Preview + Production).
2. Genera cliente Prisma:

```bash
npm run db:generate
```

3. Aplica esquema en la base de datos:

```bash
npm run db:push
```

4. Carga usuarios base:

```bash
npm run db:seed
```

Usuarios seed:

- `admin / admin`
- `user / user`
- `mock / mock`

Si `DATABASE_URL` no existe (o no es PostgreSQL), los endpoints de auth no funcionaran.

## Excel base por defecto

Coloca el archivo Excel base en:

`public/default-plan.xlsx`

En el primer arranque, si no existe `plan_v1` en `localStorage`, la app carga ese archivo automaticamente como plan base.

## Reemplazar plan con un nuevo Excel

1. Abre `Importar` (`/import`).
2. Sube un archivo `.xlsx`.
3. La app parsea solo las hojas:
   - `PLAN NUTRICIONAL`
   - `PLAN ENTRENAMIENTO`
4. Revisa el preview.
5. Pulsa `Guardar y reemplazar plan`.

Nota: al reemplazar plan, `selections_v1` se limpia para evitar referencias incompatibles con IDs del plan anterior.

## Exportar / importar JSON

Desde `Ajustes` (`/settings`):

- `Exportar plan.json`: descarga el plan actual.
- `Exportar selections.json`: descarga el progreso/selecciones actuales.
- `Importar selections.json`: carga un archivo JSON y valida `version` + estructura antes de guardar.

## Design System (UI)

Tokens base definidos en `app/globals.css`:

- `--primary-start` / `--primary-end`: gradiente principal.
- `--surface` / `--surface-soft`: superficies de cards y paneles.
- `--foreground` / `--muted`: jerarquia de texto.
- `--border`: bordes y separadores.
- `--success`, `--warning`, `--error`: estados.
- `--radius-card`, `--radius-pill`: radios reutilizables.
- `--shadow-soft`: sombra estandar.

Componentes base:

- `components/Card.tsx`: contenedor visual principal.
- `components/BottomNav.tsx`: navegacion fija inferior con estado activo.
- `components/BottomSheet.tsx`: modal deslizante inferior.
- `components/EmptyState.tsx`: estado vacio con CTA opcional.
- `components/Toast.tsx`: feedback simple info/success/error.
