# Diseño: Admin Question CRUD — Enmienda

## Motivo

`QuestionForm.tsx` (401 líneas) + test (360 líneas) = 761 líneas combinadas excede el budget de 400 por PR. Usuario autorizó reestructurar en unidades ≤400 líneas incluyendo tests.

## Estado de Archivos

| Archivo | Líneas | Estado |
|---------|--------|--------|
| `hooks/useQuestions.ts` + test | 194 + 220 | ✅ Committed |
| `hooks/useLevels.ts` + test | 53 + 96 | ✅ Committed |
| `molecules/QuestionRow.tsx` + test | 79 + 155 | ✅ Committed |
| `pages/QuestionsScreen.tsx` + test | 203 + 221 | ✅ Committed |
| `organisms/QuestionForm.tsx` | **401** | ❌ NO COMMIT |
| `organisms/__tests__/QuestionForm.test.tsx` | **360** | ❌ NO COMMIT |

## Decisiones de Arquitectura

| Decisión | Elección | Justificación |
|----------|----------|---------------|
| Decomposición | Extraer `useQuestionForm` hook + `QuestionOptionList` molécula | create/edit comparten 90% de lógica; un hook + molécula reduce más |
| QuestionForm usa useQuestions | Hook delega a `useQuestions.createQuestion/updateQuestion` | Elimina llamadas Supabase directas duplicadas |
| FK RESTRICT mapping | `deleteQuestion` retorna `{ error, code? }`; caller mapea `'23503'` → i18n | Hook no es componente — no puede usar `useTranslation` |
| Mitigación no-atómica | Save old options en memoria; re-insert si new insert falla | Frontend-only; consistencia estricta requiere Edge Function futura |
| ConfirmDelete | `window.confirm()` nativo | Issue separado para modal accesible |

## Flujo de Datos

```
QuestionForm → useQuestionForm(mode, questionId)
                  ├── validate()
                  ├── [edit] useEffect: fetch question + options
                  ├── [create] useQuestions.createQuestion()
                  │     └── si options insert falla → delete orphan
                  ├── [edit] save oldOptions → updateQuestion()
                  │     └── si new insert falla → re-insert oldOptions
                  └── option mgmt (add/remove/select)

QuestionOptionList ← options, errors, disabled, callbacks
```

## Cambios de Archivos

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `hooks/useQuestionForm.ts` | Crear | Estado form, validación, fetch edit, submit, option mgmt (~100 líneas) |
| `hooks/__tests__/useQuestionForm.test.tsx` | Crear | Tests: validación, submit, error paths, FK RESTRICT, rollback (~80 líneas) |
| `molecules/QuestionOptionList.tsx` | Crear | Lista dinámica opciones: radio + text + add/remove (~70 líneas) |
| `molecules/__tests__/QuestionOptionList.test.tsx` | Crear | Tests: add/remove, radio, min/max, disabled (~50 líneas) |
| `organisms/QuestionForm.tsx` | **Reescribir** | Reducir a ~80 líneas: componer hook + molécula + campos |
| `organisms/__tests__/QuestionForm.test.tsx` | **Reescribir** | Reducir a ~60 líneas: test integración |
| `hooks/useQuestions.ts` | Modificar | `deleteQuestion` retorna `{ error, code? }` |
| `App.tsx` | Modificar | Reemplazar PlaceholderPage + rutas anidadas |

## Unidades de Trabajo

```
PR #1: Types + Hooks + i18n       ← ✅ COMMITTED
PR #2: List + Row + Screen        ← ✅ COMMITTED
PR #3: useQuestionForm + OptionList  ← 📍 ~300 líneas
PR #4: Form rewrite + Routes + Delete  ← ~200 líneas
```

| PR | Alcance | Est. | Dependencia |
|----|---------|------|-------------|
| PR 3 | `useQuestionForm.ts` + test, `QuestionOptionList.tsx` + test | ~300 | PR 2 |
| PR 4 | `QuestionForm.tsx` rewrite + test, `App.tsx`, delete flow, FK RESTRICT, `useQuestions.ts` update | ~200 | PR 3 |

## Corrección de Gaps

### Edit-submit test faltante
`useQuestionForm.test.tsx` incluirá: edit submit exitoso, error en update, error en insert opciones, rollback de opciones viejas.

### Error-path coverage
Tests para: Supabase error en create (pregunta + opciones), edit (update + delete + insert), network error.

### FK RESTRICT mapping
`deleteQuestion` retorna `{ error, code? }`. Caller verifica `code === '23503'` → `t('questions.errors.fkRestrict')`. Key i18n ya existe.

### No-atómico create/edit
- **Create**: Si insert opciones falla → delete pregunta huérfana (cleanup best-effort)
- **Edit**: Guardar `savedOptions` antes de delete. Si insert nuevas falla → re-insert `savedOptions` con IDs originales
- **Ambos**: Nunca navegar hasta éxito total

## Archivos que DEBEN ser reescritos

- `QuestionForm.tsx` (401 líneas) → versión ~80 líneas delegando a hook + molécula
- `QuestionForm.test.tsx` (360 líneas) → versión ~60 líneas de integración

## Preguntas Cerradas

- [x] Confirmación: `window.confirm()` mantenido
- [x] FK RESTRICT: mapeo `23503` → i18n documentado
- [x] No-atómico: mitigación frontend documentada
- [x] QuestionForm debe usar `useQuestions`, no Supabase directo
