# CSCA Prep Implementation Status

Last updated: 2026-09-01 18:56 +05:00
Last verified implementation commit: `40ad32ecc62c93df2213cc3f438c669216e5a4ed`
Branch: `main`
Repository state: the tested P0A/P0B implementation is committed and pushed to `origin/main`; this checkpoint update is documentation-only.

## Current Phase

P0B — Exam Integrity (P0.1 production provisioning remains externally blocked)

## Last Completed

Closed the ordinary grading path for mock exams before any private solution read. The client and offline grading queue now share the same non-mock mode contract. Firestore rules restrict browser-authored exam records to exact, untrusted draft shapes with null submission/result fields and restrict nested answers to an exactly `in-progress` parent.

## Current Task

Replace the client-visible production mock implementation with a server-authoritative start/answer/finalize flow. The existing built-in mock remains a clearly labeled local demo only and still calculates practice results in the browser.

## Next Exact Task

Add strict `startMockExam`, answer-save, and `submitMockExam` schemas/callables. Return prompt-only question data at start, grade from `questionSolutions` only at finalization, make the result transition server-owned, and wire production mock pages to those callables without importing client answer keys.

## Completed

- React/TypeScript/Vite/Tailwind PWA architecture and responsive application shell.
- GitHub Actions typecheck, lint, unit, Functions build, Playwright, and GitHub Pages deployment.
- GitHub Pages local demo at `https://bayanbainyrasil-dotcom.github.io/CSCA-Prep/`.
- Firebase client architecture, strict Firestore/Storage rules, callable Functions, App Check integration, Google Auth flow, protected admin bootstrap design, and server-side practice grading.
- Dexie local-first repository, durable outbox, sync cursor, conflict records, and version/mutation contracts.
- Dashboard, Today, Roadmap, lessons, practice, diagnostics, vocabulary, formulas, mental math, mistakes, progress, bookmarks, notes, search, settings, and admin foundations.
- Real exam-date onboarding, device-timezone refresh/travel handling, local date rollover, and 180-minute daily target.
- Vercel configuration, security headers, SPA rewrite, and fail-closed Firebase deployment validation.
- Correct Mental Math generation for squares, percentages, fractions, roots, products, scientific notation, and estimation, with 10,000-case independent verification.
- Demo lesson resolution that uses matching published seed content and rejects unknown lesson IDs instead of substituting unrelated content.
- Node 22+ compatible browser-storage setup for unit/component tests.
- Ordinary `gradeQuestion` rejects `mock` at strict schema validation before question or solution reads; client practice routes and queued grading use the same narrowed contract.
- Firestore client writes for `examAttempts` are limited to exact draft data with null `submittedAt`/`result`; trusted statuses and score fields cannot use the generic sync path.
- Nested mock answers require an exactly `in-progress` parent and an allowlisted answer payload.

## Partial

- P0.1: code/configuration is ready; real Firebase/Vercel resources and production URL are not provisioned.
- P0.2: Google login/profile restoration is implemented but not verified on a real production domain or iPhone Safari.
- P0.3: all named progress entities have local/cloud sync paths; real two-device proof is not complete.
- P0.4: conflict resolution and daily-plan merge code exists; dedicated automated concurrency coverage and real offline two-device simulation are missing.
- P0B: answer-key access through ordinary grading and generic trusted-result writes are closed; server-authoritative mock start/finalization and production UI wiring remain.
- Learning/content/mock/admin areas have working foundations, but the remaining P0B and P1–P5 requirements are not complete.

## Not Started

- P0.5 plan start date model (`planStartDate`, `currentPlanDay`, completed/paused days).
- P0.6 missed-day recalculation choices.
- P1 skill graph, prerequisite repair engine, verified coverage dashboard, and production mock engine upgrades.
- P2 complete verified foundation curriculum and trainer/support expansions.
- P3 advanced mastery, relapse, timing, scratchpad, analytics, and readiness confidence.
- P4 full admin editors/validators/source tooling and disabled Science Chinese architecture.
- P5 final polish pass after core functionality.

## Tests

Passing on the current dirty working tree:

- TypeScript typecheck.
- ESLint with zero warnings.
- 59 unit/component/source-contract tests across 12 files, including 10,000 generated Mental Math cases, lesson-route integration, mock grading mode rejection, and exam-rule source invariants.
- Local production demo build (14-entry PWA precache, 360.40 KiB).
- Simulated Vercel production build correctly fails when Firebase/App Check variables are absent.
- Firebase Functions TypeScript check through the installed Functions toolchain.
- Firebase Functions production build.
- 18 targeted Playwright scenarios across desktop, iPhone, and iPad projects.
- Native browser verification of the visible development diagnostic and its absence from production bundles.

Warnings/limitations:

- Production build still reports the pre-existing ineffective dynamic import and chunks above 500 kB.
- Real Firebase/Functions/emulator integration is not available until production/staging resources are provisioned.
- Firestore Rules emulator compilation/abuse tests could not run locally because no working Java runtime is installed; the rule-source regression test is not a substitute for emulator verification.

## Known Issues

- No real Vercel/Firebase production deployment exists yet; GitHub Pages intentionally remains browser-local demo mode.
- Cross-device behavior cannot be proven until a Firebase project and two authenticated device sessions exist.
- Mock pages still use client-visible built-in answer data and local score calculation; they are suitable only for the labeled local demo and are not the required production mock flow.
- No trusted callable currently owns the `submitted`/`completed`/`graded` exam transition, so hardened production rules intentionally reject a client-authored result.
- Dashboard plan day still derives from account/profile creation rather than a dedicated plan start date.

## Deployment Status

- Commit `40ad32ecc62c93df2213cc3f438c669216e5a4ed` contains the verified P0A/P0B batch and was pushed to `origin/main` on 2026-09-01.
- GitHub CI and GitHub Pages were triggered by that push; confirm their final status before treating the published demo as updated.
- Firebase production: blocked by the Google account MFA requirement before Console access.
- Vercel production: GitHub sharing/App installation is confirmed, but the existing Vercel account requires email login and a one-time verification code before GitHub can be linked.

## Important Decisions

- GitHub is source control; GitHub Pages remains demo-only; Vercel is the production frontend.
- Vercel cannot opt into `local-demo`; missing cloud configuration is a build error.
- Firebase client identifiers are deployment settings, while service credentials and bootstrap values stay server-side only.
- Existing IndexedDB tables, local-storage keys, Firestore collections, and progress records remain unchanged in this batch.
- Device timezone, not GPS, is the source of calendar-day and schedule calculations.

## Schema Changes

- `GradeQuestionSchema.mode` and the matching client/offline queue contract now exclude `mock` while retaining diagnostic grading.
- Browser-authored `examAttempts` are now exact `in-progress`/`abandoned` drafts with null trusted result fields; nested answer documents use an allowlisted shape.

## Files Changed This Batch

- `src/features/mental-math/problems.ts`
- `src/features/mental-math/problems.test.ts`
- `src/pages/mental-math-page.tsx`
- `src/features/lesson/resolve-lesson.ts`
- `src/features/lesson/resolve-lesson.test.ts`
- `src/pages/lesson-page.tsx`
- `src/pages/lesson-page.test.tsx`
- `src/test/setup.ts`
- `functions/src/schemas.ts`
- `src/domain/models.ts`
- `src/features/practice/question-service.ts`
- `src/features/practice/grading-contract.test.ts`
- `src/lib/persistence/database.ts`
- `src/lib/security/firestore-rules-contract.test.ts`
- `src/pages/practice-session-page.tsx`
- `src/app/app-data-provider.tsx`
- `firestore.rules`
- `docs/FIREBASE_SCHEMA.md`
- `docs/IMPLEMENTATION_STATUS.md`

## External Setup Required

- A Firebase staging project and production project with billing where required.
- Google Authentication, Firestore, Storage, Functions, and App Check configuration.
- Firebase/Vercel account authorization on this workstation.
- Firebase web client identifiers for staging and production.
- A one-time bootstrap value entered only into Firebase Secret Manager.
- Final production hostname added to Firebase Auth authorized domains and App Check.
- The user must complete Vercel email verification and Google 2-Step Verification; no verification codes belong in this file or source control.

## Continue From Here

1. Confirm the working tree still contains only the P0A/P0B files listed above.
2. Implement strict server contracts for starting, saving, and finalizing a published mock without exposing private solutions.
3. Wire production mock pages to prompt-only server data and server-owned results; retain the current built-in flow only in `local-demo` mode.
4. Run Firestore Rules emulator abuse tests once a working Java runtime and Firebase test project/emulator are available.
5. Run root and Functions typecheck/lint/tests/build after each atomic mock-engine batch.
6. When the user completes Vercel email verification and Google 2-Step Verification, resume P0.1 provisioning without creating a second account or repository.
