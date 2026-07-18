# Administración de Preguntas — Specification

## Purpose

CRUD completo para que los administradores gestionen el banco de preguntas MCQ del examen de colocación: listado, creación, edición y eliminación.

## Requirements

### Requirement: Q1 — Listado de Preguntas

El sistema SHALL renderizar una tabla paginada en `/admin/questions` con columnas: texto, nivel, categoría, fecha. SHALL incluir filtro por nivel (dropdown) y categoría (input). Paginación default: 10 elementos.

#### Scenario: Q1-H — Listado exitoso

- GIVEN un administrador en `/admin/questions`
- WHEN la página carga
- THEN se muestra la tabla con preguntas, filtros y paginación

#### Scenario: Q1-F — Filtro por nivel

- GIVEN el administrador selecciona un nivel en el filtro
- WHEN se aplica
- THEN la tabla muestra solo preguntas de ese nivel y la paginación se recalcula

### Requirement: Q2 — Creación de Pregunta

El sistema SHALL proveer formulario en `/admin/questions/new` con: texto (textarea, requerido), nivel (dropdown, requerido), categoría (input, opcional, max 100 chars), y lista dinámica de opciones (mín 4, máx 10). Cada opción SHALL tener texto (requerido) y radio "correcta" (exactamente 1). Botón "Agregar opción" y botón eliminar por opción (excepto si quedan 4).

#### Scenario: Q2-H — Creación exitosa

- GIVEN formulario completo con 4+ opciones y 1 correcta
- WHEN presiona "Guardar"
- THEN se inserta pregunta + opciones y se redirige a `/admin/questions`

#### Scenario: Q2-V — Validación fallida

- GIVEN menos de 4 opciones o ninguna correcta
- WHEN presiona "Guardar"
- THEN no se envía y se muestra error

#### Scenario: Q2-FK — Nivel eliminado concurrentemente

- GIVEN el nivel fue eliminado mientras se edita
- WHEN presiona "Guardar"
- THEN se muestra error amigable sobre el nivel

### Requirement: Q3 — Edición de Pregunta

El sistema SHALL proveer formulario en `/admin/questions/:id/edit` pre-cargado con datos existentes. Rutas deep-linkable. Permite modificar todo: texto, nivel, categoría, opciones y correcta.

#### Scenario: Q3-H — Edición exitosa

- GIVEN administrador modifica una pregunta existente
- WHEN presiona "Guardar"
- THEN se actualiza y se redirige a `/admin/questions`

#### Scenario: Q3-NF — Pregunta no encontrada

- GIVEN ID inexistente en `/admin/questions/:id/edit`
- WHEN carga la página
- THEN muestra error "Pregunta no encontrada" con enlace al listado

### Requirement: Q4 — Eliminación de Pregunta

El sistema SHALL mostrar botón eliminar por fila. Al clickear: modal de confirmación con el texto de la pregunta. FK RESTRICT (exam_question, student_answer): SHALL mostrar mensaje "No se puede eliminar: esta pregunta está asociada a exámenes existentes". Opciones se eliminan por CASCADE.

#### Scenario: Q4-H — Eliminación exitosa

- GIVEN pregunta sin referencias en exam_question/student_answer
- WHEN confirma en modal
- THEN se elimina pregunta + opciones (cascade) y la tabla se actualiza

#### Scenario: Q4-FK — Pregunta en uso

- GIVEN pregunta referenciada por exam_question
- WHEN intenta eliminarla
- THEN muestra mensaje de error indicando que está en uso

### Requirement: Q5 — Datos del Formulario

El sistema SHALL obtener niveles del `level` table mediante hook reutilizable. Dropdown muestra `name`. Categoría acepta texto libre. Orden de opciones se asigna secuencialmente (0, 1, 2…).

#### Scenario: Q5-H — Niveles cargados

- GIVEN el formulario se renderiza
- WHEN carga niveles
- THEN dropdown muestra todos los niveles disponibles
