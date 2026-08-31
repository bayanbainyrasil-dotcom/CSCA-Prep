# Testing

The release gate covers correctness, data integrity, authorization, responsive behavior, and production PWA behavior. Use a dedicated test Firebase project for any browser test that reaches Firebase; never point automated tests at production.

## Automated checks

Install dependencies once:

```sh
pnpm install --frozen-lockfile
pnpm --dir functions install --frozen-lockfile
pnpm exec playwright install chromium
```

Run the complete local gate:

```sh
pnpm typecheck
pnpm --dir functions typecheck
pnpm lint
pnpm test
pnpm build
pnpm --dir functions build
pnpm test:e2e
```

Useful focused commands:

```sh
pnpm test:watch
pnpm test:coverage
pnpm exec playwright test --project=desktop
pnpm exec playwright test --project=iphone
pnpm exec playwright test --project=ipad
```

GitHub Actions runs typecheck, lint, unit tests, both builds, and then Playwright when E2E tests exist. CI uses no production credentials. Pull requests also receive a high-severity dependency review.

## Firebase and rules checks

The local Firebase suite can be started with:

```sh
pnpm --dir functions serve
```

Use the Emulator UI at `http://127.0.0.1:4000` for backend inspection. Browser integration tests should either explicitly connect every Firebase SDK to these emulator ports or use a separate test project; merely starting emulators does not redirect a browser app automatically.

For every rules or callable change, verify at least these identities:

| Identity | Must be allowed | Must be denied |
| --- | --- | --- |
| Signed out | Public published topic/question prompts, if intended | User progress, solutions, admin content |
| User A | Own profile/progress/attempts/notes/bookmarks | User B data, role changes, private solutions |
| User B | Own data | User A data |
| Admin | Documented content-management operations | Direct bypass of schema/version validation |
| App without valid App Check | None of the enforced callable operations | Bootstrap, imports, grading, exports, role changes |

Also verify bootstrap rate limiting, a non-Google or unverified account rejection, a second owner rejection after bootstrap, idempotent answer submission, stale-version import rejection, and that learner-readable documents never expose `correctAnswer` or full solutions before grading.

## Critical product flows

### Login and authorization

1. Sign in with Google, refresh, and confirm the same user profile is reused.
2. Sign out and confirm protected routes/data disappear.
3. Open `/admin` as a normal user by navigation and by direct URL; access must be denied.
4. Open `/admin` as the owner and verify the claim survives sign-out/sign-in.

### Autosave and recovery

1. Start a lesson/session, answer a question, add a note, and bookmark an item.
2. Observe local saved state immediately and cloud status after the debounce.
3. Close the tab without waiting, reopen it, and verify the latest critical action remains.
4. Go offline, make more changes, reload, then reconnect. Confirm local data is retained, sync completes, and no duplicate attempt is created.
5. Open the same user in a second browser/device. Make non-conflicting edits, then a deliberately stale edit; newer versions must not be overwritten.

### Question and mock exam

1. Submit correct and incorrect answers at every confidence level; verify mastery differs appropriately and an incorrect answer creates one mistake entry.
2. Confirm **Understand** gates solving until the interpretation steps are complete.
3. Start a mock, answer and flag items, reload mid-exam, and verify timer/navigation/answers recover.
4. Submit once, retry the submission request, and confirm one final result rather than duplicate history.
5. Confirm exam mode exposes no hints, translations, formulas, or solutions before submission.

## Responsive and accessibility matrix

Test real interaction, not screenshots alone:

| Target | Viewport/orientation | Key checks |
| --- | --- | --- |
| iPhone | 393 × 852 portrait | Safe areas, bottom navigation, 44 px+ controls, no horizontal scroll, keyboard and sheets |
| iPad | 834 × 1194 portrait | Adaptive navigation, readable lesson width, exam navigator |
| iPad | 1194 × 834 landscape | Sidebar transition, chart/layout reflow, no clipped dialogs |
| Laptop | 1280 × 800 | Keyboard navigation, focus order, command search |
| Desktop | 1440 × 900 and 1920 × 1080 | Content max-width, sidebar, dense exam/progress layouts |

At every size, check light, dark, and system themes; 200% zoom; visible focus; screen-reader names; logical headings; chart alternatives; color-independent status; reduced motion; and long English/Russian content.

## PWA, offline, and network testing

The PWA plugin is disabled in `pnpm dev`. Use the production build:

```sh
pnpm build
pnpm preview --host 0.0.0.0
```

Then verify in browser developer tools:

1. The manifest has the correct name, colors, standalone mode, and 192/512/maskable icons.
2. The service worker controls the page after reload and receives updates without a stale HTTP cache.
3. Firebase, Authentication, callable, and Firestore responses are network-only rather than Workbox-cached.
4. With Offline enabled, previously loaded lessons, cached questions, active sessions, notes, and answers still work.
5. On reconnect, status progresses from offline/local to syncing to saved.
6. Under Slow 3G and high latency, controls do not double-submit and loading/error states remain understandable.
7. After installing on iPhone/iPad from HTTPS staging, launch from the home screen and verify safe areas, standalone navigation, resume, and update behavior.

Clear site data between first-install tests. For upgrade tests, keep the previous worker/cache, deploy the new build, and verify the update path without losing IndexedDB progress.

## Release record

For each production release, record the commit, CI run, staging URL, test Firebase project, tested devices/browsers, Firestore/rules version, backup timestamp, PWA update result, known limitations, and operator approval. A release is blocked by any silent progress loss, cross-user access, exposed answer key, failed build, or unrecoverable exam state.
