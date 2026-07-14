# Diseño: Admin Question CRUD

## Enfoque Técnico

Implementación del CRUD completo de preguntas MCQ en el frontend, siguiendo la arquitectura existente: Atomic Design, hooks directos a Supabase (sin capa de servicios), i18n bilingüe, y rutas anidadas bajo `/admin`. El cambio se divide en **3 PRs encadenados** para respetar el presupuesto de 400 líneas por review.

## Decisiones de Arquitectura

| Decisión | Opción Elegida | Alternativas | Justificación |
|----------|----------------|--------------|---------------|
| Organización de rutas | Rutas anidadas en `App.tsx` | Lazy loading con `React.lazy` | Consistente con `DashboardScreen`; el lazy loading se implementará en un futuro change transversal |
| Hook CRUD vs servicios | Hook directo con Supabase client | Capa de servicios intermedia | Sigue el patrón de `useDashboardStats` — no hay servicios en el proyecto actual |
| Estado del formulario | `useState` local en `QuestionForm` | React Hook Form / Zustand | Sin dependencias nuevas; el formulario es lo suficientemente simple para un `useState` controlado |
| Confirmación de eliminación | Modal inline con `confirm()` nativo | Componente modal custom | Para esta fase, `window.confirm()` reduce líneas. Un modal accesible se puede añadir después |
| Paginación | Paginación server-side con Supabase `range()` y count exacto | Paginación client-side con 10 items/página | Server-side es más escalable; el hook `useQuestions` usa `range()` + `count: 'exact'` para paginar en la base de datos |

## Flujo de Datos

```
QuestionsScreen
  ├── useQuestions(filters, page)  ──→  supabase.from('question').select(...)
  │     └── return { questions, total, loading, error, ... }
  ├── useLevels()                  ──→  supabase.from('level').select('*')
  │     └── return { levels, loading }
  │
  ├── [List View]
  │     ├── FilterBar (level dropdown, category input)
  │     ├── QuestionRow[] ──→ onEdit → navigate
  │     └── Pagination
  │
  ├── [Create] /admin/questions/new
  │     └── QuestionForm (mode="create")
  │           ├── Supabase: insert question + options (Promise.all)
  │           └── navigate('/admin/questions')
  │
  └── [Edit] /admin/questions/:id/edit
        └── QuestionForm (mode="edit", questionId)
              ├── useEffect: fetch question + options by id
              ├── Supabase: update question, delete old options, insert new options
              └── navigate('/admin/questions')
```

## Cambios de Archivos

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/types/index.ts` | Modificar | Agregar `QuestionWithLevel`, `QuestionFormData`, `QuestionOptionFormData` |
| `src/hooks/useQuestions.ts` | Crear | Hook CRUD: `fetchQuestions`, `createQuestion`, `updateQuestion`, `deleteQuestion` |
| `src/hooks/useLevels.ts` | Crear | Hook reutilizable: fetch de tabla `level` |
| `src/components/molecules/QuestionRow.tsx` | Crear | Fila de tabla con texto, nivel, categoría, acciones (editar/eliminar) |
| `src/components/organisms/QuestionForm.tsx` | Crear | Formulario create/edit con opciones dinámicas, validación, submit |
| `src/pages/QuestionsScreen.tsx` | Crear | Screen principal: listado con filtros + routing a create/edit |
| `src/components/organisms/ConfirmModal.tsx` | Crear | Modal de confirmación reutilizable para eliminación |
| `src/App.tsx` | Modificar | Reemplazar `PlaceholderPage` con `QuestionsScreen`, agregar rutas anidadas `new` y `:id/edit` |
| `src/locales/en.json` | Modificar | Agregar namespace `questions.*` |
| `src/locales/es.json` | Modificar | Agregar namespace `questions.*` |

## Interfaces / Contratos

```typescript
// src/types/index.ts — nuevas interfaces
interface QuestionWithLevel extends Question {
  level: Level | null
}

interface QuestionFormData {
  text: string
  level_id: string
  category: string
  options: QuestionOptionFormData[]
}

interface QuestionOptionFormData {
  id?: string          // presente solo en modo edit
  text: string
  is_correct: boolean
}
```

```typescript
// src/hooks/useQuestions.ts — retorno
interface UseQuestionsResult {
  questions: QuestionWithLevel[]
  total: number
  loading: boolean
  error: string | null
  createQuestion: (data: QuestionFormData) => Promise<{ error: string | null }>
  updateQuestion: (id: string, data: QuestionFormData) => Promise<{ error: string | null }>
  deleteQuestion: (id: string) => Promise<{ error: string | null }>
  refetch: () => void
}
```

```typescript
// src/hooks/useLevels.ts — retorno
interface UseLevelsResult {
  levels: Level[]
  loading: boolean
  error: string | null
}
```

## Estrategia de PRs Encadenados

**Cadena**: Feature Branch Chain con tracker.

```
main
 └── feat/admin-question-crud           ← tracker (draft)
      └── PR #1: Types + Hooks + i18n   ← 📍 base
           └── PR #2: List + Row + Screen
                └── PR #3: Form + Routes + Delete
```

| PR | Alcance | Líneas Est. | Dependencia |
|----|---------|-------------|-------------|
| PR 1 | `types/index.ts`, `useQuestions.ts`, `useLevels.ts`, `en.json`, `es.json` | ~180 | Ninguna |
| PR 2 | `QuestionRow.tsx`, `QuestionsScreen.tsx` (solo listado), `ConfirmModal.tsx` | ~220 | PR 1 |
| PR 3 | `QuestionForm.tsx`, `App.tsx` rutas, `QuestionsScreen.tsx` (create/edit routing) | ~300 | PR 2 |

**Total estimado**: ~700 líneas → 3 PRs dentro del budget de 400.

### Autonomía de Cada PR

- **PR 1**: Compila, no rompe nada, agrega tipos e hooks sin uso aún. Verificación: `npm run build`.
- **PR 2**: Renderiza listado en `/admin/questions`. Verificación: navegar a `/admin/questions`, ver tabla vacía/con datos, filtros funcionan.
- **PR 3**: CRUD completo funcional. Verificación: crear, editar, eliminar preguntas desde la UI.

## Estrategia de Testing

| Capa | Qué Probar | Enfoque |
|------|------------|---------|
| Unit | `useQuestions` — estados de carga, error, CRUD success | Vitest + mock chain (patrón de `useDashboardStats.test.tsx`) |
| Unit | `useLevels` — carga de niveles | Vitest + mock chain |
| Unit | `QuestionRow` — renderiza texto, nivel, acciones | `@testing-library/react` |
| Unit | `QuestionForm` — validación (min 4 opciones, 1 correcta) | `@testing-library/react` + fireEvent |
| Integration | `QuestionsScreen` — routing create → list → edit → list | `@testing-library/react` + MemoryRouter |
| E2E | N/A | No hay runner E2E configurado actualmente |

## Migración / Rollout

No se requiere migración. Todos los cambios son frontend-only — la capa de base de datos (tablas, RLS, triggers, tipos) ya existe desplegada.

## Preguntas Abiertas

- [ ] **Modal de confirmación**: ¿`window.confirm()` es aceptable para esta fase, o se necesita un modal accesible (aria-dialog) desde el inicio? Recomendación: usar `window.confirm()` para mantener bajo el budget, y crear un issue separado para un modal accesible.
- [ ] **Paginación server-side**: ¿Se anticipa más de 1000 preguntas en el corto plazo? Si no, client-side es suficiente.
- [ ] **Error FK RESTRICT**: ¿El error de Supabase para FK RESTRICT tiene un `code` específico que podamos detectar, o solo comprobamos el mensaje? Necesario para el mapeo amigable en `deleteQuestion`.
