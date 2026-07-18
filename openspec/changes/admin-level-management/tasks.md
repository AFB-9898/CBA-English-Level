# Tareas: Gestión administrativa de niveles CEFR

## Trazabilidad y Review Workload Forecast

Las tareas originales 1.1 y 1.2 quedan **superseded**: no se reescribe `005` y la limpieza espera documentación corregida y reset oficial. Responde a CRITICAL 1–4 y WARNING 1–3 de `verify-report.md`.

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

## 1. Limpieza de migraciones duplicadas
- **Objetivo:** retirar la copia no autoritativa solo después del inventario, referencias corregidas y reset oficial.
- **Archivos:** modificar `database/README.md`, `README.md`, `README.es.md`; eliminar `database/migrations/001_schema.sql`, `002_seed.sql`, `.gitkeep`.
- **Dependencias:** diseño-correction; aprobación de limpieza; migración 006 no depende de esta eliminación.
- **Aceptación/pruebas/orden:** cero referencias; reset reconstruye desde `supabase/migrations/`; revisar diff: inventariar → guías → reset → borrar.
- **Estimación/rollback:** 120–180 líneas; cabe ≤400. Revertir solo guías y eliminación del directorio.

## 2. Migración 006 para repartición atómica completa
- **Estado:** REOPENED; supersede desactivación previa; conservar su historial.
- **Objetivo (layer: supabase/database):** actualizar `006` con una RPC (revisión, lista activa, objetivo opcional), cálculo SQL determinista (`floor/ceil`, impar al superior, borde absorbe todo) y ningún overload público obsoleto.
- **Archivos/dependencias:** `supabase/migrations/006_admin_level_partition_correction.sql`; depende de 005/C2. **Aceptación/orden:** locks, auth/RLS/GRANT, IDs/FK, auditoría actor/before/after, vecinos/versiones selectivos y rollback; firma → locks → cálculo → versiones → permisos.
- **Pruebas/estimación/rollback:** `sg docker -c 'supabase test db'` después de bloque 3; 190–240 líneas incl. SQL, ≤400. Revertir solo `006`; no editar `005`.

## 3. Pruebas SQL
- **Estado:** REOPENED; supersede aserciones de baja aislada; conservar pruebas históricas.
- **Objetivo (layer: database):** añadir RED/verde en `supabase/tests/level_management.sql` para medio, ambos bordes y split impar superior; UUID/versiones selectivos, FK y auditoría confiable.
- **Dependencias/aceptación:** bloque 2 + reset; probar payload obligatorio, no-admin, stale `40001`, rollback de filas/auditoría/revisión y dos sesiones (máximo un éxito), sin owner.
- **Pruebas/estimación/rollback:** `sg docker -c 'supabase test db'`; 220–300 líneas incl. fixtures, ≤400. Retirar solo fixtures/aserciones nuevas.

## 4. Hook y tipos TypeScript
- **Estado:** REOPENED; supersede solo `deactivateLevel`; conservar metadata/distribución.
- **Objetivo (layer: frontend):** tipar objetivo en `ReplaceActiveLevelDistributionInput`, enviarlo por la misma RPC y mapear `40001`/refetch; no exponer `deactivate_level`.
- **Archivos/dependencias/aceptación:** `src/types/index.ts`, `src/hooks/useLevels.ts`, `src/hooks/__tests__/useLevels.test.tsx`; depende de 2–3. Payload con `p_deactivate_level_id`, una RPC, conflicto y recarga.
- **Pruebas/estimación/rollback:** RED/verde: `npx vitest run src/hooks/__tests__/useLevels.test.tsx`; 90–150 líneas incl. tests, ≤400. Revertir esos tres archivos.

## 5. UI de ajuste de rangos
- **Estado:** REOPENED; supersede solo botón/mensaje no-op; preservar editor válido.
- **Objetivo (layer: frontend):** en `LevelsScreen` mostrar Antes/Después, confirmar desactivación, llamar una vez al hook y mostrar éxito solo con respuesta exitosa; error/stale no da falso éxito.
- **Archivos/dependencias/aceptación:** `src/pages/LevelsScreen.tsx`, `src/pages/__tests__/LevelsScreen.test.tsx`, `src/locales/es.json`, `src/locales/en.json`; depende de 4 + distribución/revisión. Cubrir middle/borde/odd, cancelación, objetivo, una confirmación/RPC, error y refetch; sin mock obsoleto.
- **Pruebas/estimación/rollback:** `npx vitest run src/pages/__tests__/LevelsScreen.test.tsx`; runtime `npm run build`; 150–220 líneas incl. tests/i18n, ≤400. Revertir pantalla, locales y prueba.

## 6. Regla definitiva de rutas
- **Objetivo:** conservar cinco enlaces navegables; Students/Audit Log son placeholders registrados “Coming soon”, no enlaces inertes.
- **Archivos:** modificar `src/App.tsx`, `src/pages/AdminLayout.tsx`, `src/__tests__/App.test.tsx`, `src/pages/__tests__/AdminLayout.test.tsx`; no eliminar rutas. Alinear con `specs/admin-sidebar/spec.md` ya corregida.
- **Dependencias:** bloque 5; delta S1/S3/S5.
- **Aceptación/pruebas/orden:** cinco rutas, Questions/Levels gestionadas, placeholders navegables y activo bilingüe; RED → rutas → sidebar → regresión.
- **Estimación/rollback:** 160–220 líneas; cabe ≤400. Revertir solo routing/sidebar y sus pruebas.
