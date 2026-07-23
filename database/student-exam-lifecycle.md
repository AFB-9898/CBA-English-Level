# Student Exam Lifecycle Foundation

Phase 1 makes the database the authority for a student placement attempt. It deliberately does not add a React exam screen, route, timer, or dashboard action.

## Student API

Authenticated students use only these RPCs:

| RPC | Purpose |
|---|---|
| `start_exam(request_id)` | Starts or resumes an idempotent attempt. |
| `get_exam_attempt(attempt_id)` | Returns safe resumable state and finalizes expiry. |
| `save_exam_answer(attempt_id, exam_question_id, option_id)` | Upserts one assignment-scoped answer. `option_id` may be `NULL` to clear an answer. |
| `submit_exam(attempt_id)` | Idempotently finalizes and returns the result. |

All functions check `auth.uid()` against `student`, use `SECURITY DEFINER` with a fixed search path, and grant execution only to `authenticated`. Their JSON payloads never include `is_correct` or a correct option.

## Lifecycle

1. `start_exam` takes a transaction advisory lock for the student and enforces the partial unique index for one in-progress attempt.
2. It rejects a student with a completed attempt on the current `America/La_Paz` business date; the legacy UTC daily-exam trigger is removed.
3. It takes a stable copy of the current configuration, selected valid questions, all options, and active CEFR score ranges.
4. The server writes `deadline_at` from the configuration snapshot. Clients never supply a deadline.
5. An expired resume or save finalizes before returning. Submission scores every assigned question, so unanswered questions are incorrect.
6. Completion writes the score and level selected from the attempt's CEFR snapshot. Completed attempts and every snapshot are immutable.

Before its new uniqueness guarantees are created, migration `013` stops with a diagnostic if legacy duplicate in-progress attempts or duplicate question orders exist. It never rewrites or deletes historical records during migration.

## Access Boundary

Students cannot select, insert, update, or delete `exam`, `exam_question`, `student_answer`, `exam_question_option`, or `exam_level_snapshot`. Student RLS access to `question` and `question_option` is removed; administrators retain Question Bank reads through the existing admin policy.

## Verification

Run locally after applying migrations:

```bash
supabase db reset --local
supabase test db
```

`supabase/tests/student_exam_lifecycle.sql` is the contract for authorization, idempotency, daily eligibility, snapshot integrity, expiration, scoring, CEFR assignment, and immutable completion. `supabase/tests/student_dashboard.sql` verifies that dashboard state uses the same CBA business date.
