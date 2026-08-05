# Diccionario de datos

Estado acumulado de las migraciones `001` a `016`. Las tablas usan nombres singulares, `snake_case`, UUID como clave primaria y `TIMESTAMPTZ` para instantes. Las referencias a `auth.users` son de identidad lógica: el trigger de registro sincroniza `student.id` con el usuario autenticado.

## Identidad y administración

### `student`

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | UUID | PK | Identificador del estudiante y usuario Auth. |
| `ci` | VARCHAR(20) | NOT NULL, UNIQUE | Documento de identidad. |
| `full_name` | VARCHAR(200) | NOT NULL | Nombre completo. |
| `email` | VARCHAR(200) | NOT NULL, UNIQUE | Correo de la cuenta. |
| `phone` | VARCHAR(20) | Nullable | Teléfono; edición administrativa limitada. |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `now()` | Registro del perfil. |

### `admin`

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | UUID | PK | Identificador del administrador y usuario Auth. |
| `email` | VARCHAR(200) | NOT NULL, UNIQUE | Correo del administrador. |
| `full_name` | VARCHAR(200) | NOT NULL | Nombre para UI y auditoría. |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `now()` | Registro del perfil. |

### `audit_log`

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | UUID | PK | Evento de auditoría. |
| `admin_id` | UUID | FK `admin.id`, nullable | Actor, o nulo para sistema. |
| `action` | VARCHAR(100) | NOT NULL | Acción auditada. |
| `entity` | VARCHAR(100) | NOT NULL | Entidad afectada. |
| `entity_id` | UUID | Nullable | Registro afectado. |
| `details` | JSONB | Nullable | Datos internos antes/después; no se proyectan a clientes. |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `now()` | Instante del evento. |

## Catálogos y configuración

### `level`

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | UUID | PK | Versión concreta de nivel CEFR. |
| `code` | VARCHAR(10) | NOT NULL | Código CEFR, por ejemplo A1. |
| `name` | VARCHAR(100) | NOT NULL | Nombre mostrado. |
| `min_score`, `max_score` | INTEGER | 0..100, `min_score <= max_score` | Rango de puntaje. |
| `description` | TEXT | Nullable | Descripción del nivel. |
| `version` | INTEGER | NOT NULL, >= 1 | Versión histórica del código. |
| `is_active` | BOOLEAN | NOT NULL | Participa en la distribución actual. |
| `supersedes_level_id` | UUID | FK `level.id`, nullable | Versión que reemplaza. |

`(code, version)` es único y solo puede existir una versión activa por código. Los niveles activos cubren 0..100 sin huecos ni solapamientos.

### `level_partition_revision`

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | BOOLEAN | PK, siempre `true` | Fila singleton. |
| `revision` | BIGINT | NOT NULL, > 0 | Control de concurrencia de distribución. |

### `exam_config`

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | UUID | PK | Configuración actual. |
| `singleton` | BOOLEAN | UNIQUE, siempre `true` | Garantiza una única configuración. |
| `revision` | BIGINT | NOT NULL, > 0 | Revisión optimista. |
| `time_limit_minutes` | INTEGER | > 0 | Tiempo del intento. |
| `questions_per_exam` | INTEGER | > 0 | Cantidad solicitada. |
| `passing_score` | INTEGER | 0..100 | Puntaje de aprobación configurado; no genera estado actual. |
| `question_selection_rule` | TEXT | `random_all_questions` | Regla de selección vigente. |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Última actualización. |

### `exam_config_snapshot`

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | UUID | PK | Snapshot de una revisión. |
| `source_config_id`, `source_revision` | UUID, BIGINT | FK y UNIQUE conjunto | Configuración que originó el snapshot. |
| `time_limit_minutes`, `questions_per_exam`, `passing_score` | INTEGER | Valores validados | Valores usados por el intento. |
| `question_selection_rule` | TEXT | `random_all_questions` | Regla congelada. |
| `created_at` | TIMESTAMPTZ | default `now()` | Creación. |

No admite `UPDATE` ni `DELETE`.

### `question` y `question_option`

| Tabla | Columnas relevantes | Restricciones |
|---|---|---|
| `question` | `id`, `text`, `level_id`, `category`, `created_at`, `updated_at` | `level_id` FK; texto obligatorio. |
| `question_option` | `id`, `question_id`, `text`, `is_correct`, `order` | `(question_id, order)` único; orden >= 0. |

El inicio de examen solo selecciona preguntas con al menos dos opciones y exactamente una marcada correcta. La UI administrativa exige de cuatro a diez opciones, pero esa cardinalidad no es una restricción SQL general.

## Intentos y snapshots

### `exam`

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | UUID | PK | Intento. |
| `student_id` | UUID | FK `student.id` | Propietario. |
| `config_snapshot_id` | UUID | FK, nullable para legado | Configuración utilizada. |
| `start_request_id` | UUID | UNIQUE con `student_id` | Idempotencia de inicio. |
| `started_at`, `deadline_at`, `completed_at` | TIMESTAMPTZ | Nullable según estado | Ciclo temporal. |
| `score` | INTEGER | 0..100 al completar | Porcentaje calculado. |
| `level_id` | UUID | FK `level.id` | Nivel fuente asignado. |
| `status` | `exam_status` | `pending`, `in_progress`, `completed` | Estado. |
| `created_at` | TIMESTAMPTZ | default `now()` | Creación. |

Un índice parcial impide dos intentos `in_progress` por estudiante. Los completados no se actualizan ni eliminan.

### `exam_question` y `exam_question_option`

| Tabla | Columnas relevantes | Restricciones |
|---|---|---|
| `exam_question` | `exam_id`, `question_id`, `order`, `question_text`, `question_category` | Pregunta y orden únicos por examen; el texto/categoría snapshot no se modifica. |
| `exam_question_option` | `exam_question_id`, `source_option_id`, `option_text`, `order`, `is_correct` | Opción y orden únicos por pregunta del intento; inmutable. |

### `exam_level_snapshot`

| Columna | Tipo | Descripción |
|---|---|---|
| `exam_id`, `source_level_id` | UUID | Intento y nivel fuente. |
| `code`, `name`, `version` | Texto, texto, entero | Identidad histórica CEFR. |
| `min_score`, `max_score` | INTEGER | Rango usado para asignar el resultado. |

Los snapshots de nivel son inmutables y un examen tiene una fila por nivel fuente/rango mínimo.

### `student_answer`

| Columna | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | UUID | PK | Respuesta registrada. |
| `exam_id`, `question_id` | UUID | FK, UNIQUE conjunto | Intento y pregunta fuente. |
| `exam_question_id` | UUID | FK, nullable para legado | Pregunta snapshot asignada. |
| `selected_exam_question_option_id` | UUID | FK, nullable | Opción snapshot elegida. |
| `selected_option_id` | UUID | FK, nullable | Referencia a opción fuente conservada. |
| `is_correct` | BOOLEAN | Nullable | Corrección tomada del snapshot. |
| `answered_at` | TIMESTAMPTZ | default `now()` | Último guardado. |

Las respuestas se pueden actualizar solo mientras el intento está en curso; después de completarlo son inmutables.

## Acceso y funciones públicas

RLS está habilitado en las tablas de aplicación. Los estudiantes acceden al ciclo del examen exclusivamente mediante `start_exam`, `get_exam_attempt`, `save_exam_answer` y `submit_exam`; también usan RPC de dashboard e historial. Las funciones administrativas verifican `fn_is_admin()` para reportes, auditoría, estudiantes, niveles y configuración. Las proyecciones RPC limitan las columnas devueltas y evitan conceder acceso directo a datos sensibles.
