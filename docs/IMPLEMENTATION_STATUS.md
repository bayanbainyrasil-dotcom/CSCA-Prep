# CSCA Prep Implementation Status

Last updated: 2026-09-01 12:28 +05:00

## Current Phase

P0.1 — Real Production Deployment

## Last Completed

Added a fail-closed deployment contract: every Vercel build is Firebase-only and stops when Firebase/App Check variables are missing. GitHub Pages is explicitly marked as the local demo host. Added a development-only mode indicator and removed the one-time owner credential from public documentation.

## Current Task

GitHub identity sharing with Vercel is approved. The correct GitHub profile (`bayanbainyrasil-dotcom`) is confirmed and the Vercel GitHub App is installed for all repositories. Vercel requires a one-time email code for the pre-existing account; the code was sent to `bayanbai.nyrasil@gmail.com` and its input is open. Firebase still waits for the user to complete Google 2-Step Verification.

## Next Exact Task

Enter the one-time Vercel email code supplied by the user, link the confirmed GitHub profile to the existing Vercel account, and import the original `bayanbainyrasil-dotcom/CSCA-Prep` repository without cloning it. After the user enables Google 2-Step Verification, reload Firebase Console and configure Firebase web apps/App Check and Vercel without committing credentials.

## Completed

- React/TypeScript/Vite/Tailwind PWA architecture and responsive application shell.
- GitHub Actions typecheck, lint, unit, Functions build, Playwright, and GitHub Pages deployment.
- GitHub Pages local demo at `https://bayanbainyrasil-dotcom.github.io/CSCA-Prep/`.
- Firebase client architecture, strict Firestore/Storage rules, callable Functions, App Check integration, Google Auth flow, protected admin bootstrap design, and server-side practice grading.
- Dexie local-first repository, durable outbox, sync cursor, conflict records, and version/mutation contracts.
- Dashboard, Today, Roadmap, lessons, practice, diagnostics, vocabulary, formulas, mental math, mistakes, progress, bookmarks, notes, search, settings, and admin foundations.
- Real exam-date onboarding, device-timezone refresh/travel handling, local date rollover, and 180-minute daily target.
- Vercel configuration, security headers, SPA rewrite, and fail-closed Firebase deployment validation.

## Partial

- P0.1: code/configuration is ready; real Firebase/Vercel resources and production URL are not provisioned.
- P0.2: Google login/profile restoration is implemented but not verified on a real production domain or iPhone Safari.
- P0.3: all named progress entities have local/cloud sync paths; real two-device proof is not complete.
- P0.4: conflict resolution and daily-plan merge code exists; dedicated automated concurrency coverage and real offline two-device simulation are missing.
- Learning/content/mock/admin areas have working foundations, but the later P1–P5 requirements are not complete.

## Not Started

- P0.5 plan start date model (`planStartDate`, `currentPlanDay`, completed/paused days).
- P0.6 missed-day recalculation choices.
- P1 skill graph, prerequisite repair engine, verified coverage dashboard, and production mock engine upgrades.
- P2 complete verified foundation curriculum and trainer/support expansions.
- P3 advanced mastery, relapse, timing, scratchpad, analytics, and readiness confidence.
- P4 full admin editors/validators/source tooling and disabled Science Chinese architecture.
- P5 final polish pass after core functionality.

## Tests

Passing:

- TypeScript typecheck after deployment-contract changes.
- ESLint with zero warnings.
- 38 unit/component tests, including four deployment-mode tests.
- Local production demo build.
- Simulated Vercel production build correctly fails when Firebase/App Check variables are absent.
- Firebase Functions TypeScript check through the installed Functions toolchain.
- 18 targeted Playwright scenarios across desktop, iPhone, and iPad projects.
- Native browser verification of the visible development diagnostic and its absence from production bundles.

Failing:

- None known.

## Known Issues

- No real Vercel/Firebase production deployment exists yet; GitHub Pages intentionally remains browser-local demo mode.
- Cross-device behavior cannot be proven until a Firebase project and two authenticated device sessions exist.
- Mock pages still use client-visible built-in answer data and are not the required server-authoritative production mock flow.
- Dashboard plan day still derives from account/profile creation rather than a dedicated plan start date.

## Deployment Status

- Commit `6bed22d` is pushed to `main`.
- GitHub CI completed successfully: `https://github.com/bayanbainyrasil-dotcom/CSCA-Prep/actions/runs/33422686237`.
- GitHub Pages demo deployment completed successfully: `https://github.com/bayanbainyrasil-dotcom/CSCA-Prep/actions/runs/33422686252`.
- Firebase production: blocked by the Google account MFA requirement before Console access.
- Vercel production: GitHub sharing is approved and the correct profile/App installation is confirmed; login is blocked only on the one-time email code sent to `bayanbai.nyrasil@gmail.com`.

## Important Decisions

- GitHub is source control; GitHub Pages remains demo-only; Vercel is the production frontend.
- Vercel cannot opt into `local-demo`; missing cloud configuration is a build error.
- Firebase client identifiers are deployment settings, while service credentials and bootstrap values stay server-side only.
- Existing IndexedDB tables, local-storage keys, Firestore collections, and progress records remain unchanged in this batch.
- Device timezone, not GPS, is the source of calendar-day and schedule calculations.

## Schema Changes

- None in this batch.

## Files Changed This Batch

- `docs/IMPLEMENTATION_STATUS.md`

## External Setup Required

- A Firebase staging project and production project with billing where required.
- Google Authentication, Firestore, Storage, Functions, and App Check configuration.
- Firebase/Vercel account authorization on this workstation.
- Firebase web client identifiers for staging and production.
- A one-time bootstrap value entered only into Firebase Secret Manager.
- Final production hostname added to Firebase Auth authorized domains and App Check.

## Continue From Here

1. Read this file and confirm the working tree/latest commit.
2. Enter the one-time Vercel verification code from `bayanbai.nyrasil@gmail.com`, link GitHub, and confirm the repository is imported from `bayanbainyrasil-dotcom` rather than cloned to another account.
3. Confirm the user has completed Google 2-Step Verification, then reload the open Firebase Console tab.
4. Provision Firebase/Vercel, deploy the backend/frontend, and verify cloud mode, headers, deep links, App Check, and Google login/profile restoration.
5. Update this checkpoint and commit P0.1.
6. Continue with P0.2 production login verification, then P0.3 two-device sync proof.
