# CSCA Prep Implementation Status

Last updated: 2026-09-01 20:30 +05:00
Branch: `main`
Verified commits awaiting push: `a74916a`, `cdac000`, `22f7c18`, `7295134`, `4917069`, `cbacedb`, `83f7fd9`, `e3e5bc9`, `a555917`, `9a62d26`, and this documentation commit — see "Deployment Status".
Last commit on `origin/main`: `24be373fda7b462301ca5b9b10de4f5a90899492`
Last commit actually published to GitHub Pages: `a17e759792da83e04038782758737fe1dd19864c`

## Current Phase

Phase A is code-complete and verified locally but cannot be finished: pushing is
externally blocked, so CI, GitHub Pages and the live asset hash cannot be confirmed.
Work continued on Phase D (server-authoritative mock), Phase F (plan start date and missed
days) and Phase G (real personalization and persistent trainer progress), none of which
needs credentials.

## Last Completed

Reproduced and fixed both release-blocking failures, and independently proved that the
published site is older than `origin/main`:

1. **Root typecheck (was red).** `src/features/practice/grading-contract.test.ts` imports
   `functions/src/schemas.ts`, so the shared Functions contract is compiled by the web
   toolchain (Zod 4) as well as the Functions toolchain (Zod 3). Zod 4 removed the
   one-argument `z.record(value)` overload, producing
   `functions/src/schemas.ts(110,4): error TS2554: Expected 2-3 arguments, but got 1.`
   Because `pnpm build` runs `tsc -b && vite build`, this failed CI **and** the Pages build.
   Fixed by passing the key schema explicitly and bounding parameter keys to 1..120 chars.
2. **Firestore rules source-contract test (OS-dependent).** It compared `\n` multi-line
   fragments against the raw `firestore.rules`, so it failed on a CRLF checkout. The test
   now normalizes line endings, a regression case asserts the contract against a CRLF
   variant, and `.gitattributes` checks text files out as LF on every platform.
3. **Functions dev-tooling advisories.** `firebase-tools` 13.35.1 -> 15.28.2.

Then Phase D, the server-authoritative mock, in two commits:

Then Phase G, real personalization, in one commit:

8. **`9a62d26`.** Onboarding levels now reach `buildAdaptiveDailyPlan` as a prior whose
   strength decays to zero over the first 20 graded answers; the stated daily minutes stay
   a hard budget while exam proximity shifts the mix; vocabulary and formula reviews are
   recorded through the local-first repository with interval, due date, lapses, quality and
   correct/incorrect counts, so they survive a reload and sync; and the static
   "Recommended: force recognition", "8 due" and "Adaptive" claims are replaced with values
   computed from the learner's own records or with an honest "nothing measured yet".
   `pickLocalized` applies the chosen explanation language with a stated English fallback.

Then Phase F, the plan calendar, in two commits:

6. **`83f7fd9` — plan model.** `StudyPlan` as a synced entity with an explicit
   `planStartDate`, completed and paused days, an exam date and a missed-day policy, plus
   the pure calendar logic in `src/features/plan/plan-schedule.ts`. A missed day is always a
   question, never an automatic change. `migrateLegacyStudyPlan` derives the start date from
   the profile creation day in the learner's timezone, so no recorded progress is invalidated.
7. **`e3e5bc9` — plan wiring.** Dashboard, sidebar and roadmap read the plan day from the
   stored plan through `usePlanStatus`, which falls back to the old calculation until the
   plan hydrates. `MissedDaysPrompt` offers the three choices with their consequences.
   Completing the last block of a daily plan marks that calendar day done.

Phase D detail:

4. **`7295134` — server engine.** `functions/src/mock-engine.ts` (pure prompt projection,
   exam clock, grading, idempotent answer application) and `functions/src/mock-callables.ts`
   (`startMockExam`, `resumeMockExam`, `saveMockAnswer`, `submitMockExam`, `reviewMockExam`).
   The exam order and window are snapshotted onto the attempt at start, so editing a
   template mid-attempt cannot change what a running attempt is graded against. A question
   with no published solution counts as skipped, never correct. Rules now make an attempt
   carrying `questionIds`/`durationSeconds` read-only to the browser — without that a client
   could update an open server attempt with a payload omitting those keys and erase the
   recorded exam order and clock.
5. **`4917069` — production UI.** `mock-service.ts` with `.strict()` response schemas (an
   open attempt carrying an answer key is rejected client-side), `ServerMockRunner`,
   `ServerMockResults`, published-blueprint listing, and full state coverage: loading,
   restoring, saving, save-failed with retry, offline, expired, submitting, restored notice
   and readable errors derived from the error code only. The built-in template mock is
   unchanged in behaviour and now labelled "Local demo" everywhere it appears.

## Current Task

Two things are open, one blocked and one not.

Blocked: push the verified commits and confirm GitHub CI + GitHub Pages are green, then
confirm the live asset hash equals the hash produced by the released commit.

**Blocker, re-tested and still present:** the session git proxy refuses to push —
`bayanbainyrasil-dotcom/CSCA-Prep is not in this session's authorized repository set`.
No credential is invented and no second repository is created. All six commits exist
locally and are fully verified; they need repository write access to land. Each batch is
also exported as a `.bundle` and a `.patch` so nothing depends on this session surviving.

Not blocked: Phase D is code-complete. See "Next Exact Task".

## Next Exact Task

Not blocked — start here: **Phase E, the content blueprint.** This is now the single
biggest gap between the app and a usable exam preparation tool, and it also blocks the
production mock: `startMockExam` refuses an incomplete blueprint, so no server-graded mock
can run until published `examTemplates` exist. First concrete step: define the
`subject -> module -> topic -> skill -> micro-skill -> prerequisite -> difficulty ->
question type` matrix as a typed structure with per-cell coverage count, verification
status, source type, reviewer and review date, then add the admin coverage validation that
refuses to publish a mock with empty or unverified cells. Diagnostic and mock composition
follow the blueprint after that.

Superseded, for reference — the previous next task was **Phase G, real personalization**: it is complete as of `9a62d26`.

Still blocked, retried this session: Firestore Rules emulator abuse tests (Phase C). Java 21
is present, but the emulator jar download host `storage.googleapis.com` is outside this
environment's network allowlist. Run these wherever that host is reachable, or in CI.

Blocked release sequence, to run the moment push access exists:

1. Push `a74916a`, `cdac000`, `22f7c18`, `7295134`, `4917069` and this commit to `origin/main`.
2. Watch the `CI` and `Deploy to GitHub Pages` runs for the pushed head SHA and confirm both succeed.
3. Confirm the live entry bundle hash changes away from the currently served
   `assets/index-weX9TM2E.js`. Rebuild the released commit with
   `VITE_BASE_PATH=/CSCA-Prep/ VITE_DEPLOYMENT_MODE=local-demo pnpm build` and compare.
4. Bump the deprecated Pages actions and confirm the Pages run stays green.

## Evidence for the Release State

- CI run `33516444588` on `24be373`: **failure**, job "Typecheck, lint, test, and build",
  `functions/src/schemas.ts` line 110, "Expected 2-3 arguments, but got 1".
- Pages run `33516444542` on `24be373`: **failure**, "Build site" job, same TypeScript error.
  The run also reports a deprecation warning: `actions/configure-pages@v5` runs on Node 20,
  which GitHub Actions runners no longer support.
- Rebuilding commit `a17e759` with the Pages configuration reproduces **exactly** the live
  assets (`assets/index-weX9TM2E.js`, `assets/index-apE66VRr.css`). Rebuilding the current
  tree produces `assets/index-D04av4E_.js`. This proves the published site is `a17e759`
  and that neither `40ad32e` nor `24be373` ever reached GitHub Pages.
- The GitHub Actions *list* page renders these runs as if they succeeded; the individual run
  pages and the locally reproduced failure are authoritative. Do not trust the list view.

## Completed

- React/TypeScript/Vite/Tailwind PWA architecture and responsive application shell.
- GitHub Actions typecheck, lint, unit, Functions build, Playwright, and Pages workflows exist.
- GitHub Pages local demo at `https://bayanbainyrasil-dotcom.github.io/CSCA-Prep/` (serving `a17e759`).
- Firebase client architecture, strict Firestore/Storage rules, callable Functions, App Check
  integration, Google Auth flow, protected admin bootstrap design, and server-side practice grading.
- Dexie local-first repository, durable outbox, sync cursor, conflict records, and version/mutation contracts.
- Dashboard, Today, Roadmap, lessons, practice, diagnostics, vocabulary, formulas, mental math,
  mistakes, progress, bookmarks, notes, search, settings, and admin foundations.
- Real exam-date onboarding, device-timezone refresh/travel handling, local date rollover, and 180-minute daily target.
- Vercel configuration, security headers, SPA rewrite, and fail-closed Firebase deployment validation.
- Mental Math generation verified over 10,000 generated cases.
- Demo lesson resolution that uses matching published seed content and rejects unknown lesson IDs.
- Ordinary `gradeQuestion` rejects `mock` at strict schema validation before any question or solution read.
- Browser-authored `examAttempts` limited to exact draft data with null `submittedAt`/`result`;
  nested mock answers require an exactly `in-progress` parent.
- Shared question-bank contract compiles and behaves identically under Zod 3 and Zod 4;
  rules source-contract test is line-ending independent; repository-wide LF normalization;
  Functions dev-tooling advisories cleared.
- **Phase G — personalization and trainer progress.** Onboarding levels as a decaying prior,
  daily-minute budget respected, exam proximity shifting the mix, persistent vocabulary and
  formula review state (mastery, interval, due date, lapses, quality, correct/incorrect),
  owner-scoped records, and every previously static "recommended"/"due"/"adaptive" claim
  either computed or removed.
- **Phase F — plan calendar.** Explicit plan start date, current plan day, completed and
  paused days, missed-day detection and the three learner choices, timezone-safe day maths,
  exam-date boundary, and a migration that preserves the day number an existing learner saw.
- **Phase D — server-authoritative mock.** Trusted start/answer/submit/review lifecycle,
  server-owned timing and status, grading from private solutions, idempotent mutations,
  prompt-only question payloads, rules that make a server attempt read-only to the browser,
  and a production UI that never computes a score. The built-in mock is retained only as a
  clearly labelled local demo.

## Partial

- Phase B production: code/configuration ready; no real Firebase/Vercel resources, no production URL.
- Google login/profile restoration implemented but never verified on a real production domain or iPhone Safari.
- All named progress entities have local/cloud sync paths; no real two-device proof.
- Conflict resolution and daily-plan merge code exists; no dedicated automated concurrency coverage.
- Mock: the engine, rules and UI are complete, but nothing has been exercised against a real
  Firebase project or emulator. The design is verified by unit, component and rule-source
  tests only.
- Mock content: `startMockExam` refuses an incomplete blueprint, but no published
  `examTemplates` document exists yet, so the production path has never run end to end.
- Learning/content/mock/admin areas have working foundations; the P1-P5 requirements are not complete.

## Not Started

- Skill graph, prerequisite repair engine, verified coverage dashboard, exam blueprint
  matrix, and the admin coverage gate that blocks publishing an incomplete mock.
- The explanation language is applied on the vocabulary trainer; lessons, practice feedback
  and formula copy still render their English fields only.
- No published `examTemplates` blueprint exists, so the server-graded mock cannot run
  end to end yet.
- Complete verified foundation curriculum and trainer/support expansions.
- Advanced mastery, relapse, timing, scratchpad, analytics, readiness confidence.
- Full admin editors/validators/source tooling.
- Privacy Policy, Terms, retention policy, data export from cloud, account deletion.
- Accessibility fixes (progressbar accessible name, `<main>` landmark, skip link, 48px targets).
- Deep-link HTTP 200 strategy and explicit SEO decision.

## Tests

Run in this session on the tree of `9a62d26`. Every line below was executed on that tree;
nothing is marked passing from memory.

| Check | Command | Result |
|---|---|---|
| Root typecheck | `pnpm typecheck` | **pass** (was `TS2554` before this batch) |
| Lint | `pnpm lint` | **pass**, 0 warnings |
| Unit/component/contract tests | `pnpm test` | **pass**, 26 files / 195 tests (was 12 / 59) |
| Production build | `pnpm build` | **pass**, 14-entry PWA precache, 360.82 KiB |
| Pages-configuration build | `VITE_BASE_PATH=/CSCA-Prep/ VITE_DEPLOYMENT_MODE=local-demo pnpm build` | **pass**, 11-entry precache, 361.07 KiB |
| Functions typecheck | `pnpm --dir functions typecheck` | **pass** |
| Functions build | `pnpm --dir functions build` | **pass** |
| Playwright, desktop project | `playwright test --project=desktop` | **pass**, 11 passed / 3 skipped |
| Playwright, iphone + ipad projects | `playwright test` | **not run in WebKit** — specs exercised as Chromium emulation at the same viewports, 7 passed; see limitations |
| Functions dependency audit (re-run) | `pnpm audit --dir functions` | 2 moderate, unchanged |
| Root dependency audit | `pnpm audit`, `pnpm audit --prod` | **0 known vulnerabilities** |
| Functions dependency audit | `pnpm audit --dir functions` | 2 moderate (was 1 critical / 8 high / 5 moderate) |
| Functions production audit | `pnpm --dir functions audit --prod` | 1 moderate, not reachable (see Known Issues) |
| Zod 3 runtime parity of the changed schema | ad-hoc script against `functions/lib` | **pass**, 8/8 cases |

Limitations of this run:

- The `iphone` and `ipad` Playwright projects use `devices['iPhone 15']` / `devices['iPad Pro 11']`,
  whose `defaultBrowserType` is **webkit**, so they run real WebKit rather than Chromium device
  emulation. This corrects the earlier audit note. They could not run in this environment: the
  Playwright browser CDN is outside the network allowlist
  (`playwright.download.prss.microsoft.com` returns 403). CI installs chromium and webkit and
  does run all three projects.
- Firestore Rules emulator abuse tests still not run (no Java runtime available). The rule-source
  regression test is not a substitute.
- No real Firebase/Functions integration until production or staging resources exist.
- Production build still reports the pre-existing ineffective dynamic import
  (`src/stores/index.ts`) and chunks above 500 kB.

## Known Issues

- **Shared contract is compiled against two different Zod majors.** `functions/src/schemas.ts` is
  built with Zod 3 by the Functions toolchain and with Zod 4 by the web toolchain, through a test
  import. The explicit key schema makes both agree today, and
  `src/features/practice/question-bank-contract.test.ts` guards the runtime behaviour, but the
  durable fix is a shared, single-version contract package. Until then, any Zod-3-only syntax
  added to that file breaks the release build.
- **`actions/configure-pages@v5` runs on Node 20**, which GitHub Actions runners no longer support.
  The Pages workflow currently only warns; it will start failing. Dependabot already has branches
  for `upload-pages-artifact-5`, `upload-artifact-7`, and `dependency-review-action-5`.
  Workflow bumps cannot be verified without push access, so they are deliberately not in this batch.
- Remaining Functions production advisory: `uuid@9.0.1` via
  `firebase-admin -> @google-cloud/firestore -> google-gax`. GHSA-w5hq-g745-h8pq is a bounds check
  in `v3/v5/v6` when an explicit `buf` is passed; these libraries call `v4()` without `buf`, so it
  is not reachable. Clearing it requires firebase-admin 14 (google-gax 5 / uuid 11), a runtime
  major deliberately deferred to the batch that adds emulator tests.
- No real Vercel/Firebase deployment exists; GitHub Pages is browser-local demo mode.
- Mock pages still use client-visible built-in answer data and local score calculation.
- No trusted callable owns the `submitted`/`completed`/`graded` exam transition.
- Direct requests to `/CSCA-Prep/onboarding` return HTTP 404 before the SPA fallback renders.

## Deployment Status

- `origin/main` is `24be373`. Its CI and Pages runs both failed.
- GitHub Pages currently serves `a17e759` (proven by asset-hash reproduction, above).
- Local verified commits awaiting push: `a74916a`, `cdac000`.
- **External blocker:** the session git proxy denies pushes to
  `bayanbainyrasil-dotcom/CSCA-Prep` ("not in this session's authorized repository set").
  The repository must be added to the session's authorized sources with write access.
- Firebase production: blocked by the Google account MFA requirement before Console access.
- Vercel production: GitHub app installation confirmed; the Vercel account still requires
  email login plus a one-time verification code before GitHub can be linked.

## Important Decisions

- GitHub is source control; GitHub Pages remains demo-only; Vercel is the production frontend.
- Vercel cannot opt into `local-demo`; missing cloud configuration is a build error.
- Firebase client identifiers are deployment settings; service credentials and bootstrap values stay server-side.
- Existing IndexedDB tables, local-storage keys, Firestore collections, and progress records are unchanged in this batch.
- Device timezone, not GPS, is the source of calendar-day and schedule calculations.
- Dependency updates are split: dev-only tooling can move on its own; runtime majors wait for tests
  that can actually verify them.

## Schema Changes

- `VocabularyProgressSchema` gains optional `correctCount`, `incorrectCount` and
  `lastQuality`; `FormulaProgressSchema` gains optional `intervalDays`, `lapses`,
  `correctCount`, `incorrectCount` and `lastQuality`. All optional, so records written
  before this batch validate unchanged and pick the counters up on their next review.
- `StudyPlanSchema` gains optional `baseline` (the self-reported onboarding levels).
- The session object gains an optional `baseline`; it is optional precisely so a session
  stored before this change still parses and no learner is signed out by the upgrade.
- New synced entity `study-plan` -> `users/{uid}/studyPlans`. Added to
  `SyncEntityTypeSchema`, `parseSyncEntity`, the Firestore adapter's collection map,
  `isMutableSyncCollection` in the rules, and `resetMyProgress`. The local entities table is
  generic, so no IndexedDB version bump is needed. A learner with no stored plan is migrated
  from their profile creation day on first load, which keeps their previous day number.
- `MockAttemptSchema` gains optional `questionIds` (recorded exam order) and
  `durationSeconds` (server-owned exam window). Both are optional, so every attempt already
  stored keeps validating and no migration is required. Their presence is what marks an
  attempt server-authoritative (`isServerAuthoritativeMockAttempt`), and Firestore rules use
  the same signal to make such an attempt read-only to the browser.
- No client-writable field changed shape. The mock callables are additive.
- `QuestionSchema.templateParameters` keys are now validated by an explicit
  `z.string().min(1).max(120)` key schema instead of the implicit key type of the removed
  one-argument `z.record` overload. Value union, the 50-parameter cap, and every other field are
  unchanged. Verified under Zod 3 and Zod 4: previously accepted parameter maps still parse; only
  empty keys and keys longer than 120 characters are newly rejected. No stored data migration is
  required — no persisted question in the seed content uses such keys.

## Files Changed This Batch

`a74916a`:

- `functions/src/schemas.ts`
- `src/lib/security/firestore-rules-contract.test.ts`
- `src/lib/security/normalize-line-endings.ts` (new)
- `src/lib/security/normalize-line-endings.test.ts` (new)
- `src/features/practice/question-bank-contract.test.ts` (new)
- `.gitattributes` (new)

`cdac000`:

- `functions/package.json`
- `functions/pnpm-lock.yaml`

`7295134` (server mock engine):

- `functions/src/mock-engine.ts` (new)
- `functions/src/mock-callables.ts` (new)
- `functions/src/schemas.ts`
- `functions/src/index.ts`
- `functions/src/platform.ts`
- `firestore.rules`
- `src/domain/models.ts`
- `src/features/mock/mock-engine.test.ts` (new)
- `src/features/mock/mock-contract.test.ts` (new)
- `src/lib/security/firestore-rules-contract.test.ts`

`83f7fd9` (plan model):

- `src/features/plan/plan-schedule.ts` (new)
- `src/features/plan/plan-schedule.test.ts` (new)
- `src/domain/models.ts`
- `src/lib/persistence/firebaseAdapter.ts`
- `firestore.rules`
- `functions/src/index.ts`
- `docs/FIREBASE_SCHEMA.md`

`9a62d26` (personalization and trainer progress):

- `src/features/trainers/review-progress.ts` (new)
- `src/features/trainers/review-progress.test.ts` (new)
- `src/features/i18n/localized-text.ts` (new)
- `src/features/i18n/localized-text.test.ts` (new)
- `src/lib/adaptive/dailyPlan.ts`
- `src/lib/adaptive/dailyPlan.baseline.test.ts` (new)
- `src/stores/appStore.ts`
- `src/stores/trainer-progress.test.ts` (new)
- `src/app/app-data-provider.tsx`
- `src/features/auth/auth-provider.tsx`
- `src/domain/models.ts`
- `src/pages/vocabulary-page.tsx`
- `src/pages/formulas-page.tsx`
- `src/pages/practice-page.tsx`
- `src/pages/roadmap-page.tsx`
- `src/pages/subject-page.tsx`
- `src/test/routes.test.tsx`
- `e2e/demo.spec.ts`

`e3e5bc9` (plan wiring):

- `src/features/plan/use-plan-status.ts` (new)
- `src/features/plan/missed-days-prompt.tsx` (new)
- `src/features/plan/missed-days-prompt.test.tsx` (new)
- `src/stores/appStore.ts`
- `src/app/app-data-provider.tsx`
- `src/pages/dashboard-page.tsx`
- `src/pages/roadmap-page.tsx`
- `src/components/navigation/sidebar.tsx`

`4917069` (production mock UI):

- `src/features/mock/mock-service.ts` (new)
- `src/features/mock/server-mock-runner.tsx` (new)
- `src/features/mock/server-mock-results.tsx` (new)
- `src/features/mock/question-navigator.tsx` (new)
- `src/features/mock/mock-service.test.ts` (new)
- `src/features/mock/server-mock-runner.test.tsx` (new)
- `src/features/mock/production-bundle-contract.test.ts` (new)
- `src/pages/mock-exam-page.test.tsx` (new)
- `src/pages/mock-exam-page.tsx`
- `src/pages/mock-page.tsx`
- `src/pages/mock-results-page.tsx`
- `src/test/routes.test.tsx`

## External Setup Required

- Repository write access for this session so verified commits can be pushed.
- A Firebase staging project and production project with billing where required.
- Google Authentication, Firestore, Storage, Functions, and App Check configuration.
- Firebase web client identifiers for staging and production.
- A one-time bootstrap value entered only into Firebase Secret Manager.
- Final production hostname added to Firebase Auth authorized domains and App Check.
- The user must complete Vercel email verification and Google 2-Step Verification.
  No verification codes belong in this file or in source control.

## Continue From Here

Unblocked work, in order:

1. Phase E — the blueprint matrix, per-cell coverage metadata, the admin coverage gate, and
   diagnostic/mock composition driven by it. This blocks the production mock end to end.
2. Extend the explanation language beyond the vocabulary trainer to lessons, practice
   feedback and formula copy, with the same stated fallback.
3. Phase I — privacy policy, terms, retention, data export and account deletion, before any
   real student uses the app.
4. Phase J — accessibility fixes (progressbar name, `<main>` landmark, skip link, focus on
   validation errors, 48px targets) and the deep-link HTTP 200 / SEO decision.
5. Firestore Rules emulator abuse tests, wherever the emulator jar can be downloaded.

Blocked on repository write access:

5. Push the six verified commits and confirm CI and Pages go green on the pushed head.
6. Confirm the live bundle hash matches the released commit's build output.
7. Bump the deprecated Pages actions (`configure-pages`, `upload-pages-artifact`,
   `deploy-pages`, `upload-artifact`, `dependency-review-action`) and confirm Pages stays green.

Always: run root and Functions typecheck/lint/tests/build after each atomic batch, and record
the actual commands and results here rather than a summary claim.
