# CSCA Prep implementation status

Last updated: 2026-09-03

Branch: `main`

Audited application baseline: `32e36f0`

Remote documentation checkpoint before this audit: `60b52e0`

Full audit: [`docs/AUDIT_2026-09-03.md`](./AUDIT_2026-09-03.md)

## Current phase

The local-demo release is online on GitHub Pages and its engineering foundation is stable.
The project is now in the **production validation and reviewed-content phase**.

GitHub Pages is deliberately configured as `local-demo`. The real Vercel + Firebase
environment is not deployed, so Google sign-in, App Check, cloud persistence, administrator
review and server-authoritative exams have not been exercised on a production domain.

The previously blocked 40-commit delivery reached `main` as a fast-forward. CI
[run 27](https://github.com/bayanbainyrasil-dotcom/CSCA-Prep/actions/runs/33732956076)
and Pages
[run 9](https://github.com/bayanbainyrasil-dotcom/CSCA-Prep/actions/runs/33732956114)
were green on application commit `32e36f0`; `60b52e0` only records that delivery result.

## Last completed batch

The 2026-09-03 full audit covered live functionality, responsive UX, PWA, persistence,
security, onboarding, practice/diagnostic/mock/content coverage, performance and current
competitors.

Remediation applied in the audit batch:

1. Added generated GitHub Pages entrypoints for every static application route. This fixes
   the deployed `/onboarding` behavior where a fresh deep link rendered correctly but
   returned HTTP 404.
2. Raised shared and audited compact touch targets to 48 px and added pressed/current
   semantics to progress filters and lesson steps.
3. Upgraded Firebase Admin `14.3.0` and Firebase Functions `7.3.2`, moved the Functions
   runtime to Node 22, and pinned safe `qs`/`uuid` transitive versions.
4. Added a Pages entrypoint generation test.
5. Replaced the old pre-delivery checkpoint, which incorrectly said the push was blocked.

## Verified state

- Web typecheck: pass.
- Lint: pass with zero warnings.
- Unit/component tests: 515/515 across 46 files.
- Pages entrypoint contract: 1/1.
- Pages production build: pass.
- Functions typecheck and build: pass.
- Web production dependency audit: no known vulnerabilities.
- Functions production dependency audit: no known vulnerabilities.
- Playwright with the configured Chromium fallback: 21 scenarios passed and 32
  project-inapplicable scenarios were skipped; one parallel timezone test failed once and
  then passed alone.
- iPhone and iPad Chromium-profile layout checks: pass, including no horizontal overflow.
- Real WebKit/Safari: not run in this environment; this remains weaker evidence than a real
  iPhone/iPad test. CI on the previous application baseline did run the full browser set.

## Completed capabilities

- React/TypeScript/Vite application with responsive desktop, tablet and mobile shells.
- PWA manifest, service worker, safe-area support, offline warm reopen and update prompt.
- Accessible landmarks, skip link, labelled progress, focus-on-validation-error and reduced
  motion support.
- Real-date onboarding with Mathematics/Physics baseline, language and daily time budget.
- Explicit plan start date, missed-day detection and shift/compress/keep choices.
- Adaptive daily planning whose onboarding prior fades as graded evidence arrives.
- Local-first persistence, durable outbox, conflict records, owner isolation and cloud
  adapter architecture.
- Persistent vocabulary and formula spaced-review records.
- Lessons, practice, diagnostic, mock demo, mistakes, progress, bookmarks and settings.
- Server-authoritative mock lifecycle: trusted composition, timer, answer save, resume,
  submit, grade and review contracts.
- 105-cell prerequisite blueprint, server coverage calculation and fail-closed publication.
- Blueprint-first administrator editor, import dry runs, review queue, content versioning and
  stale-approval invalidation.
- 17 original public practice questions covering six Mathematics cells, with independently
  recomputed answers and full explanation packets.
- Private question import that keeps answer keys/solutions out of learner-readable records.
- AI tutor safety seam: provider abstraction, strict schemas, quotas, shared budget, cache,
  kill switch, injection fencing, exam-mode refusal and verified fallback. The live provider
  remains disabled.
- Strong callable authentication/authorization, App Check, rate limits, audit logging,
  Firestore/Storage rule protections, data export/reset and reauthenticated account deletion.

## Current content truth

- Blueprint: 105 draft cells — 46 Mathematics, 59 Physics.
- Human-verified cells: **0/105**.
- Public authored questions: 17, all still awaiting human review.
- Confidential production mock questions: **0**.
- Production mock coverage: **0**; publication/start correctly refuse with
  `insufficient-verified-coverage`.

The public 17-question seed can be used only for practice. Its answer keys have existed in
public Git history and therefore cannot become confidential mock content even after review.

## Critical blockers

### P0 — production and content

1. Deploy the configured Firebase and Vercel production environments.
2. Create a real administrator account and verify the admin bootstrap.
3. Have a qualified human review the 105-cell blueprint against current official CSCA
   sources, recording source date, reviewer and unresolved differences.
4. Import and human-review the 17 public practice items.
5. Author and independently review a never-public private question bank covering every mock
   cell, language, difficulty and question-type requirement.
6. Finalize privacy/terms for the actual operator, processors and production domain.

### P1 — proof on real systems

1. Prove Google sign-in and synchronization with two real accounts/devices.
2. Run Firestore/Auth/Functions/Storage emulator abuse tests.
3. Run the full 48-question/60-minute production mock lifecycle end to end.
4. Test install, offline reopen, updates, rotation, timers and safe areas on real iPhone and
   iPad Safari.
5. Verify production security headers and add privacy-safe operational monitoring.

### P2 — scale and polish

1. Expand reviewed lessons and questions as complete vertical slices rather than isolated
   questions.
2. Add learner-visible reviewed/unreviewed coverage confidence.
3. Add original short concept videos only where they improve a specific blueprint cell.
4. Calibrate readiness/score confidence using reviewed difficulty and real outcomes.
5. Further split the initial Firebase and heavy visualization/math JavaScript.

## Next exact task

**Human/operator task:** deploy Firebase/Vercel, bootstrap an administrator, and review the
blueprint before approving content. Do not invent a reviewer or self-mark generated content
as verified.

**Next code task that can proceed independently:** add an administrator “official outline
comparison” workflow with source URL, source edition/date, reviewer, last-checked date and
unresolved-difference states. It must store links and review metadata only; do not copy or
redistribute restricted official syllabus text.

## Interruption-safe continuation rules

1. Treat this file and the repository as the source of truth; never rebuild from scratch.
2. Start from the first genuinely unfinished priority above.
3. Preserve honest labels: demo is not production, internal readiness is not an official
   score, authored is not human-verified, and a public answer key is never mock-confidential.
4. Run typecheck, lint, tests, build, Functions checks and relevant browser tests separately.
5. Before stopping, commit a coherent batch and update this checkpoint with completed work,
   checks, remaining blockers and the next exact task.
