# Modelo relacional

Fuente de verdad: migraciones `supabase/migrations/001_schema.sql` a `016_admin_student_management.sql`. Este documento describe el estado final acumulado; no reemplaza ni se ejecuta como migración.

## Relaciones

```text
auth.users 1 --- 0..1 student
auth.users 1 --- 0..1 admin

student 1 --- N exam
exam_config 1 --- N exam_config_snapshot 1 --- N exam
level 1 --- N question 1 --- N question_option
level 1 --- N exam (nivel asignado)
level 1 --- N level (supersedes_level_id)

exam 1 --- N exam_question N --- 1 question
exam_question 1 --- N exam_question_option N --- 1 question_option
exam 1 --- N exam_level_snapshot N --- 1 level
exam 1 --- N student_answer
student_answer N --- 1 question
student_answer N --- 0..1 exam_question
student_answer N --- 0..1 question_option
student_answer N --- 0..1 exam_question_option

admin 1 --- N audit_log
```

## Esquemas de relación

| Relación | Clave primaria | Claves foráneas | Claves únicas y reglas principales |
|---|---|---|---|
| `student` | `id` | `id` corresponde a `auth.users.id` por trigger de registro | `ci`, `email` únicos. |
| `admin` | `id` | `id` debe corresponder a `auth.users.id` | `email` único; un trigger quita el perfil `student` transitorio al aprovisionar un administrador. |
| `level` | `id` | `supersedes_level_id -> level.id` | `(code, version)` único; un código tiene una sola versión activa. |
| `level_partition_revision` | `id` booleano | - | Singleton `id=true`; controla concurrencia de distribución CEFR. |
| `exam_config` | `id` | - | Singleton `singleton=true`; revisión positiva e incremento obligatorio de uno. |
| `exam_config_snapshot` | `id` | `source_config_id -> exam_config.id` | `(source_config_id, source_revision)` único; inmutable. |
| `question` | `id` | `level_id -> level.id` | El nivel no se borra si tiene preguntas. |
| `question_option` | `id` | `question_id -> question.id` | `(question_id, order)` único. |
| `exam` | `id` | `student_id -> student.id`, `level_id -> level.id`, `config_snapshot_id -> exam_config_snapshot.id` | `(student_id, start_request_id)` único; a lo sumo un intento `in_progress` por estudiante. |
| `exam_question` | `id` | `exam_id -> exam.id`, `question_id -> question.id` | `(exam_id, question_id)` y `(exam_id, order)` únicos; snapshot de texto/categoría. |
| `exam_question_option` | `id` | `exam_question_id -> exam_question.id`, `source_option_id -> question_option.id` | Opción snapshot inmutable; únicas por opción fuente y orden dentro de la pregunta del intento. |
| `exam_level_snapshot` | `id` | `exam_id -> exam.id`, `source_level_id -> level.id` | Único por nivel fuente y puntaje mínimo dentro del intento; inmutable. |
| `student_answer` | `id` | `exam_id -> exam.id`, `question_id -> question.id`, referencias opcionales a pregunta/opciones snapshot y fuente | `(exam_id, question_id)` único; no se altera ni borra tras completar el examen. |
| `audit_log` | `id` | `admin_id -> admin.id` | Registro append-only para roles de aplicación; `details` no se expone a la UI. |

## Restricciones de estado

`exam.status` es el enum `pending`, `in_progress` o `completed`. Los intentos creados por el flujo actual pasan a `in_progress` con `started_at`, `deadline_at`, `start_request_id` y snapshot de configuración. Un intento completado requiere fecha, puntaje entre 0 y 100 y nivel asignado. El trigger de ciclo de vida verifica que el plazo sea exactamente el tiempo de su snapshot.

La tabla `level` mantiene las versiones históricas. La distribución activa debe ser una partición contigua de 0 a 100; la corrección se realiza de forma atómica por `replace_active_level_distribution`, no con escrituras directas.

## Índices operativos destacados

| Índice o acceso | Finalidad |
|---|---|
| `exam_one_in_progress_per_student_key` | Impide más de un intento activo por estudiante. |
| `idx_exam_student_completed_at`, `idx_exam_admin_student_timeline` | Panel e historial de estudiante. |
| `idx_exam_report_completed_at`, `idx_exam_report_level_status` | Filtros de reportes administrativos. |
| `idx_audit_log_timeline` | Auditoría paginada por `(created_at, id)`. |
| `idx_exam_question_option_exam_question`, `idx_exam_level_snapshot_exam` | Reconstrucción segura del intento y resultado. |
