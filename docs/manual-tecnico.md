# Manual técnico

## Propósito y alcance

Este manual describe la implementación actual de CBA English Level. Es una aplicación SPA: no existe un servidor REST intermedio. React consume Supabase mediante `@supabase/supabase-js`; PostgreSQL concentra las reglas críticas mediante RLS, funciones SQL y triggers.

## Puesta en marcha local

| Requisito | Uso |
|---|---|
| Node.js y npm | Dependencias, Vite y scripts del frontend. |
| Docker | Pila local de Supabase. |
| Supabase CLI | Inicio de servicios y aplicación de migraciones. |

```bash
npm install
supabase start
supabase db reset --local
npm run dev
```

Crear `.env.local` fuera del control de versiones:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<clave-anon>
```

El cliente se crea en `src/lib/supabase.ts` y rechaza el arranque si falta cualquiera de esas variables. La configuración local declara API `54321`, PostgreSQL `54322` y Studio `54323`. `npm run build` ejecuta comprobación de TypeScript y build de Vite; `npm run lint` usa oxlint y `npm test` ejecuta Vitest.

## Arquitectura frontend

| Capa | Ubicación | Responsabilidad |
|---|---|---|
| Arranque y rutas | `src/App.tsx` | Router, proveedor de autenticación y protección por rol. |
| Páginas | `src/pages` | Pantallas de estudiante, acceso y administración. |
| Componentes | `src/components/atoms`, `molecules`, `organisms` | UI reutilizable según Atomic Design. |
| Hooks | `src/hooks` | Consultas, RPC y estados de carga/error. |
| Cliente | `src/lib/supabase.ts` | Cliente Supabase con URL y clave anónima. |
| Tipos y utilidades | `src/types`, `src/utils` | Contratos TypeScript y exportación de reportes. |
| Presentación | `src/styles` y `src/locales` | Sistema visual CBA Tarija e internacionalización español/inglés. |

Las rutas públicas son `/register` y `/login`; `/student/login` redirige a `/login`. Las rutas de estudiante requieren el rol `student`: `/student`, `/student/history`, `/student/history/:attemptId` y `/student/exam/:attemptId`. Las rutas bajo `/admin` requieren `admin`: dashboard, estudiantes, preguntas, niveles, configuración, reportes y auditoría. Una sesión autenticada resuelve su rol con `get_current_principal()` a partir de las tablas de membresía propias, no de metadatos editables del usuario.

## Módulos actuales

| Módulo | Implementación real |
|---|---|
| Registro y acceso | Supabase Auth con correo/contraseña. El trigger de `auth.users` crea el perfil `student`; un administrador se reconoce por `admin`. |
| Examen | `start_exam`, `get_exam_attempt`, `save_exam_answer` y `submit_exam` son los únicos accesos del estudiante a su intento. |
| Historial | Proyecciones seguras `get_student_exam_history` y `get_student_exam_history_detail`. |
| Preguntas | CRUD directo de `question` y `question_option` para administradores, con auditoría por trigger. |
| Niveles | Edición de metadatos y reemplazo transaccional/versionado de la distribución activa. |
| Configuración | Lectura de la única fila de `exam_config` y actualización por RPC con revisión optimista. |
| Reportes | `get_admin_exam_report`; exportación CSV/XLSX en el navegador de fecha de finalización, nombre completo, CI, estado, puntaje y nivel CEFR, con protección contra fórmulas de hojas de cálculo. |
| Estudiantes | RPC paginadas para lista, detalle, historial de intentos y actualización exclusiva de nombre/teléfono. |
| Auditoría | Proyección paginada sin exponer `audit_log.details`. |

## Base de datos y ciclo del examen

Las migraciones `supabase/migrations/001_schema.sql` a `016_admin_student_management.sql` son la única fuente de verdad. El modelo contiene 14 tablas de aplicación, incluida `level_partition_revision`; se documenta en [modelo relacional](../database/modelo-relacional.md) y [diccionario de datos](../database/data-dictionary.md).

1. `start_exam(request_id)` valida al estudiante, serializa por estudiante y devuelve el intento existente para el mismo `request_id` o para uno ya en curso.
2. Rechaza un segundo examen completado en la misma fecha de negocio `America/La_Paz`.
3. Bloquea la configuración y el banco, exige preguntas con al menos dos opciones y exactamente una correcta, y crea snapshots de configuración, preguntas, opciones y niveles activos.
4. El servidor calcula `deadline_at`; el cliente nunca lo envía.
5. Guardar o recuperar un intento vencido lo finaliza antes de responder. Las preguntas sin respuesta cuentan como incorrectas.
6. La finalización persiste porcentaje, fecha y nivel desde `exam_level_snapshot`. Intentos completados y snapshots no se pueden actualizar ni eliminar.

`exam_config` es singleton, no puede borrarse y aumenta `revision` de uno en uno. `replace_active_level_distribution` exige que los rangos activos cubran exactamente 0 a 100, sin huecos ni solapamientos, y conserva versiones históricas. `passing_score` está almacenado en la configuración y en snapshots, pero la implementación actual no persiste ni muestra un estado aprobado/reprobado.

## Seguridad y autorización

| Control | Estado actual |
|---|---|
| Autenticación | Supabase Auth, sesión JWT y rotación de refresh token configurada localmente. |
| Autorización | `fn_is_admin`, `fn_assert_student`, RLS y privilegios explícitos. |
| Datos de examen | El estudiante usa RPC; no recibe la respuesta correcta ni selecciona filas base de examen/preguntas/opciones. |
| Históricos | Triggers impiden cambios o borrado de examen y respuestas finalizadas; snapshots son inmutables. |
| Auditoría | Cambios en preguntas/opciones, niveles, configuración y perfiles editables generan registros. |
| Datos sensibles | Reportes y auditoría se sirven mediante proyecciones; no exponen respuestas, teléfono/correo en reportes ni JSON de detalles de auditoría. |

Las funciones `SECURITY DEFINER` fijan `search_path` y verifican el rol antes de su operación. Los privilegios directos de tablas sensibles se revocan a `anon` y `authenticated`; no se debe crear una política o `GRANT` nuevo sin revisar este límite.

## Operación y backups

El backup diario es un `pg_dump` lógico consistente del esquema `public`, instalado como servicio systemd `cba-supabase-backup`. El timer corre a las 02:15, con demora aleatoria de hasta 15 minutos y recuperación tras una caída. Conserva diarios 14 días, semanales 8 semanas y mensuales 12 meses en `/var/lib/cba-supabase-backups` por defecto.

Cada backup contiene `database.dump`, manifiesto y HMAC. Credenciales y la clave HMAC viven fuera de Git, con permisos restrictivos. La restauración soportada es solo local: `scripts/restore-backup-local.sh --replace-local <directorio-backup>`. El procedimiento, instalación y simulacro están en [daily-backups.md](daily-backups.md); no debe interpretarse como recuperación remota de producción.

## Límites y mantenimiento pendiente

- No hay cuotas por nivel/categoría ni estado de activación para preguntas.
- El borrado físico de una pregunta puede ser bloqueado por referencias históricas; no existe desactivación de preguntas.
- El banco insuficiente se detecta al iniciar el examen, no al guardar la configuración.
- La configuración `passing_score` no produce hoy un resultado de aprobado/reprobado.
- Los PNG heredados de `database/` son obsoletos y no sustituyen `diagrama-uml.puml`; el esquema debe revisarse desde la fuente PlantUML o el modelo relacional vigente.
