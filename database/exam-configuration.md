# Exam Configuration Database Contract

The database owns the current exam configuration. Administrators can read it, but they must update it through one revision-checked RPC. This keeps concurrent edits auditable and prevents a client from creating conflicting configuration rows.

## Quick Path

1. Read the single `public.exam_config` row and retain its `revision`.
2. Call `public.update_exam_config` with the retained revision and all three editable values.
3. On SQLSTATE `40001`, reload the row and ask the administrator to review the newer configuration.

## Current Configuration

`public.exam_config` has exactly one current row. Its `singleton` value is always `TRUE`, is unique, and deletion is rejected by a trigger. Migration `007_admin_exam_configuration.sql` preserves the seeded row and adds these fields:

| Column | Constraint | Meaning |
|---|---|---|
| `time_limit_minutes` | Integer greater than zero | Time available to complete an exam. |
| `questions_per_exam` | Integer greater than zero | Number of questions selected for an exam. |
| `passing_score` | Integer from 0 through 100, inclusive | Percentage required to pass. It does not assign a CEFR level. |
| `question_selection_rule` | Exactly `random_all_questions` | The current observed rule: select randomly from all questions. |
| `revision` | Positive bigint; each update must add one | Monotonically increasing optimistic-concurrency version. |
| `updated_at` | Timestamp | Last successful configuration update. |

CEFR level assignment remains the responsibility of the active `level` score ranges and `fn_calculate_level`. Changing `passing_score` changes only pass/fail status for a future exam flow.

## Update RPC

```sql
public.update_exam_config(
  p_expected_revision bigint,
  p_time_limit_minutes integer,
  p_questions_per_exam integer,
  p_passing_score integer
) returns public.exam_config
```

The RPC is executable by `authenticated` users, but it verifies `fn_is_admin()` before changing data. It locks the singleton row, compares `p_expected_revision`, validates every input, increments `revision` by one, and returns the updated row. A stale revision raises SQLSTATE `40001`; a non-administrator receives SQLSTATE `42501`.

Direct client inserts, updates, and deletes are unavailable: the table has no data-modification policy for client roles and those privileges are revoked. Clients may select the current row.

## Audit Behavior

Every successful RPC call inserts one `audit_log` row with:

| Field | Value |
|---|---|
| `action` | `update` |
| `entity` | `exam_config` |
| `entity_id` | The singleton configuration ID |
| `details.actor` | Authenticated administrator ID |
| `details.before` | Complete configuration before the update |
| `details.after` | Complete configuration after the update |

Validation failures, stale revisions, and authorization failures make no configuration or audit changes.

## Future Exam Snapshots

`public.exam_config_snapshot` stores a copy of a configuration revision, including its source configuration ID, revision, selection rule, and editable values. Snapshots cannot be updated or deleted. The nullable `exam.config_snapshot_id` foreign key is intentionally added now so future exam creation can link an exam to the immutable configuration it used.

This work unit does not create snapshots during exam creation and does not change the student exam flow. A later transaction that creates an exam must create or reuse the matching snapshot and set `exam.config_snapshot_id` atomically.

## Non-Goals

- No level or category quotas are modeled.
- No question activation status is introduced.
- No CEFR range or level-assignment behavior changes.
- No pass/fail calculation or student exam creation behavior changes.
- No frontend, route, report, or export implementation is included.
