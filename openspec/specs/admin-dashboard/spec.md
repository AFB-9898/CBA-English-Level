# Admin Dashboard Specification

## Purpose

Defines the admin dashboard index page — the landing view after login that provides a snapshot of system activity through KPI cards, level distribution chart, and recent exams table.

---

## Requirements

### Requirement: D1 — KPI Cards Row

The system MUST display four stat cards at the top of the dashboard: total students, total exams created, exams completed today, and average score across completed exams. Each card SHALL show an icon, a translated label, the numeric value, and an optional trend indicator (up/down arrow) when period-over-period data is available.

#### Scenario: D1-H — KPIs render with data

- GIVEN the `useDashboardStats` hook returns `{ totalStudents: 42, totalExams: 156, examsToday: 8, averageScore: 73.5 }`
- WHEN the dashboard page loads
- THEN four `StatCard` components are rendered
- AND the first card shows label "Total Students" with value "42"
- AND the second card shows "Total Exams" with value "156"
- AND the third card shows "Exams Today" with value "8"
- AND the fourth card shows "Average Score" with value "73.5"

#### Scenario: D1-L — Loading skeleton

- GIVEN `useDashboardStats` is still fetching
- WHEN the dashboard renders
- THEN each KPI card displays a skeleton/placeholder element
- AND numeric values are not visible

#### Scenario: D1-E — Query error

- GIVEN `useDashboardStats` returns an error
- WHEN the dashboard renders
- THEN an inline error message is displayed in place of the cards
- AND the user can retry (or the hook auto-rejects with a sensible error)

### Requirement: D2 — Level Distribution Chart

The system MUST render a horizontal bar chart using CSS only (no chart library) showing each level's exam count. Each bar SHALL display the level name, a colored bar proportional to the percentage, and the count/percentage label.

#### Scenario: D2-H — Chart renders with data

- GIVEN `levelDistribution` returns `[{ name: "A1", count: 30, color: "#4F46E5" }, { name: "A2", count: 20, color: "#0891B2" }, { name: "B1", count: 10, color: "#059669" }]`
- WHEN the `LevelChart` component renders
- THEN three horizontal bars are displayed
- AND the A1 bar occupies 50% width, A2 bar 33%, B1 bar 17%
- AND each bar shows its count and percentage (e.g., "30 (50%)")

#### Scenario: D2-E — Empty state (no exams completed)

- GIVEN `levelDistribution` is an empty array
- WHEN the `LevelChart` component renders
- THEN a "No data available" empty state message is shown
- AND no bars are rendered

#### Scenario: D2-L — Loading state

- GIVEN `levelDistribution` is null (loading)
- WHEN the component renders
- THEN skeleton bars are displayed

### Requirement: D3 — Recent Exams Table

The system MUST display the last 10 exams sorted by `created_at DESC`. The table SHALL have columns: Student Name, Score, Level, Status, Date. Status SHALL be rendered as a color-coded badge.

#### Scenario: D3-H — Table renders rows

- GIVEN `recentExams` returns 10 exams with student name, score, level name, status, and date
- WHEN the `RecentExamsTable` component renders
- THEN a table with a header row and 10 data rows is displayed
- AND each row shows Student Name, Score, Level, Status badge, and Date
- AND the status "completed" renders as a green badge, "in_progress" as yellow, "pending" as gray

#### Scenario: D3-L — Loading skeleton

- GIVEN `recentExams` is null (loading)
- WHEN the component renders
- THEN 5 skeleton rows are displayed in place of data rows

#### Scenario: D3-E — Empty state (no exams)

- GIVEN `recentExams` is an empty array
- WHEN the component renders
- THEN a message "No exams recorded yet" is displayed
- AND no table rows are rendered

### Requirement: D4 — `useDashboardStats` Hook

The system SHALL provide a custom hook that fetches all dashboard statistics in parallel via `Promise.all`. The hook SHALL return a typed interface with data, loading, and error states.

#### Scenario: D4-H — Successful fetch

- GIVEN the Supabase client is available and queries succeed
- WHEN `useDashboardStats` is called
- THEN it SHALL execute the following queries in parallel:
  - `supabase.from('student').select('*', { count: 'exact', head: true })`
  - `supabase.from('exam').select('*', { count: 'exact', head: true })`
  - `supabase.from('exam').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', today)`
  - `supabase.from('exam').select('score').eq('status', 'completed')`
  - `supabase.from('exam').select('level_id, student_id').eq('status', 'completed')`
  - `supabase.from('exam').select('*, student:student_id(full_name)').order('created_at', { ascending: false }).limit(10)`
  - `supabase.from('level').select('*')`
- AND it SHALL return `{ totalStudents, totalExams, examsToday, averageScore, levelDistribution, recentExams, loading: false, error: null }`

#### Scenario: D4-E — Query failure

- GIVEN one or more Supabase queries fail
- WHEN `useDashboardStats` is called
- THEN the hook SHALL catch the error and return `{ error: Error, loading: false }`
- AND the error SHALL be propagated to the UI

### Requirement: D5 — Dashboard Page Composition

The system MUST compose the dashboard page from `DashboardPage` component using `useDashboardStats` and the three widget components. The page SHALL be responsive: 4-column grid for KPIs on desktop, 2 on tablet, 1 on mobile.

#### Scenario: D5-R — Responsive grid

- GIVEN a viewport width of 1280px+
- WHEN the dashboard renders
- THEN the KPI cards are arranged in a 4-column grid

- GIVEN a viewport width of 768px–1279px
- WHEN the dashboard renders
- THEN the KPI cards are arranged in a 2-column grid

- GIVEN a viewport width below 768px
- WHEN the dashboard renders
- THEN the KPI cards are arranged in a 1-column (stacked) layout

---

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Dashboard load time | All stats visible within 2s on warm connection |
| Parallel query count | 6 simultaneous Supabase queries |
| Table responsiveness | Horizontal scroll on < 640px viewport |
| Skeleton visibility | Loading state shown within 200ms of mount |
