# Base de Datos — CBA English Level

> Diseño de base de datos del **Sistema de Exámenes de Colocación** del **Centro Boliviano Americano (CBA)**.
>
> 14 tablas en **3ra Forma Normal**, con RLS, snapshots inmutables de intentos, funciones SQL para el ciclo del examen y auditoría administrativa.

---

## ¿Qué hay acá?

| Archivo | Descripción |
|---|---|
| [`../supabase/migrations/`](../supabase/migrations/) | Fuente única y oficial de migraciones versionadas de esquema, datos, funciones, triggers y RLS |
| [`data-dictionary.md`](./data-dictionary.md) | Diccionario de datos con todas las tablas, columnas y restricciones |
| [`modelo-relacional.md`](./modelo-relacional.md) | Relaciones, claves y restricciones del modelo vigente de 14 tablas |
| [`diagrama-uml.puml`](./diagrama-uml.puml) | Fuente PlantUML mantenida del diagrama entidad-relación vigente |
| [`../docs/latex/main.pdf`](../docs/latex/main.pdf) | Manual técnico compilado, con la descripción actual del modelo de datos |

---

## Diagrama vigente

El ERD mantenido corresponde a las 14 tablas documentadas en este directorio.
Renderizá [`diagrama-uml.puml`](./diagrama-uml.puml) con PlantUML para obtener una vista gráfica actualizada. Los PNG heredados permanecen únicamente como archivos no publicados y no deben utilizarse para describir el esquema.

---

## Tablas (resumen)

| Tabla | Propósito |
|---|---|
| `student` | Registro de estudiantes (CI, email, nombre) |
| `admin` | Administradores del sistema |
| `level` | Niveles de inglés con rangos de puntaje (MCERL) |
| `level_partition_revision` | Revisión singleton para controlar concurrencia de la distribución CEFR |
| `exam_config` | Configuración global del examen (singleton) |
| `question` | Banco de preguntas clasificadas por nivel y categoría |
| `question_option` | Opciones de respuesta del banco |
| `exam` | Examen rendido por un estudiante |
| `exam_question` | Preguntas específicas asignadas a un examen |
| `student_answer` | Respuestas individuales del estudiante |
| `audit_log` | Auditoría de acciones administrativas |
| `exam_config_snapshot` | Configuración inmutable asociada a un intento |
| `exam_question_option` | Opciones inmutables asignadas a una pregunta del intento |
| `exam_level_snapshot` | Niveles CEFR inmutables usados para calificar un intento |

---

## Reglas de negocio (a nivel BD)

| Regla | Implementación |
|---|---|
| Un estudiante solo puede rendir **un examen por día** | RPC `start_exam()` bloquea una nueva creación si existe un examen completado en la fecha de negocio CBA (`America/La_Paz`) |
| Los **resultados históricos nunca se modifican** | Triggers protegen snapshots, exámenes finalizados y sus respuestas |
| El nivel se calcula automáticamente | Finalización interna del ciclo de RPC sobre los snapshots del intento |
| Las preguntas se asignan aleatoriamente | RPC `start_exam()` selecciona preguntas elegibles y crea sus snapshots |
| Preguntas elegibles para un intento | `start_exam()` exige al menos dos opciones y exactamente una correcta; es una validación al iniciar el intento, no una restricción general de `question_option` |
| Las opciones tienen orden definido | `CHECK("order" >= 0)` + `UNIQUE(question_id, order)` |
| Auditoría de acciones administrativas | Tabla `audit_log` + trigger base `fn_audit_admin_action` |
| Acceso por fila (RLS) | Acceso administrativo por rol; el estudiante usa proyecciones RPC limitadas a su identidad |

---

## Cómo usar

### Opción 1: Supabase CLI (recomendado)

Desde la raíz del proyecto, ejecutá el reset local para aplicar exclusivamente
las migraciones oficiales de `supabase/migrations/`:

```bash
supabase db reset --local
```

Para un proyecto remoto, aplicá las migraciones mediante el flujo oficial de
Supabase CLI (`supabase db push`). No ejecutes scripts SQL desde este directorio.

### Opción 2: Supabase SQL Editor

Si necesitás ejecutar SQL manualmente, usá únicamente los archivos versionados
de `supabase/migrations/`, respetando su orden numérico.

### Autoridad y orden de migración

`supabase/migrations/` es la única autoridad de migraciones del proyecto. El
Supabase CLI aplica sus archivos versionados en orden numérico; `database/` solo
contiene documentación, diagramas y el diccionario de datos.

---

## Stack

| Componente | Tecnología |
|---|---|
| Motor de BD | PostgreSQL administrado por Supabase |
| Autenticación | Supabase Auth (email + contraseña) |
| Autorización | Row Level Security (RLS) |
| Lenguaje de funciones | PL/pgSQL |
| Diagramas | PlantUML + AI-generated |

---

## Convenciones

- Nombres de tablas en **singular**
- Nombres de columnas en **snake_case**
- Clave primaria: `id` (UUID)
- Claves foráneas: `tabla_id` (ej: `student_id`, `level_id`)
- `TIMESTAMPTZ` para campos de fecha/hora
