# Diccionario de Datos — CBA English Level

> Sistema de Exámenes de Colocación — Centro Boliviano Americano

---

## Convenciones

- Nombres de tablas en **singular**
- Nombres de columnas en **snake_case**
- Clave primaria: `id` (UUID)
- Claves foráneas: `tabla_id` (ej: `student_id`, `level_id`)
- `TIMESTAMPTZ` para campos de fecha/hora

---

## Tablas

### student

Registro de estudiantes que rinden el examen.

| Columna     | Tipo          | Restricciones              | Descripción                        |
|-------------|---------------|----------------------------|------------------------------------|
| id          | UUID          | PK, DEFAULT gen_random_uuid | Identificador único                |
| ci          | VARCHAR(20)   | NOT NULL, UNIQUE            | Carnet de Identidad (login)        |
| full_name   | VARCHAR(200)  | NOT NULL                    | Nombre completo del estudiante     |
| email       | VARCHAR(200)  | NOT NULL, UNIQUE            | Correo electrónico (login alterno) |
| phone       | VARCHAR(20)   | NULLABLE                    | Teléfono de contacto               |
| created_at  | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW()     | Fecha de registro                  |

### admin

Administradores del sistema.

| Columna     | Tipo          | Restricciones              | Descripción                        |
|-------------|---------------|----------------------------|------------------------------------|
| id          | UUID          | PK, DEFAULT gen_random_uuid | Identificador único                |
| email       | VARCHAR(200)  | NOT NULL, UNIQUE            | Correo electrónico (login)         |
| full_name   | VARCHAR(200)  | NOT NULL                    | Nombre completo del administrador  |
| created_at  | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW()     | Fecha de registro                  |

### level

Niveles de inglés según puntaje (basado en MCERL).

| Columna     | Tipo          | Restricciones              | Descripción                        |
|-------------|---------------|----------------------------|------------------------------------|
| id          | UUID          | PK, DEFAULT gen_random_uuid | Identificador único                |
| name        | VARCHAR(100)  | NOT NULL                    | Nombre del nivel (Beginner, Elementary, etc.) |
| min_score   | INTEGER       | NOT NULL, CHECK(>=0)       | Puntaje mínimo para este nivel     |
| max_score   | INTEGER       | NOT NULL, CHECK(>min_score) | Puntaje máximo para este nivel     |
| description | TEXT          | NULLABLE                    | Descripción del nivel              |

### exam_config

Configuración global del examen (singleton).

| Columna              | Tipo          | Restricciones              | Descripción                        |
|----------------------|---------------|----------------------------|------------------------------------|
| id                   | UUID          | PK, DEFAULT gen_random_uuid | Identificador único                |
| time_limit_minutes   | INTEGER       | NOT NULL, CHECK(>0)        | Tiempo límite en minutos           |
| questions_per_exam   | INTEGER       | NOT NULL, CHECK(>0)        | Cantidad de preguntas por examen   |
| passing_score        | INTEGER       | NOT NULL, CHECK(0-100)     | Puntaje mínimo para aprobar (%)    |
| updated_at           | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW()    | Fecha de última modificación       |

### question

Preguntas del banco de examen.

| Columna     | Tipo          | Restricciones              | Descripción                        |
|-------------|---------------|----------------------------|------------------------------------|
| id          | UUID          | PK, DEFAULT gen_random_uuid | Identificador único                |
| text        | TEXT          | NOT NULL                    | Enunciado de la pregunta           |
| level_id    | UUID          | FK → level.id, NOT NULL    | Nivel al que pertenece             |
| category    | VARCHAR(100)  | NULLABLE                    | Categoría (grammar, vocabulary, reading, etc.) |
| created_at  | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW()    | Fecha de creación                  |
| updated_at  | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW()    | Fecha de última modificación       |

### question_option

Opciones de respuesta para cada pregunta.

| Columna      | Tipo          | Restricciones              | Descripción                        |
|--------------|---------------|----------------------------|------------------------------------|
| id           | UUID          | PK, DEFAULT gen_random_uuid | Identificador único                |
| question_id  | UUID          | FK → question.id, NOT NULL | Pregunta asociada                  |
| text         | TEXT          | NOT NULL                    | Texto de la opción                 |
| is_correct   | BOOLEAN       | NOT NULL, DEFAULT FALSE    | Indica si es la respuesta correcta |
| order        | INTEGER       | NOT NULL, CHECK(>=0)       | Orden de la opción (0, 1, 2, 3)    |

**Restricciones adicionales:**
- UNIQUE(question_id, order) — evita opciones duplicadas en una pregunta
- Cada pregunta debe tener exactamente una opción con is_correct = TRUE (se valida desde el frontend/backend)

### exam

Examen rendido por un estudiante.

| Columna      | Tipo          | Restricciones              | Descripción                        |
|--------------|---------------|----------------------------|------------------------------------|
| id           | UUID          | PK, DEFAULT gen_random_uuid | Identificador único                |
| student_id   | UUID          | FK → student.id, NOT NULL  | Estudiante que rinde el examen     |
| started_at   | TIMESTAMPTZ   | NULLABLE                    | Fecha de inicio                    |
| completed_at | TIMESTAMPTZ   | NULLABLE                    | Fecha de finalización              |
| score        | INTEGER       | NULLABLE, CHECK(>=0)       | Puntaje obtenido (porcentaje)      |
| level_id     | UUID          | FK → level.id, NULLABLE    | Nivel asignado                     |
| status       | exam_status   | NOT NULL, DEFAULT 'pending'| Estado del examen                  |
| created_at   | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW()    | Fecha de creación                  |

**exam_status** (ENUM): `pending` | `in_progress` | `completed`

### exam_question

Relación muchos-a-muchos entre examen y preguntas (las preguntas específicas que tuvo un examen).

| Columna      | Tipo          | Restricciones              | Descripción                        |
|--------------|---------------|----------------------------|------------------------------------|
| id           | UUID          | PK, DEFAULT gen_random_uuid | Identificador único                |
| exam_id      | UUID          | FK → exam.id, NOT NULL     | Examen asociado                    |
| question_id  | UUID          | FK → question.id, NOT NULL | Pregunta asociada                  |
| order        | INTEGER       | NOT NULL, CHECK(>=0)       | Orden de la pregunta en el examen  |

**Restricciones adicionales:**
- UNIQUE(exam_id, question_id) — evita preguntas duplicadas en un examen

### student_answer

Respuesta individual a una pregunta dentro de un examen.

| Columna            | Tipo          | Restricciones              | Descripción                        |
|--------------------|---------------|----------------------------|------------------------------------|
| id                 | UUID          | PK, DEFAULT gen_random_uuid | Identificador único                |
| exam_id            | UUID          | FK → exam.id, NOT NULL     | Examen asociado                    |
| question_id        | UUID          | FK → question.id, NOT NULL | Pregunta asociada                  |
| selected_option_id | UUID          | FK → question_option.id, NULLABLE | Opción seleccionada          |
| is_correct         | BOOLEAN       | NULLABLE                    | Indica si la respuesta es correcta |
| answered_at        | TIMESTAMPTZ   | DEFAULT NOW()              | Fecha de respuesta                 |

**Restricciones adicionales:**
- UNIQUE(exam_id, question_id) — evita respuestas duplicadas por pregunta
- Trigger impide modificar respuestas si el examen ya está completado

### audit_log

Registro de auditoría para acciones administrativas.

| Columna     | Tipo          | Restricciones              | Descripción                        |
|-------------|---------------|----------------------------|------------------------------------|
| id          | UUID          | PK, DEFAULT gen_random_uuid | Identificador único                |
| admin_id    | UUID          | FK → admin.id, NULLABLE    | Administrador que realizó la acción |
| action      | VARCHAR(100)  | NOT NULL                    | Tipo de acción (CREATE, UPDATE, DELETE) |
| entity      | VARCHAR(100)  | NOT NULL                    | Tabla afectada                     |
| entity_id   | UUID          | NULLABLE                    | ID del registro afectado           |
| details     | JSONB         | NULLABLE                    | Detalles adicionales de la acción  |
| created_at  | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW()    | Fecha de la acción                 |

---

## Reglas de Negocio (base de datos)

| Regla | Implementación |
|-------|---------------|
| Un estudiante solo puede rendir un examen por día | Trigger `trg_check_daily_exam` en INSERT a exam |
| Los resultados históricos no pueden modificarse | Trigger `trg_prevent_historical_change` en UPDATE a student_answer |
| El nivel se calcula automáticamente según puntaje | Función `fn_complete_exam()` |
| Las preguntas son aleatorias por examen | Función `fn_get_random_questions()` |
| Las opciones tienen orden definido | CHECK("order" >= 0) + UNIQUE(question_id, order) |
| Configuración del examen es global (singleton) | Tabla exam_config con única fila activa |
| Las respuestas incorrectas se marcan en el momento | Columna is_correct en student_answer |

---

## Índices

| Índice | Tabla | Columna(s) | Propósito |
|--------|-------|------------|-----------|
| idx_student_ci | student | ci | Búsqueda rápida por CI (login) |
| idx_student_email | student | email | Búsqueda rápida por email (login) |
| idx_question_level_id | question | level_id | Filtro de preguntas por nivel |
| idx_exam_student_id | exam | student_id | Historial de exámenes por estudiante |
| idx_exam_status | exam | status | Filtro por estado |
| idx_exam_question_exam_id | exam_question | exam_id | Carga de preguntas de un examen |
| idx_student_answer_exam_id | student_answer | exam_id | Carga de respuestas de un examen |
| idx_audit_log_admin_id | audit_log | admin_id | Auditoría por administrador |
| idx_audit_log_created_at | audit_log | created_at DESC | Ordenamiento cronológico |
