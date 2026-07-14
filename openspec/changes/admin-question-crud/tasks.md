# Tasks: Admin Question CRUD

## Review Workload Forecast (Enmienda)

| Field | Value |
|-------|-------|
| Estimated changed lines (restante) | ~500 (300 + 200) |
| 400-line budget risk | **Medium** (cada PR individual ≤400) |
| Chained PRs recommended | Yes |
| Suggested split | PR 3 → PR 4 (feature-branch-chain) |
| Delivery strategy | ask-always |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No (ya autorizado por usuario)
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Base Branch | Status |
|------|------|-----------|-------------|--------|
| 1 | Types, hooks, i18n foundation | PR 1 | `feat/admin-question-crud` (tracker) | ✅ Committed |
| 2 | Listado, fila, screen principal | PR 2 | PR 1 branch | ✅ Committed |
| 3 | useQuestionForm + QuestionOptionList | PR 3 | PR 2 branch | ✅ Committed |
| 4 | QuestionForm rewrite + Routes + Delete + FK RESTRICT | PR 4 | PR 3 branch | ⏳ Pendiente |

---

## PR 1 — Foundation: Types + Hooks + i18n ✅

*(Committed — ver tasks.md anterior)*

---

## PR 2 — List View: QuestionRow + QuestionsScreen ✅

*(Committed — ver tasks.md anterior)*

---

## PR 3 — Form Hook + Option List Molecule (~300 líneas) ✅

### Phase 6A: useQuestionForm Hook

- [x] 6A.1 Crear `src/hooks/useQuestionForm.ts` — hook que encapsula: estado del form (text, levelId, category, options, errors, submitting, loadingQuestion, notFound), validación, fetch de edición (useEffect), submit handlers (create/edit) delegando a `useQuestions.createQuestion`/`updateQuestion`, y option management (add/remove/updateText/selectCorrect)
- [x] 6A.2 Implementar mitigación no-atómica edit: antes de delete opciones viejas, guardarlas en variable local; si insert nuevas falla, re-insertar guardadas
- [x] 6A.3 Implementar mitigación no-atómica create: si insert opciones falla, ejecutar delete de pregunta huérfana
- [x] 6A.4 Nunca navegar a `/admin/questions` hasta que TODOS los pasos completen exitosamente
- [x] 6A.5 Escribir tests: `useQuestionForm.test.tsx`
  - Create: validación (sin texto, sin nivel, sin correcta, <4 opciones)
  - Create: submit exitoso → llama `useQuestions.createQuestion`
  - Create: error de Supabase en create → retorna error, no navega
  - Edit: fetch exitoso → pre-carga datos
  - Edit: not found → set notFound
  - Edit: submit exitoso → llama `useQuestions.updateQuestion`
  - Edit: error en update → retorna error
  - Edit: error en insert opciones nuevas → intenta rollback de opciones viejas
  - FK RESTRICT: deleteQuestion retorna code '23503'

### Phase 6B: QuestionOptionList Molecule

- [x] 6B.1 Crear `src/components/molecules/QuestionOptionList.tsx` — molécula que renderiza: lista de opciones (radio + text input + remove button), botón "Agregar opción", muestra errores por opción
- [x] 6B.2 Props: `options: QuestionOptionFormData[]`, `errors: Record<string, string>`, `disabled: boolean`, `onAdd`, `onRemove`, `onUpdateText`, `onSelectCorrect`
- [x] 6B.3 Estilos Tailwind responsive (mobile: stacked, desktop: inline)
- [x] 6B.4 Escribir tests: `QuestionOptionList.test.tsx`
  - Renderiza N opciones con radio + text
  - Click add → llama onAdd
  - Click remove → llama onRemove con índice
  - Typing text → llama onUpdateText con índice y valor
  - Click radio → llama onSelectCorrect con índice
  - Muestra error de validación por opción
  - Disabled state deshabilita todos los inputs

### Review Fixes (PR 3)

- [x] CRITICAL: Fix rollback data integrity — preserve original `question_option.id` in `updateQuestion` re-insert
- [x] W2: Replace hardcoded `'required'` with `t('questions.validation.optionTextRequired')` in useQuestionForm
- [x] Add bilingual `optionTextRequired` keys to en.json and es.json validation sections
- [x] Add focused tests: orphan cleanup on create failure + rollback with preserved IDs on edit failure
- [x] Defer pre-work locale keys (createTitle, editTitle, notFound, backToList, loadingQuestion) to PR 4
- [x] Budget: 399 changed lines (under 400-line limit)

### Verification PR 3

```bash
npm run build    # Compila sin errores
npx vitest run   # 22 test files, 143 tests passed
```

**Rollback**: Eliminar `useQuestionForm.ts`, `useQuestionForm.test.tsx`, `QuestionOptionList.tsx`, `QuestionOptionList.test.tsx`. Sin impacto — hook y molécula no están conectados a UI aún.

---

## PR 4 — Form Rewrite + Routes + Delete + FK RESTRICT (~200 líneas)

### Phase 6C: QuestionForm Rewrite

- [ ] 6C.1 **REESCRIBIR** `src/components/organisms/QuestionForm.tsx` — reemplazar el actual (401 líneas) por versión reducida (~80 líneas) que: compone `useQuestionForm` + `QuestionOptionList`, renderiza campos básicos (textarea, select level, input category), maneja loading/not-found states, delega toda la lógica al hook
- [ ] 6C.2 **REESCRIBIR** `src/components/organisms/__tests__/QuestionForm.test.tsx` — reemplazar el actual (360 líneas) por versión reducida (~60 líneas) que testa: integración completa (render → fill → submit → navigate), modo edit con pre-fill, not-found state
- [ ] 6C.3 Verificar: QuestionForm YA NO llama `supabase.from(...)` directamente — toda CRUD pasa por `useQuestionForm` → `useQuestions`

### Phase 6D: FK RESTRICT Mapping

- [ ] 6D.1 Modificar `src/hooks/useQuestions.ts`: `deleteQuestion` retorna `{ error: string | null, code?: string }`. Extraer `dError.code` del objeto de error de Supabase
- [ ] 6D.2 Actualizar test `useQuestions.test.tsx`: agregar test para `deleteQuestion` con error FK RESTRICT (code '23503')
- [ ] 6D.3 Modificar `src/pages/QuestionsScreen.tsx`: en handler de delete, verificar `result.code === '23503'` y mostrar `t('questions.errors.fkRestrict')` en vez del error genérico

### Phase 7: Delete Flow

- [ ] 7.1 Conectar botón eliminar en `QuestionRow` → `window.confirm()` → `useQuestions.deleteQuestion()` → refetch
- [ ] 7.2 Manejar respuesta: success → refetch; FK RESTRICT → toast/error message; otro error → toast/error message
- [ ] 7.3 Actualizar `QuestionsScreen.test.tsx`: agregar tests para flujo de eliminación (confirm → delete → refetch, FK RESTRICT → error message)

### Phase 8: Rutas y Wiring

- [ ] 8.1 Modificar `src/App.tsx`: reemplazar `PlaceholderPage` en `/admin/questions` con `QuestionsScreen`; agregar rutas anidadas `/admin/questions/new` y `/admin/questions/:id/edit`
- [ ] 8.2 Actualizar `QuestionsScreen` para renderizar `QuestionForm` en rutas create/edit (routing interno con `Routes`/`Route`)
- [ ] 8.3 Conectar `handleEdit` en QuestionsScreen → `navigate(\`/admin/questions/${id}/edit\`)`
- [ ] 8.4 Verificar sidebar: link "Questions" navega a `/admin/questions` con estilo activo (spec S3-Q)

### Verification PR 4

```bash
npm run build
npx vitest run
# Manual completo: crear pregunta → aparece en listado → editar → guardar → eliminar → confirmar
# Deep link: /admin/questions/:id/edit carga pregunta correcta
# FK RESTRICT: intentar eliminar pregunta usada en examen → mensaje amigable
# Error paths: simular error de red en create/edit → muestra error sin navegar
```

**Rollback**: Revertir `QuestionForm.tsx` a versión no-commiteada (o eliminar); revertir `App.tsx` rutas; revertir `useQuestions.ts` deleteQuestion signature. Vuelve a estado PR 2 + hooks/molécula sin conectar.

---

## Archivos que DEBEN ser reescritos (no commitearse as-is)

| Archivo Actual | Líneas | Acción | Reemplazo |
|----------------|--------|--------|-----------|
| `src/components/organisms/QuestionForm.tsx` | 401 | **REESCRIBIR** | Versión ~80 líneas que delega a useQuestionForm + QuestionOptionList |
| `src/components/organisms/__tests__/QuestionForm.test.tsx` | 360 | **REESCRIBIR** | Versión ~60 líneas de test integración |

**Razón**: Ambos exceden el budget de 400 líneas. La lógica extraída vive en `useQuestionForm` (test independiente) y `QuestionOptionList` (test independiente), manteniendo coherencia de Atomic Design con tests propios por componente.
