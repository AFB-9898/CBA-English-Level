# Delta for Admin Sidebar

## MODIFIED Requirements

### Requirement: S3 — Placeholder Links

Las entradas de Students y Audit Log SERÁN placeholders — no se registran rutas todavía. La entrada de Questions SHALL navegar a `/admin/questions` (ya no es placeholder). Todos los links SHALL ser visualmente distinguibles del link activo de Dashboard.

(Previously: Las tres entradas (Students, Questions, Audit Log) eran placeholders apuntando a `#`)

#### Scenario: S3-P — Placeholder links sin ruta

- GIVEN no existe ruta registrada para `/admin/students` o `/admin/audit-log`
- WHEN el sidebar renderiza
- THEN al hacer clic en "Students" no se navega fuera de `/admin`
- AND al hacer clic en "Audit Log" no se navega fuera de `/admin`

#### Scenario: S3-Q — Questions navega a ruta funcional

- GIVEN el sidebar renderiza
- WHEN el administrador hace clic en "Questions"
- THEN se navega a `/admin/questions`
- AND el link "Questions" muestra estilo activo/highlighted en esa ruta
