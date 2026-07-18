# Propuesta: Gestión administrativa de niveles CEFR

## Intención

Permitir que administradores gestionen niveles CEFR sin alterar exámenes históricos ni crear clasificaciones ambiguas. Debe cubrir continuamente los puntajes enteros 0–100.

## Alcance

### Incluye
- Migración oficial con A1–C1, estado, versión y validación atómica de rangos.
- Un nivel referenciado solo cambia nombre/descripción; cambiar rango crea versión y desactiva la anterior. Nunca se elimina.
- Auditoría automática de creación, edición, desactivación y versionado con administrador, acción, valores antes/después y fecha.
- Ruta `/admin/levels`, navegación, UI bilingüe y pruebas; preguntas usan niveles activos y retienen referencias.
- Retiro de `database/migrations/`; documentación derivada de migraciones oficiales.

### No incluye
- Modificar resultados, preguntas o exámenes históricos.
- Rediseñar la pantalla de auditoría, C2 u otros niveles futuros, ni Edge Functions.

## Capacidades

### Nuevas capacidades
- `admin-level-management`: administración versionada y auditable de niveles CEFR y sus rangos.

### Capacidades modificadas
- `admin-sidebar`: agrega acceso activo a Niveles.
- `admin-question-management`: consume niveles activos sin romper referencias históricas.

## Enfoque

Primero, ampliar `level` con estado/versión, sembrar A1–C1 y usar funciones/triggers SQL bajo RLS para validar 0–100, versionar rangos referenciados y registrar `audit_log`. Ajustar clasificación a versiones activas. El frontend consume ese contrato y muestra sus errores; no valida reglas críticas por sí solo.

## Áreas afectadas

| Área | Impacto | Descripción |
|---|---|---|
| `supabase/migrations/` | Modificada | Esquema, seed, funciones, RLS y auditoría. |
| `database/migrations/` | Eliminada | Se retira la copia no autoritativa. |
| `src/hooks/useLevels.ts`, `src/types/index.ts` | Modificada | Lectura, mutaciones y tipos de estado/versión. |
| `src/App.tsx`, `src/pages/` | Modificada/Nueva | Ruta, enlace y pantalla. |
| `src/locales/{es,en}.json`, pruebas | Modificada/Nueva | Textos y cobertura. |

## Riesgos

| Riesgo | Prob. | Mitigación |
|---|---|---|
| Migración rompe clasificación | Media | Probar límites 0/100, huecos, solapes y rollback. |
| Historial pierde trazabilidad | Baja | Versionar, desactivar y auditar en trigger. |
| Cambio supera revisión manejable | Alta | Entregar en PRs encadenados. |

## Plan de rollback

Revertir antes de habilitar UI; si hubo uso, desactivar acceso y conservar filas/auditorías. No borrar historial ni migrar `database/migrations/`.

## Dependencias

- Administración autenticada existente y RLS de `admin`.

## Criterios de éxito

- [ ] Los niveles activos cubren 0–100 sin huecos ni solapes y clasifican determinísticamente.
- [ ] Las operaciones exigidas quedan auditadas y preservan referencias históricas.
- [ ] Un administrador gestiona niveles desde `/admin/levels` sin debilitar RLS.

## Pronóstico y carga de revisión

Estimación: 1.200–1.700 líneas (SQL 350–550; UI/hooks 450–700; i18n/pruebas 400–450). PR 1 contrato SQL (≤400), PR 2 hook/tipos/UI (≤400), PR 3 integración/documentación (≤400; subdividir si excede).

Decision needed before apply: Yes
Chained PRs recommended: Yes
400-line budget risk: High
