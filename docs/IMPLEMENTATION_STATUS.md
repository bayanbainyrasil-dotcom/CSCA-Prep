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

### Physics vertical slice (P4, same batch)

`phys-thermodynamics-heat-transfer` had no authored questions. It now has four, covering
both difficulties the cell requires (2 and 3) and both question types
(`single-step-calculation`, `multi-step-calculation`), against a minimum of three.

- Every distractor is a named mistake mapped to the option it produces: dropping the mass,
  reading a final temperature as a change, using the initial temperature, a
  grams-for-kilograms slip, a factor of ten. A test asserts every wrong option is explained
  and the correct one never is.
- Every answer is recomputed independently in `src/data/draft-questions.test.ts` from the
  item's own `templateParameters`, written from `Q = mcΔT` rather than by copying the
  solution text, so a wrong solution cannot validate itself.
- English prompt plus a real Russian rendering, a full solution, a short revision solution
  and an explanation, all length-checked.
- All four options of an item share one unit, so the comparison is between numbers.
- An item that asks for the specific heat capacity must not also state it. That invariant
  came from a wrong first assertion, which item 002 caught.

**These are public practice items.** Their keys are in this repository, so a test confirms
that even fully reviewed they are refused for a mock (`excludedForMode`) and count only for
practice. **Coverage is unchanged at 0 of 109.**

**Teaching content authored for both slices** in `src/data/teaching-slices.ts`: two lessons,
six vocabulary entries and two formulas, typed against the existing `LessonSchema`,
`VocabularyEntrySchema` and `FormulaSchema` rather than a parallel model.

Each lesson runs the whole path in order — prerequisites, objectives, the idea, the English
of the question wording, vocabulary, the relation, a worked example, guided practice with
ordered hints, independent practice, CSCA-style reading advice, a timed set. Tests assert
the *order*, not just the presence, because the order is the teaching. Both languages are
written out, and a test rejects Russian that is the English copied across.

Formulas carry every variable's meaning in both languages, SI units where the relation is
dimensional, and where each stops applying: `Q = mcΔT` states that it does not hold through
melting or boiling.

All of it is `status: 'draft'`, `demo: false` — distinct from `DEMO_LESSONS`, which stay
demo. A test asserts the authored content names no reviewer, no review date and nothing
verified.

**Stage engine** in `src/features/slices/slice-progress.ts` — the rules of the path
lesson → guided → independent → timed, with no storage, no React and no clock it is not
given, so the rules are testable directly. Twenty tests cover:

- A stage cannot be skipped; progress is a prefix of the sequence.
- Completing a stage twice is the same as once — a retried request, a double tap or a
  replayed offline mutation advances nothing and counts no answer twice.
- Reload resumes at the unfinished stage; a finished slice reports finished.
- Progress is keyed on learner **and** cell, and carries its owner on the record.
- An offline merge takes the union of finished stages and keeps the earlier completion
  time, so it is order-independent and idempotent, and a replayed copy cannot move a date.
- Guided practice never reveals the answer, whatever the hint count; independent practice
  and the timed set reveal only after submission; the lesson may show its worked example.

**A false claim removed.** The lesson page labelled every published lesson "Verified
content", which included the demo lessons — a claim no human had made. Each state now says
what it is: *Published* (with a note that publication is not subject-matter verification),
*Awaiting review*, *Demo content*, *Built-in*. `resolveLesson` gained a `pending-review`
kind rather than a boolean, so a caller that forgets to handle authored content fails to
compile, and draft content can never be returned as published.

**Persistence** wired through the existing sync path rather than a new mechanism:
`slice-progress` is a sync entity type mapping to one `sliceProgress` collection under the
learner's own subtree, with the same versioned envelope and outbox as every other piece of
progress. The Dexie `entities` table is generic, so no migration was needed.

`SliceProgressSchema` enforces at rest what the engine enforces in memory, because a record
can arrive from disk or a sync peer without passing through the engine: a prefix of the
sequence with none skipped, no stage twice, never more correct than answered, at most four
stages, and no unknown field — so nothing can smuggle in a claim of verification or mastery.
Tests craft each and confirm refusal. `sliceProgress` is mutable but deliberately not
tombstonable: a finished stage should not be deletable from a client.

**The route** at `/slice/:cellId` walks lesson → guided → independent → timed → result.
Progress comes from the store and is written through the sync path above; the engine
refuses a repeat or an out-of-order completion, so a double tap is reported as "already
recorded, nothing counted twice" rather than advancing anything. Focus moves to the new
stage heading, the current step carries `aria-current="step"`, and both slice deep links
have Pages entrypoints so a shared link survives a refresh.

**The trust boundary** is a pure function, not a condition buried in the view:

| Audience | Sees | Label |
| --- | --- | --- |
| Learner, real deployment | nothing | "Coming soon", with the reason |
| Administrator, real deployment | the slice | "Review preview — awaiting human review" |
| Local demo | the slice | "Awaiting human review" |

`resolveLesson` is untouched: draft is still never returned as published.

**Two content defects the checks caught,** both real:

- The mathematics lesson's worked example was character-for-character the short solution of
  practice item 001. `scripts/check-bundle-secrets.mjs` failed on it.
- The physics lesson's worked example used the same numbers as physics item 001 and reached
  the same answer in different words, so the string scan could not see it at all.

Both renumbered, and `src/data/lesson-answer-overlap.test.ts` now asserts the invariant the
scanner cannot: no worked example may share every quantity with a practice item in its own
cell.

**Dashboard cards** on the daily plan show the real state — not started, the current stage,
completed, or locked — and never say Verified, Adaptive or Recommended.

**Still outstanding:** the practice stages count items but do not yet render individual
questions: the authored items live on the server with their solutions and are deliberately
not bundled, so on the demo deployment the stage says so plainly instead of inventing a
question. Wiring the real question components requires the production import, which needs
the Firebase deployment. Real two-device sync of slice progress is likewise unproven.

**Previously outstanding, now done:** the screen itself. The engine, the content and the trust labels
exist; the route that walks a learner through the four stages, persists progress through
the repository layer, and surfaces the two slices on the dashboard and daily plan has not
been built. That is the next task, and until it exists the slices are reachable only as a
lesson page.

### Callable-layer security tests (P3, same batch)

Eleven properties exercised against the real deployed handlers with the in-memory
Firestore: App Check enforced on every exported callable; anonymous callers refused
everywhere; a learner cannot promote themselves or reach any of the twelve
administrator-only callables, each refusal being an authorization refusal rather than a
validation one; rate limits exhaust and are keyed per identity; `resetMyProgress` and
`deleteMyAccount` touch only the caller's subtree; `deleteMyAccount` refuses a stale
sign-in and deletes nothing; exactly one sign-in is removed and it is the caller's; the
audit trail carries no reviewer note.

**A correction worth recording.** The first version of the App Check sweep asserted that
every callable consumes the token, and eleven appeared to fail. They do not.
`enforceAppCheck` is true on all six option objects; `consumeAppCheckToken` is replay
protection, deliberately reserved for infrequent consequential calls because it costs a
round trip. The sweep now asserts the universal property separately from the stronger one
and pins the list of calls that must keep replay protection.

**What this does not prove.** It proves what the server code refuses, not what the
Firestore rules engine refuses. `dl.google.com` and `storage.googleapis.com` are blocked
here and no emulator jar is cached, so rules-engine abuse tests remain owner-run work on
the release gate.

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

## Operational monitoring (P1-4, 2026-09-03)

`functions/src/monitoring.ts` covers the five things the audit named: callable errors,
sync failures, import conflicts, account-deletion failures and mock submission latency.

Redaction works from an **allow-list**, not a deny-list. A deny-list leaks every field
nobody thought to forbid; an allow-list drops a new field until someone adds it
deliberately, and adding it means writing it into a table a reviewer can read. Every
allowed key is a bounded identifier, an enum, a count or a duration, and a test asserts
none is even *named* in a way that could hold a sentence.

- Redaction happens inside the recorder, so a call site cannot forget it. Handed a whole
  learner record — question, answer, solution, note, email, uid, free text — it emits `{}`.
- A value needing trimming is dropped rather than truncated: a truncated sentence is still
  a sentence.
- Latency is bucketed. A raw millisecond figure beside a user reference is a timing
  fingerprint; `over-10s` answers the operational question without being one.
- The actor reference is a salted hash that does not contain the uid and differs between
  deployments, so repeated failures by one account are visible without identifying whose.
- The module imports nothing, so it cannot reach a database or a network. A test holds it.

**Now wired in.** One wrapper (`monitored` in `callable.ts`) is applied to all 25 exported
`onCall` handlers, so there is one `try/catch` in the codebase rather than twenty-five. It
records the operation name and, for an `HttpsError`, its code; an unknown error becomes
`internal`, because its message can contain a fragment of whatever document caused it. The
error is re-thrown untouched, so the status the client receives is unchanged, and Auth, App
Check, authorization and rate limiting are untouched — the wrapper sits outside them and
reads nothing from the request. A test walks every source file and fails if an exported
`onCall` is unwrapped or if a wrapper is named after a different export.

The three server-side counters sit at the real failure points, once each:

| Event | Where | What it carries |
| --- | --- | --- |
| `import-conflict` | inside `refuseIfBlocked`, the single refusal path | a count, never a decision list or item id |
| `account-deletion-failure` | where storage cleanup actually fails | a salted `actorRef` and the stage |
| `mock-submission` | a `finally`, so exactly once per call | outcome from a closed set and a latency **bucket** |

The previous `logger.warn` at the deletion site recorded the uid and the raw cause; a
storage path can contain a file a learner named, so both are gone. Mock duration is measured
with `process.hrtime` and only its bucket is recorded — the precise figure beside an actor
reference would be a timing fingerprint.

**`reportOperationalEvent`** is the one client-facing channel, added because the server
cannot see a sync failure that happens entirely in the browser. Its schema has **no string
field at all**: a fixed kind, a reason from six enum values, an entity type from the sync
enum, and an attempt count between 1 and 50. Auth and App Check required, 60 an hour, writes
to no collection, returns only `{ received: true }`. A test asserts it is the only file that
passes client input to the sink.

**Not proven in production.** The code and the Cloud Logging sink are complete and tested,
but no Firebase project is deployed, so no real event has been emitted and no alert has ever
fired. Monitoring is written, not working.

## Readiness stays an internal metric (P1-5, 2026-09-03)

Readiness is a weighted blend of mastery, accuracy and speed against content never
calibrated against a real exam outcome. The dashboard already said so; the progress page
showed the same number as a **trend line over time with no caveat at all**, which is the
form most likely to be read as a forecast.

The wording now lives in `src/features/dashboard/readiness-language.ts` and is imported by
both screens — a caveat that drifts between screens is a caveat a learner stops reading. The
history form is longer on purpose: a trend implies a trajectory, so it says plainly that it
shows whether practice is moving, not what you would score.

`FORBIDDEN_READINESS_CLAIMS` names the vocabulary of prediction (predicted score, pass
probability, likely to pass, expected score, guarantee). One test scans every shipped source
for it; another finds each screen that renders the number and fails if it does not import
the shared wording or keeps a hand-written copy that could drift.

This closes the labelling half of audit P1-5. The calibration half stays open and needs real
outcome data, which does not exist.

## Learner-visible coverage confidence (P2-4, 2026-09-03)

"How far along am I?" is four different questions, and the honest answer keeps them apart.
The progress page now shows four counts side by side, each with its own numerator and
denominator, for the totals and for Mathematics and Physics separately:

- **Studied by you** — blueprint cells this learner has started in a teaching slice.
- **Approved by a reviewer** — cells `evaluateBlueprintCoverage` reports as `covered`.
- **Demo or practice only** — cells with material that can never secure a mock, because it
  is demo content or its answers are public.
- **Not measured** — cells with no questions and no work from this learner.

They are never summed and there is no total. A single blended number is what turns "you have
practised a lot" into "you are ready", which is the claim this product cannot make: there is
no `score`, `percent` or `total` field in the returned object, so no screen can compute one
from it. A test asserts the rendered text matches no percentage and contains none of "pass
probability", "predicted score", "likely to pass" or "ready to pass".

Today it reads **0 approved out of the deployed blueprint**, with a line saying the secure
mock exam is unavailable and that only a human review moves that number. Studying does not
make a cell approved, and approval does not mean the learner has studied it — both
directions are tested.

### The learner-safe coverage read

`getBlueprintCoverage` is an administrator's tool and returns reviewer names, review dates,
source references, known limitations, per-cell issues and orphan question ids. Rather than
relax its permission check, `getCoverageSummary` is a separate callable: sign-in and App
Check required, no arguments at all, rate-limited per caller, and six fields per cell — id,
subject, status, `totalItems`, `demoItems`, `publicKeyItems`.

The private answers are not merely withheld from the response, they are never loaded.
`loadBlueprintState` now takes `answerLabels`, and this path passes `false`, so
`questionSolutions` is not read at all. The Firestore test double gained read tracking so
that can be asserted directly, with the administrator report as the control that proves the
assertion is capable of failing.

`functions/src/blueprint-summary.ts` carries the blueprint cell counts and nothing else, so
the browser has a documented denominator without importing the seed. It is on the leak
contract's allow-list together with a test that it stays free of content.

### What the panel refuses to do

- A failed read shows an error and a retry, never zeros. "Nothing is verified" and "we could
  not find out" are different statements.
- A cached read is served only when the live read fails, and is labelled on screen as
  possibly out of date. A live read always wins over the cache.
- The response schema is `.strict()`, so a future server that started returning a reviewer
  name on this path would fail parsing rather than render it.
- "Studied" is not inferred from practice attempts. A practice question carries a topic, not
  a blueprint requirement, so counting those cells would be a guess; the definition on
  screen says exactly what is and is not counted.

### Checks, each run separately on `00e47e8`

| Check | Command | Result |
| --- | --- | --- |
| Web typecheck | `pnpm typecheck` | passed |
| Lint | `pnpm lint` | passed, 0 warnings |
| Web unit tests | `pnpm vitest run` | 797 passed, 65 files |
| Pages entrypoints | `pnpm test:pages` | 2 passed |
| Web build | `pnpm build` | built, PWA precache 14 entries |
| Functions typecheck | `npx tsc --noEmit` in `functions/` | passed |
| Functions build | `pnpm build` in `functions/` | passed |
| Bundle secret scan | `node scripts/check-bundle-secrets.mjs` | passed, 86 files, 42 solution strings absent |
| Production audit (web) | `pnpm audit --prod` | no known vulnerabilities |
| Production audit (functions) | `pnpm audit --prod` | no known vulnerabilities |
| Browser tests | `PLAYWRIGHT_CHROMIUM_PATH=… pnpm test:e2e` | 26 passed, 34 skipped by project design, 0 failed |

The browser run used the container's own Chromium through the documented
`PLAYWRIGHT_CHROMIUM_PATH` fallback, because this environment cannot download the browser
build this Playwright version expects. Every project therefore ran on Chromium: the iPhone
and iPad rows are viewport and input profiles, **not** real Safari or WebKit, and iOS
behaviour remains unproven.

This closes audit P2-4 as far as it can be closed without a deployment. The callable's code
path exists and is exercised by tests against an in-memory Firestore; it has never answered
a real request, because Firebase is not deployed.

## First-load budget (P2-5, 2026-09-03)

The audit asked for the initial Firebase and the heavy visualization and maths JavaScript to
be split out of the first load. Measured on `db132dc`, they already are. What `index.html`
itself asks for is:

| Asset | Gzipped |
| --- | --- |
| Application entry and shell | 147.1 KB |
| Domain schemas (zod) | 22.9 KB |
| Icon factory | 9.3 KB |
| Domain models | 4.6 KB |
| React runtime shim, router runtime, date, preload helper, Firebase re-export stub | 4.5 KB |
| **Total JavaScript** | **189.0 KB** |
| Stylesheet | 19.7 KB |

Recharts (357 KB raw), KaTeX (265 KB raw) and the Firebase SDK (~900 KB raw across its
chunks) are all in chunks no eager module imports. Every page is behind `React.lazy`, and
only two lazy pages import Recharts.

That was true by accident, not by construction, so `scripts/check-bundle-budget.mjs` now
makes it a check: it reads the assets `index.html` asks for, gzips them, and fails if the
first load exceeds its budget or if any chunk in it contains Recharts, KaTeX or Firebase.
The markers are case-sensitive because the entry chunk lists every lazy chunk by *filename*
— lowercase "katex" and "firebase" appear there with none of either library present, while
`KaTeX` and `@firebase` appear only inside the libraries.

### Manual vendor chunking was tried and rejected

Grouping React, Recharts, KaTeX and Firebase into named vendor chunks made the first load
**worse**: with this bundler a manual chunk attracts shared modules, and Recharts — imported
by two lazy routes only — was pulled into the eager graph, taking the first load from 189 KB
to 298 KB gzipped. React-only chunking was neutral on first load (188.2 KB) and would have
bought caching stability across deploys, but not at the cost of carrying the failed grouping
alongside it. The automatic splitting wins here, so the guard defends it rather than
replacing it.

The bundle secret scan also runs in CI now. It existed and passed, but nothing ran it
automatically, which is a check with a shelf life.

Not done, and not attempted: moving zod and the domain schemas (22.9 KB gzipped) out of the
first load. That needs the data layer restructured so nothing on the shell path parses, and
the regression risk is not worth 23 KB in a session that cannot run a real device test.

## Third vertical slice (P2-1, 2026-09-03)

`math-linear-multi-step-linear` had three authored practice items and no teaching — the
isolated-question pattern the audit asked to stop. It is now a complete slice on the same
shape as the other two: three vocabulary entries (like terms, expand, common denominator),
one relation with its own failure case written into `limitations` (a = c, where the unknowns
cancel and the equation is true for every x or for none), and an eleven-section lesson from
prerequisites through a timed set, in English and Russian.

The worked example solves 8x − 5 = 3x + 20 because none of the three practice items in the
cell uses those numbers. `lesson-answer-overlap.test.ts` enforces that a worked example does
not share every quantity with an item in its own cell, and this is the second time that test
has decided a choice of numbers rather than merely recorded one.

Everything stays `status: 'draft'`, `demo: false`, unreviewed. No reviewer, source or review
date has been invented. Nothing here moves blueprint coverage: coverage counts
reviewer-verified questions, and a lesson is not a question, so the coverage panel still
reads 0 approved.

The card and access tests now take their counts from `SLICE_LESSONS` instead of the literal
2, so the next slice is a content change rather than eight failing rendering assertions.

Three of 109 cells now have a teaching slice.

### Checks, each run separately on `5957c69`

| Check | Command | Result |
| --- | --- | --- |
| Web typecheck | `pnpm typecheck` | passed |
| Lint | `pnpm lint` | passed, 0 warnings |
| Web unit tests | `pnpm vitest run` | 797 passed, 65 files |
| Pages entrypoints | `pnpm test:pages` | 2 passed |
| Budget script tests | `pnpm test:budget` | 6 passed |
| Web build | `pnpm build` | built |
| Functions typecheck | `npx tsc --noEmit` in `functions/` | passed |
| Bundle secret scan | `pnpm check:bundle` | passed, 86 files, 42 solution strings absent |
| First-load budget | `pnpm check:budget` | 189.0 KB gz JS, 19.7 KB gz CSS, within budget |
| Browser tests | `PLAYWRIGHT_CHROMIUM_PATH=… pnpm test:e2e` | 26 passed, 34 skipped by project design, 0 failed |

The browser run again used the container's Chromium, so the iPhone and iPad rows are
viewport profiles rather than Safari.

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
- Public authored questions: 21 across 7 cells, all still awaiting human review. Slice 1 is
  six Mathematics cells (17 items); slice 2 is `phys-thermodynamics-heat-transfer` (4 items,
  authored 2026-09-03), the first Physics content in the bank.
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
   questions. Three of 109 cells now have one; all three await human review.
2. ~~Add learner-visible reviewed/unreviewed coverage confidence.~~ Done in code; the
   numbers it reports stay all-zero until a deployment and a human review exist.
3. Add original short concept videos only where they improve a specific blueprint cell.
4. Calibrate readiness/score confidence using reviewed difficulty and real outcomes.
5. ~~Further split the initial Firebase and heavy visualization/math JavaScript.~~ Measured:
   already split. A budget check now defends it. Moving zod off the shell path stays open.

## Next exact task

**Human/operator task:** deploy Firebase/Vercel, bootstrap an administrator, and review the
blueprint before approving content. Do not invent a reviewer or self-mark generated content
as verified.

**Done in this batch:** learner-visible coverage confidence (audit P2-4), the first-load
budget and its guard (audit P2-5), and a third vertical slice (audit P2-1).

**Next code task that can proceed independently:** continue P2-1 — a fourth slice, and the
first physics one since the thermodynamics slice. `math-linear-linear-word-problem` already
has three authored items and no lesson, which is the same gap this batch just closed one
cell along; after that, a physics cell with items but no teaching. Everything authored stays
`draft`/`pending-review` — Claude does not mark its own content verified, and no reviewer,
source or review date may be invented.

Still blocked in this environment, unchanged: emulator abuse tests (P1-2) need a download
this sandbox refuses; real-device Safari (P1-4) and every live check need the deployment.

## Interruption-safe continuation rules

1. Treat this file and the repository as the source of truth; never rebuild from scratch.
2. Start from the first genuinely unfinished priority above.
3. Preserve honest labels: demo is not production, internal readiness is not an official
   score, authored is not human-verified, and a public answer key is never mock-confidential.
4. Run typecheck, lint, tests, build, Functions checks and relevant browser tests separately.
5. Before stopping, commit a coherent batch and update this checkpoint with completed work,
   checks, remaining blockers and the next exact task.
