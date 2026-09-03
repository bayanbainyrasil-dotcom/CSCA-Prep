# CSCA Prep implementation status

Last updated: 2026-09-03

Branch: `main`

Published application head: `15790e7`

Pre-audit documentation checkpoint: `60b52e0`

Full audit: [`docs/AUDIT_2026-09-03.md`](./AUDIT_2026-09-03.md)

## Current phase

The local-demo release is online on GitHub Pages and its engineering foundation is stable.
The project is now in the **production validation and reviewed-content phase**.

GitHub Pages is deliberately configured as `local-demo`. The real Vercel + Firebase
environment is not deployed, so Google sign-in, App Check, cloud persistence, administrator
review and server-authoritative exams have not been exercised on a production domain.

The audit remediation is published. CI
[run 40](https://github.com/bayanbainyrasil-dotcom/CSCA-Prep/actions/runs/33735831342)
and Pages
[run 12](https://github.com/bayanbainyrasil-dotcom/CSCA-Prep/actions/runs/33735831350)
are green on application commit `15790e7`. The live entry asset
`assets/index-DH7mYLpG.js` matches the local Pages build exactly.

## Last completed batch

The 2026-09-03 full audit covered live functionality, responsive UX, PWA, persistence,
security, onboarding, practice/diagnostic/mock/content coverage, performance and current
competitors.

Remediation applied in the audit batch:

1. Added generated GitHub Pages entrypoints for every static application route. This fixes
   the deployed `/onboarding` behavior where a fresh deep link rendered correctly but
   returned HTTP 404. The built-in published demo lesson is included as well.
2. Raised shared and audited compact touch targets to 48 px and added pressed/current
   semantics to progress filters and lesson steps.
3. Upgraded Firebase Admin `14.3.0` and Firebase Functions `7.3.2`, moved the Functions
   runtime to Node 22, and pinned safe `qs`/`uuid` transitive versions.
4. Added a Pages entrypoint generation test.
5. Replaced the old pre-delivery checkpoint, which incorrectly said the push was blocked.

## Official-outline review workflow — 2026-09-03 (this batch)

The workflow the previous checkpoint named as the next code task. Built on `5a7dd04`,
verified locally, **not yet pushed from this session** — see the delivery note below.

Outline review asks whether a cell still corresponds to something the current official
materials require. That is a different question from whether a question is correct, and the
two are kept apart deliberately: a test asserts that with all 109 cells confirmed against a
dated source, coverage is still 0.

- Five statuses: `unreviewed`, `matches-source`, `difference-found`, `needs-specialist`,
  `superseded`.
- Every judgement except "needs a specialist" requires a linked, named, dated source. Every
  judgement that is not a plain match requires the reviewer to say what differs, in their
  own words.
- Reviewer, uid, review time and last-checked time are stamped from the authenticated
  caller; the request schema has no field for any of them.
- Reviews are written against a specific cell version. A cell that moves between reading
  and submitting is refused, and an existing review lapses to stale the moment its cell is
  edited. The screen labels it "Lapsed" rather than dropping it.
- No official material is stored: strict schema, `ownSummary` capped at 400 characters,
  `differenceNote` at 1000, and the reviewer attests the words are their own. The audit
  entry carries the status and cell id, never the note.
- Administrator screen at `/admin`, stating on its face that recording a check moves no
  coverage number.

### Four required-area gaps found and filled with unconfirmed drafts

| Area | Finding | Cell added |
| --- | --- | --- |
| Diffraction | The word occurred nowhere in the seed | `phys-optics-single-slit-and-grating` |
| Kinetic theory | Nothing covered the molecular model; `phys-thermodynamics-gas-laws` is macroscopic | `phys-thermodynamics-molecular-kinetic-energy` |
| Interference | Only inside `phys-waves-wave-behaviour`, one of four behaviours under `minimumItems: 3` | `phys-optics-path-difference-fringes` |
| Solid geometry | `math-3d-geometry-3d-distance` covers 3D coordinates; mensuration matched nothing | `math-solid-geometry-volume-surface-area` |

A first pass reported solid geometry as wholly absent. That was wrong and is corrected
here. Each added cell says in `knownLimitations` that the requirement itself is
unconfirmed and names what a reviewer must do — confirm it against a dated source, or
delete it. An unnecessary cell inflates the denominator exactly as a missing one deflates
it. Evidence and grep output: `docs/blueprint/COVERAGE_GAPS.md`.

### Checks, each run separately on `606400d`

| Check | Result |
| --- | --- |
| `pnpm typecheck` | pass |
| `pnpm lint` (`--max-warnings 0`) | pass |
| `npx vitest run` | 48 files, 557 tests, pass |
| `pnpm test:pages` | 1 pass, 0 fail |
| `pnpm build` | pass |
| `functions: npm run typecheck` | pass |
| `functions: npm run build` | pass |
| `pnpm audit --prod` | no known vulnerabilities |
| `pnpm --dir functions audit --prod` | no known vulnerabilities |
| `node scripts/check-bundle-secrets.mjs` | pass — 83 files, 34 solution strings absent |
| Playwright desktop / iPhone / iPad | 22 passed, 32 skipped by design |
| Firestore/Auth/Functions/Storage emulator abuse tests | **not run** — the emulator suite cannot be downloaded from this environment |
| Live smoke test | **not run** — nothing new is deployed |

Playwright ran with `PLAYWRIGHT_CHROMIUM_PATH` pointed at a local Chromium, so the phone
and tablet projects exercised their viewport profile on Chromium rather than real WebKit.
That is weaker evidence and does not replace the real-device checklist.

### Delivery note

`git push` from this sandbox session is refused by its credential proxy:
`bayanbainyrasil-dotcom/CSCA-Prep is not in this session's authorized repository set`.
`git fetch` works because the repository is public and reads need no credential. This is a
property of the sandbox, not of the GitHub account — the previous batch was pushed
successfully from the owner's own environment. Commits are delivered as
`csca-prep-verified.bundle` and `csca-prep-verified.patch`.

Also added earlier in this session and included in the same delivery:
`scripts/verify-deployment.mjs` (post-deploy verifier that reads `vercel.json` and asks a
running origin whether it serves what the config promises), `scripts/preview-with-headers.mjs`
(serves `dist/` with those headers locally) and `docs/DEPLOYMENT.md` (the deployment runbook
and its eight owner decisions).

## Verified state

- Web typecheck: pass.
- Lint: pass with zero warnings.
- Unit/component tests: 515/515 across 46 files.
- Pages entrypoint contract: 1/1.
- Pages production build: pass.
- Functions typecheck and build: pass.
- Web production dependency audit: no known vulnerabilities.
- Functions production dependency audit: no known vulnerabilities.
- Local Playwright with the configured Chromium fallback: 21 scenarios passed and 32
  project-inapplicable scenarios were skipped; one parallel timezone test failed once and
  then passed alone. CI then passed 22 scenarios, including that timezone flow.
- iPhone and iPad Chromium-profile layout checks: pass, including no horizontal overflow.
- Real Safari hardware: not run. CI includes the configured WebKit device projects where
  each scenario applies, but that remains weaker evidence than a real iPhone/iPad test.
- Live deep-link verification: `/onboarding/`, `/practice/session/` and the built-in demo
  lesson return HTTP 200; manifest and service worker return HTTP 200.

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

- Blueprint: 109 draft cells — 47 Mathematics, 62 Physics. Four were added on 2026-09-03
  to close required-area gaps; their requirement is itself unconfirmed (see below).
- Human-verified cells: **0/109**.
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

**Done in this batch:** the administrator official-outline comparison workflow. Source URL,
edition and date, server-stamped reviewer and last-checked date, five review states, a
version guard, an audit log, and no storage of official text.

**Next code task that can proceed independently:** Firestore/Auth/Functions/Storage
emulator abuse tests (audit P1-2). The source-contract tests assert the rules file; they do
not prove the rules engine refuses a real hostile request. This environment cannot download
the emulator suite, so the first step is to check whether it can be vendored or whether this
becomes an owner-run task. If it cannot run here, the next independent task is the reviewed
content pipeline: one Mathematics and one Physics vertical slice authored entirely as
unreviewed drafts.

## Interruption-safe continuation rules

1. Treat this file and the repository as the source of truth; never rebuild from scratch.
2. Start from the first genuinely unfinished priority above.
3. Preserve honest labels: demo is not production, internal readiness is not an official
   score, authored is not human-verified, and a public answer key is never mock-confidential.
4. Run typecheck, lint, tests, build, Functions checks and relevant browser tests separately.
5. Before stopping, commit a coherent batch and update this checkpoint with completed work,
   checks, remaining blockers and the next exact task.
