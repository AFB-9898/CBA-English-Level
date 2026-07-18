# Delta para Administración de Preguntas

## MODIFIED Requirements

### Requirement: Q2 — Creación de Pregunta

El sistema SHALL proveer formulario en `/admin/questions/new` con: texto (textarea, requerido), nivel activo (dropdown, requerido), categoría (input, opcional, max 100 chars), y lista dinámica de opciones (mín 4, máx 10). Cada opción SHALL tener texto (requerido) y radio "correcta" (exactamente 1). Botón "Agregar opción" y botón eliminar por opción (excepto si quedan 4).
(Previously: el dropdown podía tratar niveles existentes como seleccionables sin distinguir estado activo.)

#### Scenario: Q2-H — Creación exitosa
- GIVEN formulario completo con nivel activo, 4+ opciones y 1 correcta
- WHEN presiona "Guardar"
- THEN se inserta pregunta + opciones y se redirige a `/admin/questions`

#### Scenario: Q2-V — Validación fallida
- GIVEN menos de 4 opciones, ninguna correcta o nivel inactivo
- WHEN presiona "Guardar"
- THEN no se envía y se muestra error

#### Scenario: Q2-FK — Nivel desactivado concurrentemente
- GIVEN el nivel fue desactivado mientras se edita
- WHEN presiona "Guardar"
- THEN se muestra error amigable y no se crea una referencia inválida

### Requirement: Q5 — Datos del Formulario

El sistema SHALL obtener niveles mediante un hook reutilizable. Los formularios y filtros SHALL mostrar solo niveles activos, ordenados por rango. Una repartición versionada MUST conservar los IDs de preguntas y exámenes que apuntan a versiones históricas; esos IDs no SHALL reemplazarse silenciosamente. Categoría acepta texto libre. Orden de opciones se asigna secuencialmente (0, 1, 2…).
(Previously: el hook exponía niveles sin contrato explícito de estado/versionado.)

#### Scenario: Q5-H — Niveles activos cargados
- GIVEN el formulario se renderiza
- WHEN carga niveles
- THEN dropdown muestra solo niveles activos ordenados por `min_score`

#### Scenario: Q5-HIST — Referencia histórica preservada
- GIVEN una pregunta existente apunta a una versión que dejó de estar activa
- WHEN se edita o se lista
- THEN su referencia se conserva y no se reemplaza silenciosamente por otra versión

#### Scenario: Q5-PART — Repartición completa preserva referencias
- GIVEN una pregunta o examen apunta a una versión histórica y se confirma una nueva distribución
- WHEN la RPC versiona rangos modificados
- THEN la relación histórica conserva su `level_id` original y los formularios solo ofrecen versiones activas
