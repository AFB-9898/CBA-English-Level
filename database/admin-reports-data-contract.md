# Administration Reports Data Contract

The administration report is available only through `get_admin_exam_report`. The RPC checks `fn_is_admin()` and is executable only by authenticated users; it does not grant clients direct access to the `student` table.

## Returned data

Each row contains the stable exam, student, and assigned-level IDs plus only the report fields needed by administrators: completed date, student full name, CI, exam status, score, and the persisted CEFR level code. Email, phone, answers, and other student data are intentionally excluded.

## Filters and history

The RPC accepts an inclusive completed-date range, assigned CEFR level ID, and exam status. It reads `exam.level_id` and its referenced level row, so reports retain the level assigned when the exam was completed even after active score ranges change.

## Pagination and exports

Pages are bounded to 1 through 100 rows. Exports request the same filtered RPC with a maximum of 5,000 rows, preventing unbounded downloads. The UI exports exactly the filtered rows returned by that bounded request.

## Spreadsheet safety

CSV values are escaped for quotes, delimiters, and line breaks. Both CSV and XLSX exports prefix values beginning with `=`, `+`, `-`, or `@` with an apostrophe to prevent spreadsheet formula interpretation.
