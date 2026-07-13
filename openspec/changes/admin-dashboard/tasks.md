# Tasks: Admin Dashboard

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 700–900 |
| 400-line budget risk | High |
| Chained PRs recommended | No (single-pr approved) |
| Suggested split | Single PR with size:exception |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

> **⚠ Size exception required**: This change adds 10 new files + modifies 4 existing files across types, i18n, layout, routing, hook, 3 molecules, and a screen. Estimated ~700–900 changed lines. Single PR approved by user — requires `size:exception` acknowledgment before `sdd-apply`.

## Phase 1: Foundation — Types, i18n, Routes (frontend)

- [x] 1.1 Add `DashboardStats`, `LevelDistributionItem`, `RecentExam` interfaces to `src/types/index.ts`
- [x] 1.2 Add `dashboard.*` keys to `src/locales/en.json` — nav labels, KPI titles, empty states, table headers
- [x] 1.3 Add `dashboard.*` keys to `src/locales/es.json` — mirror English keys in Spanish
- [x] 1.4 Modify `src/App.tsx` — import `DashboardScreen`, replace inline placeholder with `<DashboardScreen />`, add child routes for `/admin/students`, `/admin/questions`, `/admin/audit-log` as placeholders

## Phase 2: Sidebar — AdminLayout Responsive Navigation (frontend)

- [x] 2.1 Modify `src/pages/AdminLayout.tsx` — add `useState` for mobile sidebar toggle, hamburger button in header (visible < `md`), fixed sidebar (`w-60`) on `md+` with 4 nav links (Dashboard, Students, Questions, Audit Log) using `NavLink`, overlay sidebar on mobile with backdrop
- [x] 2.2 Add active link highlighting via `NavLink` className callback — active route gets bg/highlighted text, inactive gets default style
- [x] 2.3 Update `src/pages/__tests__/AdminLayout.test.tsx` — add tests for sidebar rendering, 4 nav links present, hamburger toggle on mobile, active link highlighting

## Phase 3: Data Hook — useDashboardStats (frontend)

- [x] 3.1 Create `src/hooks/useDashboardStats.ts` — `useState` for stats/distribution/recentExams/loading/error, `useEffect` fires `Promise.all` with 7 Supabase queries, computes avgScore and levelDistribution client-side, returns `{ stats, distribution, recentExams, loading, error }`
- [x] 3.2 Create `src/hooks/__tests__/useDashboardStats.test.tsx` — mock `../../lib/supabase`, test return shape on success, test error state, test loading state

## Phase 4: Dashboard Molecules (frontend)

- [x] 4.1 Create `src/components/molecules/StatCard.tsx` — accepts `{ label, value, icon?, loading }`, renders skeleton when loading, value when loaded, uses `useTranslation` for label
- [x] 4.2 Create `src/components/molecules/__tests__/StatCard.test.tsx` — test renders value, skeleton when loading
- [x] 4.3 Create `src/components/molecules/LevelBar.tsx` — accepts `{ levels: LevelDistributionItem[], loading }`, renders horizontal CSS bars with level name + count + percentage, skeleton bars when loading, empty state when array is empty
- [x] 4.4 Create `src/components/molecules/__tests__/LevelBar.test.tsx` — test renders bars with correct widths, empty state, loading skeleton
- [x] 4.5 Create `src/components/molecules/RecentExamsTable.tsx` — accepts `{ exams: RecentExam[], loading }`, renders table with columns: Student, Score, Level, Status (color-coded badge), Date; skeleton rows when loading, empty state when no exams
- [x] 4.6 Create `src/components/molecules/__tests__/RecentExamsTable.test.tsx` — test renders rows, status badge colors, empty state, loading skeleton

## Phase 5: Dashboard Screen + Integration (frontend)

- [x] 5.1 Create `src/pages/DashboardScreen.tsx` — imports `useDashboardStats`, composes 4× `StatCard` in responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`), `LevelBar`, `RecentExamsTable`; shows error message on hook error
- [x] 5.2 Create `src/pages/__tests__/DashboardScreen.test.tsx` — smoke test with `MemoryRouter` + mocked hook, verify 3 sections render
- [x] 5.3 Verify: `npm run build` passes, `npm run test` passes, sidebar navigates correctly, dashboard loads at `/admin`
