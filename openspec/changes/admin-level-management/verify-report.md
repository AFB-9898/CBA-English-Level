```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:pending-worktree-attribution
verdict: pass-with-warnings
blockers: 0
critical_findings: 0
requirements: 13/13
scenarios: 19/19
test_command: npx vitest run
test_exit_code: 0
test_output_hash: sha256:511ac8319ae7da1bb0f3c8e8270a648ce49e905e5e94ea18b82583d84a6fabe1
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:892bbc0eb50fce34408d4dc3812ff9edd6705a9ed9900061cdea2b172ded13ce
```

# Verification Report: admin-level-management

## Final verdict

**PASS WITH WARNINGS.** Standard verification applies (`strict_tdd: false`). All six completed work units have runtime evidence. The prior false-success deactivation path is resolved: the UI derives and displays a before/after full distribution, confirms once, invokes only `replace_active_level_distribution`, and shows success only for a non-null successful response.

## Completeness

| Item | Status | Evidence |
|---|---|---|
| Tasks 1 and 6 | Complete | Preserved completion in merged apply progress #254; migration cleanup and route/sidebar regressions pass. |
| Reopened tasks 2–5 | Complete | Merged apply progress #254 and latest correction records #317–#323. |
| Pending tasks | None | `tasks.md` has six completed work units and no unchecked task markers. |

## Runtime evidence

| Command | Exit | Result |
|---|---:|---|
| `sg docker -c 'docker info'` | 0 | Docker daemon available; 11 containers running. |
| `sg docker -c 'supabase db reset --local'` | 0 | Recreated local database and applied authoritative migrations `001`–`006`. The only warning was the pre-existing unmatched optional `supabase/seed.sql` pattern. |
| `sg docker -c 'supabase test db'` | 0 | `supabase/tests/level_management.sql`: **21/21** pgTAP assertions passed. Output SHA-256: `sha256:ad69dbbc23bead062bb17bf2cf2c6b9fab173587b38ffa20551fbb77f6670db1`. |
| `sg docker -c '<real authenticated two-session psql harness>'` | 0 | Session A committed atomic target deactivation at revision 2; session B was rejected with `40001 Level distribution revision is stale`; final revision is exactly 2. |
| `npm run build` | 0 | TypeScript build and Vite production build passed. Output SHA-256: `sha256:892bbc0eb50fce34408d4dc3812ff9edd6705a9ed9900061cdea2b172ded13ce`. |
| `npx vitest run` | 0 | **24 files / 179 tests** passed. Output SHA-256: `sha256:511ac8319ae7da1bb0f3c8e8270a648ce49e905e5e94ea18b82583d84a6fabe1`. |
| `git diff --check` | 0 | No whitespace errors. Exact empty-output SHA-256: `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`. |

Coverage has no configured threshold. No remote, production, branch, commit, push, or deployment state was changed.

## Atomic-deactivation evidence

| Required behavior | Evidence | Status |
|---|---|---|
| One revision-guarded full-distribution RPC | `006` exposes only `replace_active_level_distribution(BIGINT, JSONB, UUID)`; the hook always sends revision, complete list, and optional target; obsolete isolated RPCs are dropped and pgTAP-proved absent. | ✅ |
| Deterministic middle, boundary, and odd redistribution | SQL derives immediate neighbors over the complete active catalog; pgTAP covers middle, both boundaries, and odd width with the extra score assigned to the upper neighbor. | ✅ |
| Before/after UI and a single real mutation | `LevelsScreen` renders removed target plus changed neighbor ranges, asks one confirmation, makes one hook call, and gates success on non-null data. Focused UI coverage is included in the passing full Vitest run. | ✅ |
| No standalone or false-success path | `useLevels` exposes no `deactivateLevel`; null/missing/error results do not produce success. Hook and screen regressions cover this contract. | ✅ |
| Selective versioning and historical preservation | SQL runtime tests prove only changed neighbors are versioned, target stays one inactive historical row, and historical `question`/`exam` FKs remain unchanged. | ✅ |
| Audit and authorization | SQL runtime tests prove authenticated admin actor plus trusted target before/after and neighbor version audits; direct writes and non-admin calls are rejected. | ✅ |
| Stale conflict, two-session concurrency, atomic rollback | pgTAP proves invalid/stale rollback of rows, audit, and revision. The independent two-session harness proved exactly one success and one `40001` stale rejection. | ✅ |

## Requirement and scenario compliance matrix

| Requirement | Scenario coverage | Result |
|---|---|---|
| L1 Catalog and coverage | Invalid catalog/range; exact 0–100 partition and deterministic boundary classification in pgTAP | ✅ COMPLIANT |
| L2 Versioning and historical integrity | Historical question/exam references, inactive target, selective neighbor versions in pgTAP | ✅ COMPLIANT |
| L3 Authorization and audit | Admin-only mutation, audit actor and trusted before/after, no unauthorized audit visibility in pgTAP | ✅ COMPLIANT |
| L4 Authoritative migrations and classification | Local reset applies only `supabase/migrations/001`–`006`; active-only classification verified at 0 and 100 | ✅ COMPLIANT |
| L5 Contract verification | Bounds, gaps, overlaps, versioning, atomic target deactivation, audit, rollback, and real two-session concurrency | ✅ COMPLIANT |
| C1 Separate migration and cleanup | Additive `006`, immutable `005`, official reset after documented duplicate cleanup | ✅ COMPLIANT |
| C2 Atomic full partition | Exact active-ID validation, revision/advisory locks, selective versioning, historic FK retention, and rollback | ✅ COMPLIANT |
| C3 UI and mandatory evidence | Before/after UI, confirmation, one RPC, conflict reload, reset, SQL, two-session, Vitest, and build evidence | ✅ COMPLIANT |
| Q2 Active question creation | Active-level success, invalid/inactive validation, and concurrent deactivation regression in Vitest | ✅ COMPLIANT |
| Q5 Active/historical consumption | Active-only ordered loading and unchanged historic references through repartition | ✅ COMPLIANT |
| S1 Sidebar structure | Five named navigation links and Levels icon in passing route/layout tests | ✅ COMPLIANT |
| S3 Registered placeholders | Students/Audit Log placeholders and Questions/Levels routes remain navigable and active-state aware | ✅ COMPLIANT |
| S5 Bilingual Levels navigation | Locale-backed Levels navigation label/accessibility regression remains covered | ✅ COMPLIANT |

**Totals:** **13/13 requirements** and **19/19 scenarios** have passed covering runtime evidence.

## Design coherence

| Design decision | Status | Evidence |
|---|---|---|
| Backend is authoritative | ✅ | SQL, not UI payload trust, derives and validates target redistribution under auth and locks. |
| Target is historical, not deleted | ✅ | Target is marked inactive without a replacement UUID; FKs remain valid. |
| Only immediate changed neighbors version | ✅ | SQL update/insert loop selects only changed submitted ranges; pgTAP confirms unaffected UUIDs/versions survive. |
| Frontend is a safe preview client | ✅ | It computes the prescribed preview, but the server independently validates the exact result. |
| Existing level-management behavior remains compatible | ✅ | Metadata RPC and generic complete-distribution editing remain supported; questions consume active rows; routes/sidebar behavior passes. |

## Findings

### CRITICAL

None.

### WARNING

1. The worktree is materially dirty with unrelated modified, deleted, and untracked artifacts, so this verification cannot establish a clean release/merge attribution boundary. No implementation change was made during verification other than this required report.
2. Vite reports a 553.47 kB minified JavaScript bundle, above the 500 kB warning threshold. This does not fail the build but remains a performance concern.
3. The local two-session harness intentionally leaves the local-only database at revision 2 after proving concurrency. It did not touch a remote or production database.

### SUGGESTION

Create an attributable branch/worktree or stage only the intended change artifacts before release review; consider code splitting the Vite bundle.

## Finalization recommendation

**Eligible to finalize the approved atomic-deactivation correction after scope isolation.** Do not treat the current dirty worktree itself as a release-ready merge unit. No corrective implementation loop is required by this verification.

## Skill resolution

`sdd-verify` executed in standard mode; strict TDD module was not loaded because `openspec/config.yaml` sets `tdd: false`. CodeGraph was used for implementation/call-path inspection. No Judgment Day or additional correction/refuter loop was started, as required for independent final verification.
