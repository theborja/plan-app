# Plan de Migracion a BBDD para Planes, Nutricion y Entrenamiento

## Objetivo
Migrar la app desde persistencia local a una persistencia principal en PostgreSQL (Prisma), con:

- Plan nutricional y plan de entrenamiento asociados a cada usuario.
- Multiples planes por usuario.
- Un unico plan activo por usuario.
- Historico de planes importados desde Excel.
- Registro de pesos por serie en cada entreno.
- Graficos de progreso construidos desde datos en BBDD.

---

## Requisitos funcionales

1. Cada usuario puede tener varios planes.
2. Solo 1 plan puede estar activo.
3. Al importar nuevo Excel:
   - se crea un plan nuevo,
   - el plan previo queda en historico,
   - el nuevo se marca activo.
4. Guardar progreso de entreno por fecha:
   - nota de sesion,
   - series por ejercicio,
   - peso por serie,
   - completado.
5. Guardar seleccion nutricional por fecha:
   - opcion diaria elegida,
   - completado,
   - nota.
6. `/progress` y graficos usan solo BBDD.

---

## Esquema de datos propuesto (v1)

### Entidades de plan

- `Plan`
  - `id`
  - `userId`
  - `name`
  - `sourceFileName`
  - `sourceType` (`IMPORTED_EXCEL`, `MANUAL`)
  - `isActive` (boolean)
  - `importedAt`
  - `createdAt`
  - `updatedAt`

- `TrainingDay`
  - `id`
  - `planId`
  - `dayIndex`
  - `label`
  - `sortOrder`

- `Exercise`
  - `id`
  - `trainingDayId`
  - `exerciseIndex`
  - `name`
  - `sets`
  - `reps`
  - `restSeconds`
  - `notes`

- `NutritionDayOption`
  - `id`
  - `planId`
  - `dayOptionIndex` (opcion 1..N)
  - `label` (ej. "Opcion 3")
  - `sortOrder`

- `NutritionMeal`
  - `id`
  - `nutritionDayOptionId`
  - `mealType` (`DESAYUNO`, `ALMUERZO`, `COMIDA`, `POSTRE_COMIDA`, `MERIENDA`, `CENA`, `POSTRE_CENA`)
  - `content` (texto multi-linea)

### Entidades de tracking

- `WorkoutSession`
  - `id`
  - `userId`
  - `planId`
  - `trainingDayId`
  - `dateISO`
  - `note`
  - `createdAt`
  - `updatedAt`

- `ExerciseSetLog`
  - `id`
  - `sessionId`
  - `exerciseId`
  - `setNumber`
  - `weight`
  - `repsDone` (opcional)
  - `done` (opcional)
  - `createdAt`
  - `updatedAt`

- `MealSelectionLog`
  - `id`
  - `userId`
  - `planId`
  - `dateISO`
  - `selectedDayOptionIndex`
  - `done`
  - `note`
  - `createdAt`
  - `updatedAt`

### Constraints e indices recomendados

- Unico plan activo por usuario (regla de servicio + constraint parcial si aplica).
- `WorkoutSession` unico por `(userId, planId, dateISO)`.
- `ExerciseSetLog` unico por `(sessionId, exerciseId, setNumber)`.
- Indices para progreso:
  - `WorkoutSession(userId, dateISO)`
  - `ExerciseSetLog(exerciseId)`
  - `MealSelectionLog(userId, dateISO)`

---

## Fases de implementacion

## Fase A: Base de datos y migraciones

1. Extender `prisma/schema.prisma` con las tablas nuevas.
2. Crear migracion Prisma.
3. Generar cliente Prisma.
4. Aplicar migracion en local y en entorno remoto.
5. Ajustar `seed` para usuarios base (`admin`, `user`, `mock`).

Resultado esperado:
- Estructura persistente lista para planes + tracking.

## Fase B: Capa de servicios

Crear servicios backend desacoplados:

- `planService`
  - crear plan desde parser
  - activar plan (desactiva anteriores en transaccion)
  - listar historico de planes

- `nutritionService`
  - obtener menu del dia del plan activo
  - guardar seleccion diaria

- `workoutService`
  - obtener entreno del dia del plan activo
  - crear/actualizar sesion diaria
  - guardar pesos por serie (upsert)

- `progressService`
  - obtener series temporales por ejercicio
  - agregar semana/mes para graficos

Resultado esperado:
- Logica central reutilizable por API/UI.

## Fase C: API routes

Endpoints minimos:

- `GET /api/plans/active`
- `GET /api/plans/history`
- `POST /api/plans/import` (solo admin)
- `GET /api/nutrition/day?date=YYYY-MM-DD`
- `POST /api/nutrition/selection`
- `GET /api/workout/day?date=YYYY-MM-DD`
- `POST /api/workout/session`
- `POST /api/workout/set-log`
- `GET /api/progress/blocks`
- `GET /api/progress/block/:id`

Reglas:
- `userId` siempre desde sesion (cookie), nunca desde payload.
- Validaciones runtime estrictas.

## Fase D: Import Excel en BBDD con historico

Flujo de import:

1. Parsear Excel (parser actual reutilizable).
2. Construir DTO de plan normalizado.
3. Guardar en transaccion:
   - crear `Plan`,
   - insertar `TrainingDay` + `Exercise`,
   - insertar `NutritionDayOption` + `NutritionMeal`,
   - desactivar plan activo anterior,
   - activar nuevo.

Resultado esperado:
- Nunca se pierde historico de planes.

## Fase E: Migracion UI a lectura/escritura BBDD

1. `/today`
   - leer plan activo + menu del dia desde API/BBDD
   - guardar seleccion en `MealSelectionLog`

2. `/workout`
   - leer entreno desde plan activo
   - guardar sesion y pesos por serie en `WorkoutSession` + `ExerciseSetLog`

3. `/progress`
   - consumir series desde BBDD
   - calcular/mostrar KPIs semanales y mensuales

4. `/measures` (opcional en esta fase)
   - crear tabla especifica y migrar tambien

## Fase F: Compatibilidad y retirada de localStorage

1. Modo hibrido temporal:
   - BBDD primero,
   - fallback localStorage para usuarios antiguos.
2. Script de migracion legacy:
   - importar JSON exportado de localStorage.
3. Retirar fallback cuando este estable.

---

## Ejemplo real de mapeo desde un dia del Excel

Suposicion:
- Usuario: `mock`
- Fecha: `2026-02-17`
- Bloque entreno: `DIA 1 - TORSO`
- Menu seleccionado: `Opcion 3`

### Datos guardados

- `Plan`: `plan_2026_02_import_01`, `isActive=true`.
- `TrainingDay`: `dayIndex=1`, `label='DIA 1 - TORSO'`.
- `Exercise`:
  - `Press banca`, sets 4, reps `6-8`, rest `180`.
  - `Remo barra`, sets 4, reps `8-10`, rest `120`.
- `NutritionDayOption`:
  - opciones 1..N para ese plan.
- `MealSelectionLog`:
  - `dateISO='2026-02-17'`, `selectedDayOptionIndex=3`.
- `WorkoutSession`:
  - nota diaria y referencia al `TrainingDay`.
- `ExerciseSetLog`:
  - pesos por set para cada ejercicio.

### SELECTs de ejemplo

#### Plan activo

```sql
SELECT id, source_file_name, imported_at, is_active
FROM plans
WHERE user_id = 'usr_mock' AND is_active = true
LIMIT 1;
```

#### Entreno del dia con ejercicios

```sql
SELECT
  ws.date_iso,
  td.day_index,
  td.label,
  e.exercise_index,
  e.name,
  e.sets,
  e.reps,
  e.rest_seconds
FROM workout_sessions ws
JOIN training_days td ON td.id = ws.training_day_id
JOIN exercises e ON e.training_day_id = td.id
WHERE ws.user_id = 'usr_mock'
  AND ws.date_iso = '2026-02-17'
ORDER BY e.exercise_index;
```

#### Pesos por serie del dia

```sql
SELECT
  e.name AS exercise,
  esl.set_number,
  esl.weight
FROM exercise_set_logs esl
JOIN exercises e ON e.id = esl.exercise_id
JOIN workout_sessions ws ON ws.id = esl.session_id
WHERE ws.user_id = 'usr_mock'
  AND ws.date_iso = '2026-02-17'
ORDER BY e.exercise_index, esl.set_number;
```

#### Menu diario elegido y comidas

```sql
SELECT
  msl.date_iso,
  msl.selected_day_option_index,
  nm.meal_type,
  nm.content
FROM meal_selection_logs msl
JOIN nutrition_day_options ndo
  ON ndo.plan_id = msl.plan_id
 AND ndo.day_option_index = msl.selected_day_option_index
JOIN nutrition_meals nm ON nm.nutrition_day_option_id = ndo.id
WHERE msl.user_id = 'usr_mock'
  AND msl.date_iso = '2026-02-17'
ORDER BY nm.meal_type;
```

#### Serie temporal para graficos (ejercicio)

```sql
SELECT
  ws.date_iso,
  MAX(esl.weight) AS top_set_weight
FROM exercise_set_logs esl
JOIN workout_sessions ws ON ws.id = esl.session_id
JOIN exercises e ON e.id = esl.exercise_id
WHERE ws.user_id = 'usr_mock'
  AND e.name = 'Press banca'
GROUP BY ws.date_iso
ORDER BY ws.date_iso;
```

---

## Riesgos y mitigaciones

1. **Cambio de plan rompe referencias antiguas**
   - Mitigar guardando logs ligados al `planId` historico.

2. **Fechas y timezone inconsistentes**
   - Mitigar usando `dateISO` normalizado (`YYYY-MM-DD`) para tracking diario.

3. **Regresiones en UI durante transicion**
   - Mitigar con modo hibrido y feature flag por pantalla.

4. **Consultas lentas en progreso**
   - Mitigar con indices + agregaciones controladas.

---

## Criterios de aceptacion

1. Usuario puede importar 2+ planes y alternar activo sin perder historico.
2. Guardado de pesos por serie persiste y se recupera por fecha.
3. Graficos reflejan exclusivamente datos de BBDD.
4. `/today` y `/workout` funcionan sin localStorage.
5. Tests de integracion pasan en flujo:
   - login -> import -> entreno -> guardar pesos -> ver progreso.
