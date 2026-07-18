# Admin Sidebar Specification

## Purpose

Defines the sidebar navigation component rendered inside `AdminLayout`. Provides access to admin sub-pages: Dashboard, Students, Questions, and Audit Log. Adapts from a fixed vertical sidebar on desktop to a collapsible overlay on mobile.

---

## Requirements

### Requirement: S1 — Sidebar Structure

The system MUST render a sidebar inside `AdminLayout` containing four navigation links: Dashboard, Students, Questions, Audit Log. Each link SHALL have an associated icon. The sidebar SHALL be positioned to the left of the `<Outlet />` content on desktop.

#### Scenario: S1-H — All links rendered

- GIVEN an admin user is authenticated and on any admin route
- WHEN the `AdminLayout` renders
- THEN a sidebar is visible with four links
- AND the first link reads "Dashboard" with a dashboard icon
- AND the second link reads "Students" with a users icon
- AND the third link reads "Questions" with a question-mark icon
- AND the fourth link reads "Audit Log" with a clipboard icon

### Requirement: S2 — Active Link Highlighting

The currently active route MUST be visually distinguished from inactive links using a highlighted background and/or text color.

#### Scenario: S2-H — Dashboard link active

- GIVEN the current URL is `/admin` (dashboard index)
- WHEN the sidebar renders
- THEN the Dashboard link has an active/highlighted style
- AND the other three links appear in the default (inactive) style

### Requirement: S3 — Placeholder Links

The Students and Audit Log links SHALL be placeholders — no routes exist yet. The Questions link SHALL navigate to `/admin/questions`. All links SHALL be visually distinguishable from the active Dashboard link.

#### Scenario: S3-P — Placeholder links have no route

- GIVEN no route is registered for `/admin/students` or `/admin/audit-log`
- WHEN the sidebar renders
- THEN clicking "Students" does not navigate away from `/admin`
- AND clicking "Audit Log" does not navigate away from `/admin`

#### Scenario: S3-Q — Questions navigates to route

- GIVEN the sidebar renders
- WHEN the admin clicks "Questions"
- THEN the browser navigates to `/admin/questions`
- AND the Questions link shows active/highlighted style on that route

### Requirement: S4 — Mobile Responsiveness

On viewports narrower than `768px`, the sidebar SHALL be hidden by default. A hamburger menu button SHALL be visible in the header to toggle the sidebar. When open, the sidebar SHALL overlay the content. A click outside the sidebar or on a link SHALL close it.

#### Scenario: S4-D — Desktop sidebar visible

- GIVEN the viewport width is 768px or wider
- WHEN the admin layout renders
- THEN the sidebar is visible alongside the main content
- AND the hamburger button is hidden

#### Scenario: S4-M — Mobile sidebar collapsed

- GIVEN the viewport width is below 768px
- WHEN the admin layout renders initially
- THEN the sidebar is hidden
- AND a hamburger button is visible in the header

#### Scenario: S4-O — Mobile sidebar opens and closes

- GIVEN the sidebar is hidden on mobile
- WHEN the user taps the hamburger button
- THEN the sidebar slides in as an overlay
- WHEN the user taps the hamburger again (or the overlay backdrop)
- THEN the sidebar closes

---

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Sidebar width (desktop) | Fixed 240px |
| Mobile breakpoint | `768px` (Tailwind `md`) |
| Overlay z-index | Above main content, below modals |
| Transition duration | 200–300ms for slide-in/out |
