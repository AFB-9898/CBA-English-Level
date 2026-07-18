# Diseño: Enmienda de desactivación por repartición atómica

## Enfoque técnico
Se corrige el fallo CRITICAL de `verify-report.md`: desactivar no será una RPC aislada. `replace_active_level_distribution` seguirá siendo la única mutación de partición y recibirá revisión esperada, distribución completa y `p_deactivate_level_id` opcional.

## Decisiones de arquitectura

| Decisión | Alternativa | Razón |
|---|---|---|
| Extender la RPC existente en `006` | Restaurar `deactivate_level` | Conserva una sola transacción y evita estados inválidos. |
| Calcular y validar en SQL la redistribución | Confiar en el payload/UI | La regla y los límites son críticos de seguridad. |
| Conservar la fila objetivo inactiva | Borrarla o versionarla activa | Preserva UUID y enlaces históricos de `question`/`exam`. |

## Flujo, concurrencia y seguridad
```text
UI Antes/Después -> hook -> replace_active_level_distribution(revisión, lista, objetivo)
 -> auth admin + locks -> valida distribución calculada -> inactiva objetivo/versiona vecinos/audita -> commit
                                                        -> error o revisión stale: rollback total
```

Con objetivo no nulo, SQL bloquea los activos y exige al menos un vecino. Ordenados por rango previo, solo los vecinos activos inmediatos absorben el intervalo: dos vecinos reciben `floor(ancho/2)` abajo y `ceil(ancho/2)` arriba (el impar va al superior); en borde el único recibe todo. El `p_levels` excluye el objetivo y debe coincidir exactamente con ese resultado; los demás UUID/versiones no cambian. Conserva `fn_is_admin()`, `SECURITY DEFINER`, `search_path`, bloqueo asesor + `FOR UPDATE`, y error `40001`. Inserta auditoría confiable de acción `deactivate` con `auth.uid()`, before/after del objetivo; las nuevas versiones de vecinos mantienen su auditoría. Cualquier excepción revierte filas, auditorías y revisión.

## Archivos y aceptación

| Archivo | Acción | Aceptación |
|---|---|---|
| `supabase/migrations/006_admin_level_partition_correction.sql` | Modificar | Nueva firma/validación de desactivación atómica; sin RPC aislada; rollback y auditoría íntegros. |
| `supabase/tests/level_management.sql` | Modificar | Dos vecinos, borde, impar hacia superior, UUID selectivos, FK histórica, actor/before/after, no-admin, stale y rollback. |
| `src/types/index.ts`, `src/hooks/useLevels.ts`, `src/hooks/__tests__/useLevels.test.tsx` | Modificar | Payload tipado de objetivo, una RPC y recarga en `40001`. |
| `src/pages/LevelsScreen.tsx`, `src/pages/__tests__/LevelsScreen.test.tsx`, `src/locales/{es,en}.json` | Modificar | Preview Antes/Después calculado, confirmación, una llamada, éxito/error y ninguna falsa confirmación. |

## Unidades, tareas y rollout
Reabrir tareas 2–5; sus entregas quedan **superseded solo para desactivación**. Las tareas 1 y 6 permanecen válidas. Entregar en tres unidades ≤400 líneas: BD+SQL (2–3), tipos/hook, UI+i18n+test. Aplicar primero local/staging y ejecutar reset, SQL de dos sesiones, Vitest y build; no rollback destructivo de histórico.

## Matriz de amenazas
N/A — no cambia shell, subprocesos, VCS/PR, clasificación de ejecutables ni integración de procesos.
