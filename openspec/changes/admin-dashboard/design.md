# Design: Admin Dashboard

## Technical Approach

Single `useDashboardStats` hook fires 7 parallel Supabase queries via `Promise.all`, computes KPIs and level distribution client-side, and returns `{ stats, distribution, recentExams, levels, loading, error }`. `DashboardScreen` composes the hook output into three visual sections. `AdminLayout` gains a responsive sidebar (fixed left on desktop, hamburger overlay on mobile) with 4 nav links. All text through `useTranslation` with `dashboard.*` keys.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| Hook data fetching | `Promise.all` parallel vs sequential | Parallel faster (~200ms vs ~800ms); single error handler for all | `Promise.all` |
| CSS bar chart | CSS-only vs chart library | No bundle bloat vs interactivity | CSS-only (proposal scope) |
| Sidebar state | Local `useState` vs context | Context overkill for single layout | Local state |
| Score computation | Client-side avg from rows vs SQL function | Simpler code vs network roundtrip | Client-side (7 rows max for avg) |
| File location | `pages/DashboardScreen.tsx` vs `components/screens/` | Existing routing uses `pages/`; molecules stay in `molecules/` | `pages/DashboardScreen.tsx` |

## Data Flow

    useDashboardStats()
    ├── Promise.all([
    │     supabase.from('student').select('id', { count:'exact', head:true }),
    │     supabase.from('exam').select('id', { count:'exact', head:true }),
    │     supabase.from('exam').select('id',{count:'exact',head:true})
    │       .eq('status','completed').gte('completed_at', today),
    │     supabase.from('exam').select('score').eq('status','completed'),
    │     supabase.from('exam').select('level_id')
    │       .eq('status','completed'),
    │     supabase.from('exam').select('*, student(full_name), level(name)')
    │       .eq('status','completed').order('created_at',{ascending:false}).limit(10),
    │     supabase.from('level').select('*')
    │   ])
    │   → Client computes: avgScore, levelDistribution
    └── returns { stats, distribution, recentExams, loading, error }

    DashboardScreen
    ├── StatCard × 4   ← stats.totalStudents, stats.totalExams, stats.examsToday, stats.avgScore
    ├── LevelBar       ← distribution (computed from exam level_ids + level names)
    └── RecentExamsTable ← recentExams

    AdminLayout
    ├── Sidebar (new)
    │   ├── NavLinks (Dashboard, Students*, Questions*, AuditLog*)
    │   └── LanguageSwitcher (bottom)
    └── <Outlet />

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useDashboardStats.ts` | Create | Hook: 7 parallel Supabase queries, computes KPIs + distribution |
| `src/components/molecules/StatCard.tsx` | Create | KPI card: label + value, skeleton loading, error state |
| `src/components/molecules/LevelBar.tsx` | Create | CSS horizontal bars per level with count + percentage |
| `src/components/molecules/RecentExamsTable.tsx` | Create | Table: student, score, level, status, date |
| `src/pages/DashboardScreen.tsx` | Create | Screen composing 3 sections via useDashboardStats |
| `src/pages/AdminLayout.tsx` | Modify | Add sidebar with nav, mobile hamburger, restructure layout |
| `src/App.tsx` | Modify | Add child routes (`dashboard`, `students`, etc.) under `/admin` |
| `src/types/index.ts` | Modify | Add `DashboardStats`, `LevelDistributionItem`, `RecentExam` |
| `src/locales/en.json` | Modify | Add `dashboard.*` keys |
| `src/locales/es.json` | Modify | Add `dashboard.*` keys |
| `src/hooks/__tests__/useDashboardStats.test.tsx` | Create | Mock supabase, test return shape + loading + error |
| `src/components/molecules/__tests__/StatCard.test.tsx` | Create | Test renders value, loading skeleton, error state |
| `src/components/molecules/__tests__/LevelBar.test.tsx` | Create | Test renders bars, loading skeleton, empty state |
| `src/components/molecules/__tests__/RecentExamsTable.test.tsx` | Create | Test renders rows, loading skeleton, empty state |
| `src/pages/__tests__/DashboardScreen.test.tsx` | Create | Smoke test: renders 3 sections |

## Interfaces / Contracts

```typescript
// src/types/index.ts — additions

export interface DashboardStats {
  totalStudents: number
  totalExams: number
  examsToday: number
  avgScore: number
}

export interface LevelDistributionItem {
  level_id: string
  name: string
  count: number
  percentage: number
}

export interface RecentExam {
  id: string
  student: { full_name: string } | null
  level: { name: string } | null
  score: number | null
  status: ExamStatus
  completed_at: string | null
  created_at: string
}
```

**StatCard props**: `{ label: string; value: number | string; icon?: string; loading: boolean }`
**LevelBar props**: `{ levels: LevelDistributionItem[]; loading: boolean }`
**RecentExamsTable props**: `{ exams: RecentExam[]; loading: boolean }`
**useDashboardStats return**: `{ stats: DashboardStats; distribution: LevelDistributionItem[]; recentExams: RecentExam[]; levels: Level[]; loading: boolean; error: string | null }`

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit — StatCard | Renders value, loading skeleton, error fallback ("--") | `render(<StatCard .../>)` + `screen.getByText` |
| Unit — LevelBar | Renders N bars, empty state text, loading skeleton | Mock data array, check bar count + text |
| Unit — RecentExamsTable | Renders rows, empty state, loading skeleton rows | Mock exams array, check row count + cell content |
| Unit — useDashboardStats | Returns correct shape, handles Supabase error | `vi.mock('../../lib/supabase')`, mock `supabase.from().select()` chain |
| Smoke — DashboardScreen | Mounts without crashing, shows sections | `render(<DashboardScreen />)` inside MemoryRouter + AuthProvider mock |

## Migration / Rollout

No migration required. No database changes. Sidebar and routes are purely frontend additions. Existing `/admin` route changes from inline placeholder to `DashboardScreen` component — visually identical for new users, improved for returning admins.

## Open Questions

- [ ] None — all decisions align with proposal scope and existing codebase patterns.
