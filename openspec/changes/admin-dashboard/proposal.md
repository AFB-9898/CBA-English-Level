# Proposal: Admin Dashboard

## Intent

The admin area is a dead end — a static "Welcome" placeholder with no navigation and no data. Admins need visibility into system activity: how many students registered, exams taken, score trends, and level placement distribution. This change builds the dashboard index page and a sidebar navigation shell to unlock all future admin sub-pages.

## Scope

### In Scope
- **Sidebar navigation** in AdminLayout with 4 links: Dashboard (active), Students, Questions, Audit Log (all placeholders except Dashboard)
- **KPI cards row** — 4 stat cards: total students, total exams, exams completed today, average score
- **Level distribution chart** — CSS-only bar chart showing exam count per level (no chart library)
- **Recent exams table** — last 10 exams with student name, score, level, status, date
- **`useDashboardStats` custom hook** — parallel Supabase queries, returns aggregated stats
- **i18n keys** for all dashboard text (es/en)
- **Responsive layout** — cards stack on mobile, sidebar collapses or overlays on small screens
- **Tests** for the hook and dashboard components

### Out of Scope
- Student list page, question management, audit log page, exam config editing
- Interactive charts (recharts, chart.js) — CSS-only for this cycle
- Real-time updates or auto-refresh
- CSV/Excel export from dashboard
- Backend changes — no new RLS policies, functions, or triggers

## Capabilities

> Contract between proposal and specs phases.

### New Capabilities
- `admin-dashboard`: Dashboard index page — KPI cards, level distribution bar chart, recent exams table, useDashboardStats hook
- `admin-sidebar`: Sidebar navigation component in AdminLayout — links to admin sub-pages, responsive collapse

### Modified Capabilities
None — `admin-auth` requirements are not affected.

## Approach

1. Add sidebar to `AdminLayout.tsx` using Tailwind — fixed width on desktop, collapsible on mobile
2. Extract the inline placeholder from `App.tsx` into `src/pages/DashboardPage.tsx`
3. Create `useDashboardStats` hook in `src/hooks/` — runs 4 parallel Supabase queries via `Promise.all`, computes KPIs and level distribution client-side
4. Create `KpiCard` molecule (reusable stat card)
5. Create `LevelChart` molecule — CSS bar chart from `levelDistribution` array
6. Create `RecentExamsTable` molecule — last 10 exams from joined query
7. Add i18n keys under `dashboard.*` namespace
8. Route update: `/admin` index renders `DashboardPage`

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/pages/AdminLayout.tsx` | Modified | Add sidebar with nav links |
| `src/pages/DashboardPage.tsx` | New | Dashboard index page composing molecules |
| `src/components/molecules/KpiCard.tsx` | New | Reusable stat card atom |
| `src/components/molecules/LevelChart.tsx` | New | CSS-only bar chart |
| `src/components/molecules/RecentExamsTable.tsx` | New | Table of last 10 exams |
| `src/hooks/useDashboardStats.ts` | New | Data-fetching hook |
| `src/types/index.ts` | Modified | Add `DashboardStats` and `LevelDistribution` interfaces |
| `src/App.tsx` | Modified | Replace inline placeholder with DashboardPage |
| `src/locales/es.json` | Modified | Add `dashboard.*` keys |
| `src/locales/en.json` | Modified | Add `dashboard.*` keys |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Supabase RLS blocks dashboard queries | Low | RLS policies already allow admin reads; verified in exploration |
| CSS bar chart looks poor at extreme widths | Medium | Use `min-w` + `max-w` constraints; test at 320px–1440px |
| Parallel queries slow on cold start | Low | 4 lightweight count/select queries; Supabase handles indexes |
| Sidebar breaks existing layout on small screens | Medium | Mobile-first: sidebar hidden by default, hamburger toggle |

## Rollback Plan

Delete new files (`DashboardPage.tsx`, molecules, hook), revert `AdminLayout.tsx` to header-only layout, remove sidebar routes from `App.tsx`, remove `dashboard.*` i18n keys. No database changes to revert.

## Dependencies

- Supabase client (`src/lib/supabase.ts`) — already configured
- Admin auth with RLS policies — already deployed
- `react-router-dom` — already installed
- `react-i18next` — already configured

## Success Criteria

- [ ] Dashboard loads at `/admin` with 4 KPI cards showing live data
- [ ] Level distribution bar chart renders with correct counts per level
- [ ] Recent exams table shows last 10 exams with student name, score, level, status, date
- [ ] Sidebar displays 4 nav links; Dashboard link is visually active
- [ ] All dashboard text has es/en translations
- [ ] Layout is responsive: cards stack on mobile, sidebar collapses
- [ ] `useDashboardStats` hook has test coverage
- [ ] Dashboard components have test coverage
