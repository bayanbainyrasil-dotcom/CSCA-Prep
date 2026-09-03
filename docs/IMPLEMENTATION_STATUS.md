# CSCA Prep Implementation Status

Last updated: 2026-09-03
Branch: `main`
Local verified head: `14ae4cd` (38 bundle-delivered commits through
`da4c2c4c7eeda4825e67ce6dcc6d98bd98ab32e1`, plus one CI fix made this session).
Last commit on `origin/main`: `24be373fda7b462301ca5b9b10de4f5a90899492` — **unchanged**;
the push is still externally blocked, so nothing new is published.
Last commit actually published to GitHub Pages: `a17e759792da83e04038782758737fe1dd19864c`

## Current Phase

Phase A is code-complete and verified locally but cannot be finished: pushing is
externally blocked, so CI, GitHub Pages and the live asset hash cannot be confirmed.
Work continued on Phase D (server-authoritative mock), Phase F (plan start date and missed
days), Phase G (real personalization and persistent trainer progress) and Phase E1-E8 (the
curriculum blueprint, its server gate, the admin coverage dashboard, the authored slice and
the one-step content import), none of which needs credentials.

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

Then Phase E, the curriculum blueprint, in six commits:

9.  **`f08a39e` — model and validator.** `BlueprintCell` (subject, module, topic, skill,
    micro-skill, prerequisites, difficulty levels, question types, minimum verified items,
    languages, allowed modes, verification status, source type and reference, reviewer,
    review date, version, timestamps) and `BlueprintQuestionRecord`. Coverage is computed
    from the published bank and never from a stored count. `demo` and `draft` were added to
    the verification vocabulary so generated material has an honest home, and a demo item
    cannot be marked verified at all.
10. **`8111394` — server gate and composer.** The logic moved to
    `functions/src/blueprint-engine.ts` so the server and the web share one implementation.
    `composeExam` draws from verified items cell by cell, deterministic per seed, and
    refuses with `insufficient-verified-coverage` rather than returning a short exam.
    New admin callables `getBlueprintCoverage`, `upsertBlueprintCell`,
    `setContentVerification` and `publishMockExam`; verification is stamped from the
    authenticated caller and the server clock and is audit-logged. `startMockExam` re-runs
    the gate rather than trusting publication time. Rules: `blueprintCells` is
    client-write-denied, `examTemplates` is write-denied even for admins so publication must
    go through the gate, and `questions` writes refuse verification fields.
14. **`2b7f5d9` — first authored slice and human review.** 17 original CSCA-style draft items
    covering the six `math-foundation` and `math-linear` cells at their stated minimums,
    difficulties and question types, each with an English prompt, a Russian rendering, a
    worked solution, a short solution and a named mistake behind every distractor. Their
    answers are recomputed independently in the tests. The admin editor now picks the
    blueprint cell first through a searchable, module-grouped list and restricts difficulty,
    type and language to what the cell allows, showing the server's own refusal codes live.
    `ReviewQueue` presents the full packet and records an explicit human decision against a
    named content version.
13. **`ed1e212` — mapping and review guards.** `cellId` and `questionType` are required on
    import; `validateQuestionAgainstCell` refuses a mis-mapped item on both the dry run and
    the real import. Questions carry a `contentVersion` and a `verifiedContentVersion`; an
    import always resets to `pending-review`, approval names the version read and is refused
    if the item changed, and coverage requires the two to match, so a stale approval stops
    counting.
12. **`83c8948` — requirement seed.** 105 cells (46 Mathematics, 59 Physics) built from the
    repository's own topic lists, every one `draft`, unreviewed and undated, with a source
    reference that names the file it came from and states it is not an official CSCA
    specification. The dashboard offers to upload the seed through `upsertBlueprintCell`,
    which still writes everything as draft. 22 tests cover ids, namespacing, the honest
    provenance, the prerequisite graph, and the rejections that must keep holding.
11. **`e47c9e2` — admin coverage dashboard.** Filterable matrix with per-cell verified counts,
    missing languages, difficulties and question types, blockers and warnings with their
    issue codes, and orphan published questions. Nothing shows green unless the cell is
    genuinely covered.

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

**Blocker, re-tested on 2026-09-02 and still present.** `git fetch origin` succeeds, so
the repository is readable and `origin/main` is `24be373`, a strict ancestor of local
HEAD — a plain fast-forward push would apply cleanly. The push itself is refused before
it reaches GitHub:

```
remote: access denied by the git proxy: bayanbainyrasil-dotcom/CSCA-Prep is not in
this session's authorized repository set, so the proxy will not inject a credential
for it. To fix, add the repository to the session's sources.
```

This is the sandbox's own credential proxy, not a GitHub permission: the fix is to add
the repository to this session's authorized sources, which cannot be done from inside the
session. No credential is invented, no force push is attempted, and no second repository
is created. Delivery through the user's own machine was checked too and is not available:
no folder is connected to this session, so the desktop bridge has nothing mounted.

Every commit is fully verified locally and is exported as a `.bundle` and a `.patch`, so
nothing depends on this session surviving. **The project is not published.** CI, Pages and
the live bundle hash cannot be confirmed until the commits land.

Not blocked: Phase D is code-complete. See "Next Exact Task".

## Next Exact Task

**Resume here. E8 is complete in code. The next step needs a person, not a commit.**

**A human must review the 17 authored questions.** Importing them is now one guided
sequence rather than 17 manual forms, but no human has read any of them, so none is
verified and coverage is still 0 of 105. Claude deliberately did not mark its own questions
reviewed: `setContentVerification` stamps the reviewer from the authenticated caller, so
approving them here would mean fabricating a reviewer.

What the person does, once a Firebase deployment and an administrator account exist:

1. Open Admin. The import panel runs a dry run first and writes nothing until confirmed.
2. Import the blueprint draft (105 cells, all stored `draft`, no reviewer).
3. Import the public practice seed (17 items, all stored `pending-review`, no reviewer).
4. Read each packet in the review queue and approve the exact version shown.

The six cells under `math-foundation` and `math-linear` then turn covered **for practice**.
They do not turn covered for a mock, and no approval can change that — see the next section.

### The 17 seed questions are public, permanently

Their `correctAnswer`, `solution` and `shortSolution` are committed to this public
repository and are in its Git history. Anyone can read them. Moving the file into
`functions/src` was the right place for it, but it does not unpublish what Git already
shows, and this file will not pretend otherwise.

The consequence is enforced in code, not merely documented:

- The public seed import marks every item `publicAnswerKey: true` and sets
  `allowedModes: ["practice"]`.
- `countsAsVerifiedCoverage` refuses a `publicAnswerKey` item whenever the mode is `mock`,
  however thoroughly a human reviewed it.
- The coverage report exposes `publicKeyItems` and `excludedForMode`, and the cell reason
  says the key is published rather than implying a missing review.

**A confidential production mock therefore needs questions that have never been published.**
Those arrive through `importPrivateQuestions`: an administrator's own JSON file, chosen in
the browser, parsed in the tab, sent straight to the server and split there — prompt and
options to `questions`, and `correctAnswer`, `solution`, `shortSolution`, `explanation` and
`commonMistakes` to `questionSolutions`, which no learner can read. The file is never put in
React state, never written to `localStorage`, IndexedDB or a cache, never logged and never
committed. `docs/examples/private-question-import.example.json` shows the shape with
obviously fake content.

Coverage today: **0 of 105 cells covered**, 46 Mathematics and 59 Physics, because no
reviewer-verified question exists. `publishMockExam` and `startMockExam` both refuse with
`insufficient-verified-coverage`. That is the intended behaviour, not a defect. The local
demo keeps working throughout and stays labelled a demo.

The next code task, which does not need the review: **E8 — a seeding script or admin action
that imports `DRAFT_QUESTION_SEED` in one step**, so the reviewer does not retype 17 items
into the editor by hand.

Superseded, for reference — the previous next task was **Phase E, the content blueprint**: This is now the single
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
- **Phase E7 — authoring and review.** Blueprint mapping required and validated on import,
  content-versioned approval that resets on any edit, a blueprint-first admin editor, a human
  review packet, 17 independently verified draft questions, and coverage tests over the real
  seed proving that draft, pending, demo, archived and version-stale items count for nothing.
- **Phase E — blueprint machinery.** Cell and item model with full provenance, coverage
  computed from the published bank, the validator (duplicate ids, orphan prerequisites,
  cycles, subject/topic mismatch, missing languages, difficulties and question types,
  questions with no cell, mode coverage, answer-key and difficulty skew), the
  blueprint-driven composer, the trusted admin callables, the publication gate on both
  publish and mock start, server-stamped and audit-logged verification, and the admin
  coverage dashboard.
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
- **No reviewed question exists yet.** 17 items are authored and independently checked, but
  no human has read them, so all 105 cells are empty, coverage is zero, and
  `publishMockExam` and `startMockExam` both refuse. This is the single remaining blocker
  for the server-graded mock, and it is a human task, not a code task.
- The 17 authored items are not yet importable in one step: they would have to be typed into
  the editor individually. A seeding action is the next code task.
- The diagnostic and the built-in mock still generate from four templates and remain
  labelled local demo.
- Complete verified foundation curriculum and trainer/support expansions.
- Advanced mastery, relapse, timing, scratchpad, analytics, readiness confidence.
- Full admin editors/validators/source tooling.
- Privacy Policy, Terms, retention policy, data export from cloud, account deletion.
- Accessibility fixes (progressbar accessible name, `<main>` landmark, skip link, 48px targets).
- Deep-link HTTP 200 strategy and explicit SEO decision.

## Tests

Run in this session on the tree of `2b7f5d9`. Every line below was executed on that tree;
nothing is marked passing from memory.

| Check | Command | Result |
|---|---|---|
| Root typecheck | `pnpm typecheck` | **pass** (was `TS2554` before this batch) |
| Lint | `pnpm lint` | **pass**, 0 warnings |
| Unit/component/contract tests | `pnpm test` | **pass**, 34 files / 329 tests (was 12 / 59) |
| Production build | `pnpm build` | **pass**, 14-entry PWA precache, 361.39 KiB |
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

Bundle delivery attempt, 2026-09-03.

- The 38-commit bundle was verified (`git bundle verify` -> "okay", "records a complete
  history") and its `refs/heads/main` is exactly
  `da4c2c4c7eeda4825e67ce6dcc6d98bd98ab32e1`, as expected.
- `origin/main` is an ancestor of that commit: 38 ahead, 0 behind, so the delivery is a
  pure fast-forward. No merge commit and no force-push is needed or was used.
- `origin/main` is still `24be373`. Its CI run and its Pages run both failed, on
  `functions/src/schemas.ts(110,4): error TS2554` — the Zod 3/4 skew fixed by `a74916a`,
  which is inside the bundle and therefore not yet on GitHub.
- GitHub Pages still serves `a17e759`. The published site is two commits behind
  `origin/main` and 39 behind the verified local head.

**External blocker — the delivery could not be published.** Both write paths are refused:

- `git push origin HEAD:main` -> HTTP 403, "Claude doesn't have GitHub access to
  `bayanbainyrasil-dotcom/CSCA-Prep` for your organization".
- The GitHub API path is refused the same way: `create_branch` ->
  `403 Resource not accessible by integration`. Read access works and the API authenticates
  as `bayanbainyrasil-dotcom`, so this is a missing *contents: write* permission on the
  Claude GitHub App installation, not a credential or a branch-protection problem.
- Because branch creation is refused too, the pull-request fallback is unavailable: a PR
  cannot be opened without first pushing a branch.
- Remedy, by the account owner: install or re-authorize the Claude GitHub App for this
  repository at https://github.com/apps/claude/installations/select_target, or reconnect
  GitHub from claude.ai Settings -> Connectors. Then re-run the fast-forward push.

- Firebase production: blocked by the Google account MFA requirement before Console access.
- Vercel production: GitHub app installation confirmed; the Vercel account still requires
  email login plus a one-time verification code before GitHub can be linked.

## Verification Run — 2026-09-03

Run on the bundle-delivered head, from clean dependencies, each check separately.

| Check | Command | Result |
| --- | --- | --- |
| Web install | `pnpm install --frozen-lockfile` | pass |
| Functions install | `pnpm --dir functions install --frozen-lockfile` | pass |
| Typecheck | `pnpm typecheck` | pass |
| Lint | `pnpm lint` | pass (`--max-warnings 0`) |
| Unit tests | `pnpm test` | pass — 515 tests in 46 files |
| Production build | `pnpm build` | pass — PWA precache 14 entries, 361.82 KiB |
| Functions typecheck | `pnpm --dir functions typecheck` | pass |
| Functions build | `pnpm --dir functions build` | pass |
| End-to-end | `pnpm test:e2e` | pass — 22 passed, 32 skipped |

The end-to-end run used `PLAYWRIGHT_CHROMIUM_PATH`, the documented restricted-machine
fallback: this container has a Chromium that does not match the pinned Playwright build and
cannot download browsers. The 32 skipped cases are the ones that need real WebKit. CI, which
installs Chromium and WebKit properly, is still the authoritative end-to-end signal.

### CI defect found and fixed this session — `14ae4cd`

The web sources import the shared engines, schemas and seeds out of `functions/src`
(`blueprint.ts` re-exports `blueprint-engine`, and the tests import `mock-engine`,
`import-callables` and `index.ts`). So `tsc -b`, `vitest` and `vite build` all need
`functions/node_modules` resolvable — but only the dedicated Functions job installed it.

Reproduced by removing `functions/node_modules` and running `pnpm typecheck`: **89 errors**,
every one of them a missing Functions dependency (`firebase-admin/*`, `firebase-functions/*`)
or an `any` that follows from those. The same gap is what let the root typecheck resolve the
root's Zod 4 instead of the Functions' Zod 3 on `origin/main`.

`14ae4cd` adds `pnpm --dir functions install --frozen-lockfile` to all three jobs that build
the web app — CI `quality`, CI `e2e` (its Playwright web server runs `pnpm build`) and the
Pages deploy — and adds `functions/pnpm-lock.yaml` to each job's dependency cache key. Both
workflow files still parse as valid YAML.

This fix is **required** for the delivered head, not optional: `a74916a` fixes the Zod call
site, but the newer commits pull `firebase-admin`-backed modules into the web program, which
no call-site change can satisfy.

### Live site smoke test — not performed

`https://bayanbainyrasil-dotcom.github.io/CSCA-Prep/onboarding` could not be opened from this
session: the network egress proxy refuses `bayanbainyrasil-dotcom.github.io`
(`curl` -> "CONNECT tunnel failed, response 403"; the fetch tool -> `EGRESS_BLOCKED`). Nothing
was published this session in any case, so the live site still serves `a17e759` and a smoke
test would not have described the delivered work. The routes, onboarding flow, console
cleanliness and the desktop / iPhone / iPad viewport behaviour were instead exercised by the
Playwright suite above, against a real production build served by `pnpm preview`.

## Important Decisions

- GitHub is source control; GitHub Pages remains demo-only; Vercel is the production frontend.
- Vercel cannot opt into `local-demo`; missing cloud configuration is a build error.
- Firebase client identifiers are deployment settings; service credentials and bootstrap values stay server-side.
- Existing IndexedDB tables, local-storage keys, Firestore collections, and progress records are unchanged in this batch.
- Device timezone, not GPS, is the source of calendar-day and schedule calculations.
- Dependency updates are split: dev-only tooling can move on its own; runtime majors wait for tests
  that can actually verify them.

## Schema Changes

- New `blueprintCells` collection: client-read, client-write-denied. `examTemplates` is now
  write-denied for every client including administrators, because publication must run
  through `publishMockExam`, which recomputes coverage first.
- `QuestionSchema` now **requires** `cellId` and `questionType`: an item that answers no
  stated requirement cannot be imported.
- Questions carry `contentVersion` (bumped by every content write) and
  `verifiedContentVersion` (what a reviewer read). Coverage requires the two to match.
- `verificationStatus` gains `pending-review`, where authored content waits for a human.
- The former statement that `QuestionSchema` gains optional `cellId` and `questionType` It deliberately has no
  verification fields, and the rules additionally refuse `verificationStatus`, `reviewer`
  and `reviewedAt` on `questions` writes, so an import cannot declare itself reviewed.
- `examTemplates` documents now also carry `blueprintCellIds`, `language` and `seed`. A
  template without `blueprintCellIds` cannot be started — there are no such templates yet.
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

## E8 — one-step content import (this batch)

Verified locally on `f7fe7df`. Commands run separately, results as observed:

| Command | Result |
| --- | --- |
| `pnpm typecheck` | pass |
| `pnpm lint` (`--max-warnings 0`) | pass |
| `pnpm test` | 40 files, 422 tests, pass |
| `pnpm build` | pass, 14 precache entries (361.48 KiB) |
| `functions: npm run typecheck` | pass |
| `functions: npm run build` | pass |
| `node scripts/check-bundle-secrets.mjs` | pass — 81 files scanned, 34 solution strings absent |
| `playwright --project=desktop` | 14 passed, 3 skipped |
| `playwright --project=iphone` | 4 passed, rest skipped by design |
| `playwright --project=ipad` | 3 passed, rest skipped by design |

Playwright ran with `PLAYWRIGHT_CHROMIUM_PATH` pointed at the Chromium already on this
machine, because the browser build Playwright expects cannot be downloaded here. That means
the phone and tablet projects exercised their viewport and input profile **on Chromium, not
on real WebKit**. CI still installs and uses WebKit; this is a sandbox fallback and is
recorded as weaker evidence, not as a WebKit pass.

What the import guarantees, each backed by a test that runs the deployed handler against an
in-memory Firestore (`src/features/blueprint/import-callables.test.ts`):

- An anonymous caller is refused `unauthenticated`; a signed-in learner is refused
  `permission-denied`; all three callables set `enforceAppCheck` and `consumeAppCheckToken`.
- A dry run writes no content, no batch record and no audit entry.
- A repeated batch id returns `alreadyApplied` and writes nothing again; a fresh batch id
  over unchanged content reports 105 unchanged and leaves every version at 1.
- A stale `expectedVersion` is refused `aborted` and the stored item is byte-identical after.
- One unmappable item blocks the entire batch: neither item is written and no batch record
  is created.
- Nothing imported carries a reviewer, a review date or a verified status.
- The private path leaves no answer, solution, explanation or common mistake in the
  readable document, and the audit log contains none of them either.
- `exportQuestionBank` — the review queue — returns all 17 items, every one `pending-review`.

Leak surfaces, checked separately:

- No shipped source imports a seed; the two `src/data` re-exports are imported by tests only.
- The admin surface references no `localStorage`, `sessionStorage`, `indexedDB`, `caches`,
  `document.cookie`, console method or analytics sink.
- The service worker precaches `css,html,ico,png,svg` only and caches at runtime by
  `request.destination`, so a callable response (empty destination) is never stored.
- `e2e/content-privacy.spec.ts` scans everything the real browser downloaded and everything
  the service worker cached after a warm load for the seed solutions, and finds none.

## AI0 — AI tutor groundwork, no provider and no key (this batch)

Verified on `96aad8c`. There is no Gemini key anywhere in this repository, no
provider SDK dependency, and no endpoint. The only registered provider is a
deterministic fake, and an unknown provider name is refused rather than falling
back to one.

What exists:

- **Five actions**, and nothing else: `practice_hint`, `post_answer_explanation`,
  `explain_step`, `translate_explanation`, `prerequisite_coach`.
- **Kill switch** (`AI_TUTOR_KILL_SWITCH=true`) checked before anything else.
- **Feature flag** (`AI_TUTOR_ENABLED`) off unless set to the exact string `true`.
  `1`, `yes`, `TRUE` and ` true` all leave it off.
- **Exam gate.** Every action is refused while a diagnostic or a mock is in
  progress. A post-answer explanation is refused until the server has revealed
  the result for that question.
- **Two leak defences.** The key and the worked solution never enter a prompt for
  any pre-answer action, and prompt construction is asserted against the secrets
  it must not contain. Every pre-answer reply is then screened for the correct
  option's text, a sentence lifted from the stored solution, an answer
  announcement in English, Russian or Chinese, and a bare option letter. A
  failing reply is withheld whole and never cached.
- **Per-learner quota** (30 per hour, expiring window) and a **shared daily
  budget** (requests and tokens), both spent only when a provider is called, so
  a cache hit is free.
- **Cache** keyed on prompt version, action, question, language and a normalised
  attempt; no learner identity, so two learners share one reply. A cached reply
  is re-screened against the current answer key before it is served again.
- **Prompt-injection handling.** The learner's text is fenced with markers it
  cannot close from inside, under a standing instruction that nothing within it
  is an instruction. An attempt is counted, not refused.
- **Offline fallback.** Every refusal path returns fixed human-written guidance,
  or the stored short solution where the result is already revealed, labelled
  `verified-content` or `fixed-guidance` so nothing implies a model wrote it.
- **Usage metadata** records an outcome, reasons, an injection-pattern count and
  token counts — never a prompt, a reply or the learner's words.

Asserted by test, not by comment: nothing under `functions/src/tutor/` imports
`firebase-admin` or `firebase-functions`, names a collection, calls `FieldValue`,
reads `process.env`, or mentions a provider SDK, endpoint or key. The tutor
returns text; it never grades, writes a score, changes mastery, readiness or the
plan, sets a verification, or publishes content.

`AI0` totals 73 tests across four files.

**The external step, when the tutor is wanted:** create a Gemini authorization
key outside this repository, restrict it to the Gemini API only, store it as the
Firebase Secret Manager secret `GEMINI_API_KEY`, and bind that secret to the
tutor Function alone. No key belongs in React, a `VITE_*` variable, Git, a log,
the bundle, this document or a screenshot. Until then the fake provider is what
runs, and the flag stays off.

## Accessibility, privacy and account deletion (this batch)

Verified on `736848c`.

**Accessibility.** Three real defects, each fixed and asserted against rendered
output rather than source:

- No skip link existed, so a keyboard user had to tab through the sidebar and
  header on every page. One is now first in the tab order, hidden until focused,
  landing on the single `main` landmark. A Playwright test presses Tab once in a
  real browser and follows it.
- `Progress` took an optional `label`, and the onboarding bar passed none, so it
  announced a bare percentage. The prop is now required: a usage that omits one
  does not compile.
- Onboarding announced a date validation error but left focus where it was.
  Focus now moves to the field, which is marked `aria-invalid` while the error
  stands.
- The onboarding screen renders outside the app shell and had no `main` landmark
  at all. It has one now.

Still open on the accessibility list: a contrast audit and a reduced-motion
sweep beyond the existing `prefers-reduced-motion` block.

**Privacy and account.** `docs/legal/` now holds four documents:

- `DATA_INVENTORY.md` — every localStorage key, every user collection and every
  operational record, read from the source. An engineering document, updated in
  the same commit as any storage change.
- `PRIVACY_POLICY.draft.md` and `TERMS.draft.md` — engineer-written drafts,
  labelled as such at the top, with `[…]` placeholders wherever only the
  operator or a lawyer can answer. **Neither is legal advice and neither may be
  published until a qualified person has reviewed it.**
- `AI_DISCLOSURE.md` — accurate about today (no tutor, no provider, no key,
  nothing model-generated in the app) and precise about what a tutor would send
  and never send.

`deleteMyAccount` is new. Export and reset already existed; deletion did not, so
the policy draft had nothing honest to point at. It requires the word DELETE
typed out, a sign-in no older than five minutes checked from `auth_time` in the
verified token, and App Check. It deletes the study collections, then the user
document recursively, then uploaded files, and removes the Firebase Auth user
last so a partial failure leaves an account that can retry. The client
re-authenticates with a popup before calling and clears the device only after
the server confirms.

Checks on this batch, run separately: `pnpm typecheck` pass, `pnpm lint` pass,
`pnpm test` 46 files / 515 tests pass, `pnpm build` pass, Functions typecheck and
build pass, `scripts/check-bundle-secrets.mjs` pass (82 files, 34 solution
strings absent), Playwright desktop 15 passed / iPhone 4 / iPad 3 with the rest
skipped by design.

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

1. Human review of the 17 imported items (see "Next Exact Task"), which is what turns the
   first six cells covered **for practice**. It cannot turn them covered for a mock: their
   answers are public.
2. Author or import private production questions for a confidential mock, through
   `importPrivateQuestions`. Until then no mock can be published from reviewed content.
4. Extend the explanation language beyond the vocabulary trainer to lessons, practice
   feedback and formula copy, with the same stated fallback.
3. Phase I — privacy policy, terms, retention, data export and account deletion, before any
   real student uses the app.
4. Phase J — accessibility fixes (progressbar name, `<main>` landmark, skip link, focus on
   validation errors, 48px targets) and the deep-link HTTP 200 / SEO decision.
5. Firestore Rules emulator abuse tests, wherever the emulator jar can be downloaded.

### Next exact step

Grant the Claude GitHub App *contents: write* on `bayanbainyrasil-dotcom/CSCA-Prep`
(https://github.com/apps/claude/installations/select_target, or reconnect GitHub from
claude.ai Settings -> Connectors). Then, with no rebase and no force:

    git fetch origin
    git merge-base --is-ancestor origin/main <local head>   # must still succeed
    git push origin HEAD:main

and watch the CI and Pages runs on the pushed head. If `origin/main` has moved on in the
meantime, stop and diff both sides first — do not overwrite it.

Blocked on repository write access:

5. Push the 39 verified commits and confirm CI and Pages go green on the pushed head.
6. Confirm the live bundle hash matches the released commit's build output.
7. Bump the deprecated Pages actions (`configure-pages`, `upload-pages-artifact`,
   `deploy-pages`, `upload-artifact`, `dependency-review-action`) and confirm Pages stays green.

Always: run root and Functions typecheck/lint/tests/build after each atomic batch, and record
the actual commands and results here rather than a summary claim.
