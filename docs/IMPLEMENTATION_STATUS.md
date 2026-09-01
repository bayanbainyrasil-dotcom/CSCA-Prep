# CSCA Prep Implementation Status

Last updated: 2026-09-01 19:20 +05:00
Branch: `main`
Verified batch awaiting push: `a74916a`, `cdac000`, and this documentation commit — see "Deployment Status".
Last commit on `origin/main`: `24be373fda7b462301ca5b9b10de4f5a90899492`
Last commit actually published to GitHub Pages: `a17e759792da83e04038782758737fe1dd19864c`

## Current Phase

Phase A — repair the release pipeline. New feature work (server-authoritative mock,
content blueprint, plan start date) stays paused until CI and GitHub Pages are green
on one release commit and the live site serves that commit.

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

## Current Task

Push the verified batch and confirm GitHub CI + GitHub Pages are green, then confirm the
live asset hash equals the hash produced by the released commit.

**Blocked:** this session's git proxy refuses to push —
`bayanbainyrasil-dotcom/CSCA-Prep is not in this session's authorized repository set`.
No credential is invented and no second repository is created. Commits `a74916a` and
`cdac000` exist locally and are fully verified; they need repository write access to land.

## Next Exact Task

1. Push `a74916a` and `cdac000` to `origin/main`.
2. Watch the `CI` and `Deploy to GitHub Pages` runs for the pushed head SHA and confirm both succeed.
3. Confirm the live entry bundle is `assets/index-D04av4E_.js` (the hash the current tree
   produces under `VITE_BASE_PATH=/CSCA-Prep/ VITE_DEPLOYMENT_MODE=local-demo`) rather than
   the currently served `assets/index-weX9TM2E.js`.
4. Then, and only then, resume Phase D (server-authoritative mock): add strict
   `startMockExam` / answer-save / `submitMockExam` schemas and callables that return
   prompt-only question data, grade from private `questionSolutions`, and make the
   submitted/completed/graded transition server-owned.

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
- **New in this batch:** shared question-bank contract compiles and behaves identically under
  Zod 3 and Zod 4; rules source-contract test is line-ending independent; repository-wide LF
  normalization; Functions dev-tooling advisories cleared.

## Partial

- Phase B production: code/configuration ready; no real Firebase/Vercel resources, no production URL.
- Google login/profile restoration implemented but never verified on a real production domain or iPhone Safari.
- All named progress entities have local/cloud sync paths; no real two-device proof.
- Conflict resolution and daily-plan merge code exists; no dedicated automated concurrency coverage.
- Mock: answer-key access through ordinary grading and generic trusted-result writes are closed;
  server-authoritative start/finalization and production UI wiring remain.
- Learning/content/mock/admin areas have working foundations; the P1-P5 requirements are not complete.

## Not Started

- Plan start date model (`planStartDate`, `currentPlanDay`, completed/paused days) and missed-day choices.
- Skill graph, prerequisite repair engine, verified coverage dashboard, production mock engine.
- Complete verified foundation curriculum and trainer/support expansions.
- Advanced mastery, relapse, timing, scratchpad, analytics, readiness confidence.
- Full admin editors/validators/source tooling.
- Privacy Policy, Terms, retention policy, data export from cloud, account deletion.
- Accessibility fixes (progressbar accessible name, `<main>` landmark, skip link, 48px targets).
- Deep-link HTTP 200 strategy and explicit SEO decision.

## Tests

Run in this session on the tree of `cdac000` (code identical to the tree this documentation commit records). Every line below was executed; nothing is
marked passing from memory.

| Check | Command | Result |
|---|---|---|
| Root typecheck | `pnpm typecheck` | **pass** (was `TS2554` before this batch) |
| Lint | `pnpm lint` | **pass**, 0 warnings |
| Unit/component/contract tests | `pnpm test` | **pass**, 14 files / 71 tests (was 12 / 59) |
| Production build | `pnpm build` | **pass**, 14-entry PWA precache, 360.22 KiB |
| Pages-configuration build | `VITE_BASE_PATH=/CSCA-Prep/ VITE_DEPLOYMENT_MODE=local-demo pnpm build` | **pass**, 11-entry precache, 361.07 KiB |
| Functions typecheck | `pnpm --dir functions typecheck` | **pass** |
| Functions build | `pnpm --dir functions build` | **pass** |
| Playwright, desktop project | `playwright test --project=desktop` | **pass**, 11 passed / 3 skipped |
| Playwright, iphone + ipad projects | `playwright test` | **not run** — see limitations |
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
- Dashboard plan day still derives from account/profile creation rather than a plan start date.
- Practice/vocabulary surfaces still show static "Recommended", "8 due" and "Adaptive next interval"
  text that is not computed from user data.
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

1. Obtain repository write access, push `a74916a` and `cdac000`, and confirm both workflows go green.
2. Confirm the live bundle hash matches the released commit's build output.
3. Bump the deprecated Pages actions (`configure-pages`, `upload-pages-artifact`, `deploy-pages`,
   `upload-artifact`, `dependency-review-action`) in one commit and confirm the Pages run stays green.
4. Resume Phase D: strict server contracts for starting, saving, and finalizing a mock without
   exposing private solutions; keep the built-in flow only in `local-demo` mode.
5. Run Firestore Rules emulator abuse tests once a Java runtime and a Firebase test project exist.
6. Run root and Functions typecheck/lint/tests/build after each atomic batch, and record the actual
   commands and results here rather than a summary claim.
