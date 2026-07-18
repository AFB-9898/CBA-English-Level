# Delta para Admin Sidebar — enmienda de corrección

La enmienda corrige el hallazgo CRITICAL 4 de `verify-report.md` y sigue `design-correction.md`: cada enlace debe navegar a una ruta registrada; Students y Audit Log siguen siendo placeholders visibles hasta implementar sus módulos.

## MODIFIED Requirements

### Requirement: S1 — Sidebar Structure

The system MUST render a sidebar inside `AdminLayout` containing five navigation links: Dashboard, Students, Questions, Levels, Audit Log. Each link SHALL have an associated icon. The sidebar SHALL be positioned to the left of the `<Outlet />` content on desktop.
(Previously: contained four links and did not expose Levels.)

#### Scenario: S1-H — All links rendered

- GIVEN an admin user is authenticated and on any admin route
- WHEN the `AdminLayout` renders
- THEN a sidebar is visible with five links
- AND one link reads "Levels" with a levels icon

### Requirement: S3 — Placeholder Links

The Students and Audit Log links SHALL remain visible placeholders with registered routes at `/admin/students` and `/admin/audit-log`, displaying “Coming soon” until their modules exist. Questions SHALL navigate to `/admin/questions`, and Levels SHALL navigate to `/admin/levels`. All links SHALL be visually distinguishable from the active link.
(Previously: placeholders were specified as having no routes, conflicting with the implemented registered pages and the approved correction.)

#### Scenario: S3-P — Placeholder routes are registered

- GIVEN `/admin/students` and `/admin/audit-log` are registered placeholder routes
- WHEN the admin clicks either placeholder
- THEN the browser navigates to its registered page
- AND the page remains visibly marked “Coming soon”

#### Scenario: S3-Q — Managed links navigate

- GIVEN the sidebar renders
- WHEN the admin clicks Questions or Levels
- THEN the browser navigates to `/admin/questions` or `/admin/levels`
- AND the selected link shows active/highlighted style

#### Scenario: S3-R — Every sidebar link has a route
- GIVEN the sidebar displays its five links
- WHEN the admin activates any link
- THEN the application navigates to that link’s registered route without an inert anchor

## ADDED Requirements

### Requirement: S5 — Bilingual Levels Navigation

The Levels label, accessible name, and active-state text MUST use the existing Spanish/English locale mechanism.

#### Scenario: S5-I — Locale changes label
- GIVEN the admin changes the application locale
- WHEN the sidebar renders
- THEN the Levels label and accessible name use the selected locale
