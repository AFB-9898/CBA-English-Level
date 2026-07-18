# Plan de corrección: Gestión administrativa de niveles CEFR

**Estado:** Aprobado. La corrección base fue aplicada; esta enmienda aprobada corrige el flujo de desactivación señalado por `verify-report.md`. No autoriza implementación en este artefacto.

## Resumen ejecutivo

La corrección separa la autoridad de migraciones, reemplaza las mutaciones aisladas por una repartición atómica completa y conserva las rutas placeholder comprobadas. La migración correctiva debe ser nueva (`006`), no reescribir `005`, para no alterar historiales ya aplicados.

## Evidencia y auditoría previa de migraciones

Se compararon ambos directorios, `supabase/config.toml`, `package.json`, documentación y workflows (no existen workflows). `supabase/config.toml` tiene migraciones habilitadas y usa el directorio estándar `supabase/migrations/`.

| Archivo | Clasificación | Referencia activa | Acción propuesta |
|---|---|---|---|
| `database/migrations/001_schema.sql` | Duplicado de `supabase/migrations/001_schema.sql` | Sí: `database/README.md` | No borrar hasta corregir guía y validar reset oficial. |
| `database/migrations/002_seed.sql` | Duplicado funcional; difiere en comentario de admin | Sí: `database/README.md` | No borrar hasta corregir guía y validar reset oficial. |
| `database/migrations/.gitkeep` | Único, sin función al retirar el directorio | No | Borrar solo con los SQL anteriores. |
| `supabase/migrations/001`–`005` | Autoritativos; `003`–`005` son únicos | Sí: CLI/configuración Supabase | Conservar; añadir `006`. |

`README.md` y `README.es.md` contienen una ruta obsoleta `database/migrations/001_initial.sql`; `package.json`, configuración y workflows no tienen referencias vivas a la copia. La limpieza será una unidad independiente, presentada con este inventario antes de borrar.

## Decisiones técnicas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Nueva `006_admin_level_partition_correction.sql` | Editar `005` | Una migración aplicada es inmutable; `006` permite corrección y rollback trazable. |
| RPC `replace_active_level_distribution(p_expected_revision, p_levels jsonb)` | `create_level`/`replace_level_version` por fila | La partición 0–100 solo es válida como conjunto. |
| Fila singleton de revisión bloqueada `FOR UPDATE` + bloqueo asesor | Solo bloqueo asesor | Detecta cliente obsoleto; la segunda solicitud incompatible falla, no sobrescribe. |
| Placeholders como rutas registradas “Coming soon” | Enlaces inertes o eliminar rutas | `App.tsx` ya registra `/admin/students` y `/admin/audit-log`; no hay evidencia para retirarlas. |

## Flujo y contrato

```text
Range editor -> before/after + confirm -> RPC(full list, revision)
  -> admin auth -> lock/revision -> validate 0..100 -> version changed rows -> audit/commit
                                               └-> invalid/stale/error: rollback total
```

La RPC recibe **todas** las filas activas, con `id`, `min_score` y `max_score`, más la revisión leída. En una transacción valida: administrador, IDs activos únicos, mismo conjunto activo, enteros, orden, inicio 0, fin 100, contigüidad y ausencia de solapes. Solo para cada rango distinto desactiva la fila previa e inserta su siguiente versión con `supersedes_level_id`; las filas sin cambio conservan UUID y versión. `question` y `exam` siguen apuntando a filas históricas. Cualquier fallo, incluido conflicto de revisión, revierte filas, auditoría y revisión. Se revocan/retiran los RPC públicos que permitan rangos, alta o baja aislados; metadatos continúan en su RPC autorizada.

## UI y navegación

`LevelsScreen` sustituirá el formulario de rango individual por un editor de distribución: carga revisión y todos los activos, permite preparar límites coordinados, muestra tabla Antes/Después, valida solo ayudas locales y exige confirmación. Envía una única RPC; ante conflicto recarga sin aplicar cambios. La regla compatible será: **cada enlace del sidebar navega a su ruta registrada; Students y Audit Log son placeholders visibles con página “Coming soon” hasta su módulo**. Se debe corregir S3 y sus pruebas, no retirar rutas sin nueva evidencia.

## Unidades de trabajo y aceptación

| Fase (≤400 líneas) | Archivos previstos | Aceptación |
|---|---|---|
| 1. Auditoría/limpieza (≤180) | `database/README.md`, `README.md`, `README.es.md`, eliminar `database/migrations/{001_schema.sql,002_seed.sql,.gitkeep}` | Inventario aprobado; cero referencias activas; `supabase db reset` reconstruye solo desde oficial. |
| 2. Contrato BD (≤400) | crear `supabase/migrations/006_admin_level_partition_correction.sql` | RPC completa, revisión, RLS/GRANT, versiones selectivas y rollback; sin API de rango aislado. |
| 3. SQL RED/verde (≤320) | `supabase/tests/level_management.sql` | Repartición multi-nivel, solo versiones cambiadas, concurrencia/stale revision, rollback, auditoría y exámenes históricos. |
| 4. Hook/tipos (≤300) | `src/types/index.ts`, `src/hooks/useLevels.ts`, `src/hooks/__tests__/useLevels.test.tsx` | Contrato de distribución/revisión y error de conflicto tipados. |
| 5. Flujo UI (≤400) | `src/pages/LevelsScreen.tsx`, `src/pages/__tests__/LevelsScreen.test.tsx`, `src/locales/{es,en}.json` | Antes/después, confirmación, una RPC completa, error/recarga y éxito. |
| 6. Regla de rutas (≤220) | delta `specs/admin-sidebar/spec.md`, `src/App.tsx`, `src/pages/AdminLayout.tsx`, `src/__tests__/App.test.tsx`, `src/pages/__tests__/AdminLayout.test.tsx` | Cinco enlaces; gestionados y placeholders navegan conforme a la regla. |

## Verificación, riesgos y decisiones pendientes

Ejecutar `sg docker -c 'supabase db reset'`, prueba SQL con dos sesiones reales, `npx vitest run`, `npm run build` y `git diff --check` desde árbol atribuible. Riesgos: migración `005` ya aplicada, documentación usada manualmente, y cambio de producto en placeholders.

**Decisiones requeridas:**
- [ ] Confirmar si `005` llegó a staging/producción (define el protocolo de despliegue de `006`).
- [ ] Aprobar retirar la guía/manual legado junto con `database/migrations/` tras el reset oficial.
- [ ] Aprobar la regla de placeholders con ruta registrada; si se desea enlace inerte, debe cambiarse explícitamente la ruta existente y S3.

## Enmienda aprobada — desactivación mediante repartición atómica

`deactivate_level` **no se restaura**. Se extiende `replace_active_level_distribution` en `supabase/migrations/006_admin_level_partition_correction.sql` para recibir la lista activa completa, `p_expected_revision` y el UUID opcional a desactivar. El backend bloquea revisión/activos, comprueba `fn_is_admin()` y calcula la única redistribución permitida: la fila objetivo pasa a histórica e inactiva; solo vecinos activos inmediatos absorben su rango; con dos, el inferior recibe `floor(ancho/2)` y el superior `ceil(ancho/2)`; en borde el único recibe todo. El payload debe excluir el objetivo y coincidir con ese cálculo. Vecinos modificados obtienen nueva versión; los demás conservan UUID/versión.

La misma transacción inserta auditoría `deactivate` con actor `auth.uid()` y before/after confiables, mantiene auditorías `new_version`, preserva FK de preguntas/exámenes y revierte filas, auditorías y revisión ante payload inválido, falta de permisos o `40001` stale. La UI en `src/pages/LevelsScreen.tsx` prepara/muestra Antes/Después, confirma y llama una vez al hook `src/hooks/useLevels.ts`; conflicto recarga y falla no informa éxito.

| Unidad ≤400 líneas | Archivos exactos | Criterios de aceptación |
|---|---|---|
| BD + contrato SQL | `supabase/migrations/006_admin_level_partition_correction.sql`, `supabase/tests/level_management.sql` | Vecinos/bordes/impar, UUID selectivos, FK, auditoría, RLS, stale y rollback total. |
| Tipos y hook | `src/types/index.ts`, `src/hooks/useLevels.ts`, `src/hooks/__tests__/useLevels.test.tsx` | Objetivo tipado, una RPC, error stale y recarga. |
| UI | `src/pages/LevelsScreen.tsx`, `src/pages/__tests__/LevelsScreen.test.tsx`, `src/locales/es.json`, `src/locales/en.json` | Preview, confirmación, una llamada, error/success reales; sin mock de método inexistente. |

**Tareas:** reabrir 2–5; sus afirmaciones de terminación quedan superseded exclusivamente en la subfunción de desactivación. Mantener 1 y 6 cerradas/válidas.

## Matriz de amenazas

N/A — la navegación React no ejecuta shell, subprocesos, VCS/PR ni clasificación de ejecutables. Las cinco fronteras de la matriz (paths documentales, selección Git, estado commit, push y comandos PR) son N/A por esa razón.
