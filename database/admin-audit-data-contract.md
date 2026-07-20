# Administrative Audit Data Contract

The administrative audit timeline is available only through `get_admin_audit_log`. It checks `fn_is_admin()`, is executable only by `authenticated`, and never grants clients direct access to `audit_log` or its JSON details.

## Event vocabulary

| Entity | Actions |
|---|---|
| `level` | `edit`, `deactivate`, `new_version` |
| `exam_config` | `update` |
| `question` | `create`, `edit`, `delete` |
| `question_option` | `create`, `edit`, `delete`, `answer_change` |

`answer_change` is emitted only when an existing option's `is_correct` value changes. Creating or deleting an option remains a create or delete event.

## Trigger and actor behavior

Question and option triggers run after direct INSERT, UPDATE, and DELETE operations. They use `auth.uid()` as the actor and record trusted old and new row snapshots inside the existing `audit_log.details` field. The audit trigger is not attached to `audit_log`, so it cannot recurse. A failed audit insert raises a database warning and does not fail the original Question Bank mutation.

The current question schema has no deactivation column. Therefore, Question Bank removal is a physical `delete` event. Existing foreign-key restrictions can still prevent deleting a question linked to an exam; no new deactivation UI was introduced.

## Security and immutability

`audit_log` is append-only for application roles: `anon` and `authenticated` receive no direct table privileges. The only read path is the administrator-checked projection RPC. Existing level and exam configuration writers continue to append their records to the same table. Database owners retain operational maintenance authority.

## Projection and filters

Each projected row contains only audit ID, timestamp, nullable actor ID and display name, action, entity, entity ID, and a server-generated safe summary. The RPC never returns `details`, before/after payloads, or question text.

Filters are inclusive dates, administrator ID, entity, and action. Entity and action filters are validated against the documented vocabulary. Results use descending keyset pagination over `(created_at, id)`; a cursor must supply both values. Page size is bounded from 1 through 100.

`get_admin_audit_actors` is a separate administrator-checked helper for the administrator filter. It returns only IDs and display names for administrators who have audit events.
