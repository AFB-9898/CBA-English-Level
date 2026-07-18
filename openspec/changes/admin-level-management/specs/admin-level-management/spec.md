# Gestión de niveles CEFR — especificación y corrección

## Propósito

Administrar niveles CEFR con partición determinista, historial preservado, autorización y auditoría. Esta enmienda conserva los requisitos originales y responde a los hallazgos CRITICAL 1–4 y WARNING 1–3 de `verify-report.md`, conforme a `design-correction.md`.

## Requisitos originales

### Requisito L1 — Catálogo y cobertura
La base SHALL iniciar con A1–C1. Los activos MUST cubrir cada entero 0–100 exactamente una vez, sin huecos, solapes ni límites inválidos.

#### Escenario: catálogo o rango inválido
- GIVEN una migración nueva o un cambio de rango
- WHEN se carga el catálogo o la propuesta viola 0–100, orden, continuidad o unicidad
- THEN A1–C1 queda determinista o la operación falla atómicamente sin modificar activos

### Requisito L2 — Versionado e integridad histórica
Un nivel referenciado por preguntas, exámenes o resultados MUST conservar su referencia. Metadatos MAY cambiar; un rango MUST crear versión, desactivar la anterior y nunca eliminarla.

#### Escenario: referencia histórica
- GIVEN un nivel referenciado
- WHEN cambia metadata o rango
- THEN la referencia histórica permanece; el rango crea versión nueva y desactiva la anterior

### Requisito L3 — Autorización y auditoría
Solo administradores autenticados SHALL mutar niveles. Cada creación, edición, desactivación y versionado MUST registrar actor, acción, before/after y timestamp mediante auditoría íntegra no editable por el cliente.

#### Escenario: mutación autorizada o rechazada
- GIVEN una mutación autorizada o un usuario no administrador
- WHEN se intenta mutar o auditar
- THEN la primera produce exactamente un evento al confirmar y la segunda es rechazada sin auditoría

### Requisito L4 — Migraciones y clasificación
`supabase/migrations/` SHALL ser la fuente autoritativa. La clasificación MUST usar solo activos válidos y conservar resultados históricos.

#### Escenario: reconstrucción y clasificación
- GIVEN instalación oficial y un puntaje entero 0–100
- WHEN se reconstruye y clasifica
- THEN se obtiene el catálogo/invariantes/RLS/auditoría esperados y exactamente una versión activa

### Requisito L5 — Verificación del contrato
La entrega MUST cubrir migración/RLS, límites, huecos, solapes, versionado, desactivación, auditoría, concurrencia y clasificación.

#### Escenario: concurrencia
- GIVEN dos administradores modifican rangos incompatibles
- WHEN confirman simultáneamente
- THEN como máximo una operación tiene éxito y nunca queda partición inválida

## Enmiendas aprobadas

### Requisito C1 — Migración y limpieza separadas
La corrección MUST crear `006_admin_level_partition_correction.sql` y MUST NOT reescribir `005` local-only. La auditoría de duplicados SHALL conservarse; `database/migrations/` solo MAY eliminarse en otra unidad, después del reset oficial y de corregir referencias documentales.

#### Escenario: limpieza condicionada
- GIVEN `005` puede estar aplicada y el inventario documenta duplicados
- WHEN se prepara o ejecuta la limpieza
- THEN `006` se añade sin reescribir `005`, y la copia solo se elimina tras validar oficialmente `supabase db reset`

### Requisito C2 — Repartición completa atómica
Una única RPC autorizada SHALL recibir todos los rangos activos 0–100 y la revisión esperada. En una transacción MUST validar autorización, conjunto/IDs, enteros, límites, continuidad, solapes y concurrencia; solo versionar rangos cambiados, conservar FK históricas y revertir todo, incluida auditoría y revisión, ante cualquier fallo.

#### Escenario: distribución válida o obsoleta
- GIVEN un administrador prepara una tabla Antes/Después completa
- WHEN confirma una distribución válida o una revisión obsoleta
- THEN se versionan solo cambios y se preservan preguntas/exámenes, o falla sin cambios parciales

### Requisito C3 — UI y evidencia obligatoria
La UI SHALL preparar la distribución, mostrar Antes/Después, exigir confirmación y enviar una sola RPC completa. La verificación MUST demostrar reset oficial, repartición multi-nivel, versionado/historial, dos sesiones reales, rollback/auditoría y flujo UI extremo a extremo; una falla impide finalizar.

#### Escenario: confirmación y verificación
- GIVEN una propuesta válida o inválida
- WHEN el administrador confirma y se ejecutan las comprobaciones requeridas
- THEN se envía una sola distribución, se muestra éxito/error con recarga en conflicto y queda evidencia registrada
