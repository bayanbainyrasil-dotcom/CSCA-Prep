# CSCA Prep

CSCA Prep is an installable, adaptive Mathematics and Physics study PWA for CSCA preparation. It combines diagnostics, daily plans, bilingual lessons, targeted practice, mock-exam flows, spaced review, mistakes, vocabulary, formulas, progress analytics, bookmarks, and protected content administration.

The application has two explicit operating modes:

- **Local demo:** used automatically when the Firebase web variables are absent. It uses bundled, original CSCA-style examples and stores progress in the browser. No cloud account, cross-device sync, or admin bypass is available.
- **Firebase production:** used when every required Firebase web variable is present. Google Authentication, Firestore, Cloud Functions, Storage, App Check, server-side grading, and local-first cloud sync are enabled. Only published Firestore content is shown to learners.

The bundled material is original demonstration content, not an official CSCA question bank and not affiliated with the exam operator. A new production database intentionally starts without a hidden content seed; an administrator must verify and publish content.

## Architecture

```text
React 19 + TypeScript + Vite
  ├─ responsive PWA UI, React Router, Zustand, TanStack Query
  ├─ Dexie/IndexedDB local data + durable outbox
  └─ Firebase client SDK
       ├─ Google Authentication
       ├─ Firestore published content and user-scoped data
       ├─ private Storage paths
       └─ asia-east1 callable Functions
            ├─ profile/admin operations and exports
            ├─ question-bank validation/import
            └─ trusted grading and mistake classification
```

Question prompts and answer keys are separate Firestore documents. Learners can read published prompts; correctness and worked solutions remain server-side until grading. Security authority comes from Firebase Authentication, custom claims, Rules, callable validation, and App Check—not from React route guards or profile fields.

Local writes are saved first to IndexedDB with stable mutation IDs and then synchronized through an outbox. Mutable records use monotonic versions; append-only attempts are idempotent; note and bookmark deletions use tombstones. When a stale device conflicts with a newer cloud version, the pending mutation and conflict record are retained instead of silently replacing newer progress.

Key folders:

- `src/pages` and `src/features`: learner and administrator product flows
- `src/lib/adaptive`: mastery, daily planning, generation, and spaced-repetition logic
- `src/lib/persistence`: Dexie repository, Firestore adapter, outbox, and conflict handling
- `src/domain`: runtime-validated domain contracts
- `functions/src`: trusted Firebase callable backend
- `firestore.rules`, `storage.rules`, `firestore.indexes.json`: data boundaries
- `e2e` and `src/**/*.test.ts(x)`: browser, integration, and unit coverage
- `docs`: schema, security, testing, deployment, and recovery runbooks

## Requirements

- Node.js 22 or newer and pnpm 11 for the web application
- Node.js 20-compatible Firebase Functions runtime (declared in `functions/package.json`)
- Chromium installed through Playwright for browser tests
- For production: Firebase CLI, a Firebase project with billing for Functions/Storage, and a Vercel account

## Run the local demo

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Leave the Firebase variables unset to enter demo mode. Open the URL printed by Vite. Demo progress remains on that browser profile and can be cleared from Settings.

For an installable/offline-capable build, use the production preview; the service worker is deliberately disabled in the Vite development server:

```sh
pnpm build
pnpm preview --host 0.0.0.0
```

## Connect Firebase

1. Create separate Firebase projects for development/staging and production.
2. Register a Web app, enable Google under **Authentication → Sign-in method**, and create Firestore in Native mode and the default Storage bucket.
3. Copy `.env.example` to `.env.local` and fill the public web-app configuration from **Firebase console → Project settings → Your apps**.
4. Add `localhost`, staging, and the exact production hostname under Firebase Authentication authorized domains.
5. Register the production Web app in App Check with reCAPTCHA v3, add its site key, observe metrics, and enforce App Check only after valid traffic is confirmed.

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_APP_CHECK_SITE_KEY=
VITE_USE_FIREBASE_EMULATORS=false
```

Firebase web configuration is public identification, not a secret. Never put a service-account key, bootstrap code, App Check debug token, or private API credential in a `VITE_` variable because Vite embeds it in the browser bundle.

Install and validate the independent Functions package:

```sh
pnpm --dir functions install --frozen-lockfile
pnpm --dir functions typecheck
pnpm --dir functions build
```

### Emulator Suite

For local callable development, create the ignored file `functions/.secret.local`:

```dotenv
ADMIN_BOOTSTRAP_CODE=choose-a-local-only-value
```

Start the configured Auth, Firestore, Functions, Storage, and Emulator UI processes:

```sh
pnpm --dir functions serve
```

The UI is available at `http://127.0.0.1:4000`. Set `VITE_USE_FIREBASE_EMULATORS=true` in `.env.local` to route Auth, Firestore, Storage, and callable Functions to the ports declared in `firebase.json`. Starting emulators alone never redirects the browser; the environment switch is also required.

## Deploy and bootstrap administration

Configure and deploy the trusted Firebase layer from the repository root:

```sh
firebase login
firebase use --add
firebase functions:secrets:set ADMIN_BOOTSTRAP_CODE
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

Enter the one-time owner setup value only at the Secret Manager prompt. Do not put it in Git, `.env.local`, Vercel, command arguments, screenshots, or logs.

Then:

1. Deploy the web app and finish App Check configuration.
2. Sign in with the intended owner's verified Google account.
3. Open `/admin` and submit the one-time server-configured value.
4. Let the app refresh the ID token (or sign out and in once), then verify a normal user is still denied `/admin`.

The first successful claim is transactionally locked in `_system/adminBootstrap`. The client cannot assign itself an admin role. Available callable operations include profile setup, one-time bootstrap, role management, paginated user/question-bank export, validated question-bank import, trusted grading, mistake classification, and scoped progress reset.

### Publish content

The admin question editor performs a dry-run validation before importing a question and can save a draft or publish it. The import callable also accepts validated batches for controlled migrations. Correct answers and solutions are written to the private solution collection, while sanitized prompts go to the learner-readable question collection.

For every content release:

1. Export the current question bank.
2. Verify answers, units, tolerances, assumptions, distractors, translations, and worked solutions independently.
3. Dry-run the import and resolve version conflicts.
4. Import and publish only reviewed items.
5. Export again and record item count and checksum in the private release log.

The bundled demo seed is never automatically copied into production.

## Web deployment

`vercel.json` defines the frozen install, Vite build, `dist` output, SPA fallback, security headers, cache policy, and service-worker update headers.

1. Import the repository into Vercel with project root `.` and Node.js 22.
2. Add every `VITE_FIREBASE_*` variable. Use a staging Firebase project for Preview/Development and production Firebase only for Production.
3. Deploy and add the final hostname to Firebase Authentication and App Check.

```sh
vercel
vercel --prod
```

After deployment, verify deep-link refresh, Google sign-in, admin denial for a normal user, CSP/security headers, manifest/icons, installation, service-worker updates, offline recovery, and reconnect sync. See [Deployment](docs/DEPLOYMENT.md) for the full release and rollback procedure.

## PWA and offline behavior

The production build provides a standalone manifest, 192/512/maskable icons, an offline fallback, and a prompt-based service-worker update flow. Static app assets and safe images can be cached; Firebase, Auth, callable, and Firestore endpoints are network-only in Workbox.

Previously loaded structured content and local learning state can remain available offline. User actions are queued in IndexedDB and synchronized after reconnect. Published-question answers that cannot reach secure grading are stored separately with stable idempotency keys, then graded oldest-first when connectivity returns; private solutions are never copied into the offline cache. IndexedDB is useful resilience, not a disaster-recovery backup; do not clear browser storage while unsynced work remains.

## Validation and tests

Run the complete web gate:

```sh
pnpm validate
```

Run the backend and browser gates as well:

```sh
pnpm --dir functions typecheck
pnpm --dir functions build
pnpm exec playwright install chromium
pnpm test:e2e
```

Focused commands include `pnpm test:watch`, `pnpm test:coverage`, and Playwright projects `desktop`, `iphone`, and `ipad`. Firebase authorization tests must use emulators or a dedicated test project, never production. The responsive, accessibility, recovery, offline, slow-network, and two-device checklist is in [Testing](docs/TESTING.md).

## Export, backup, and recovery

- Learners can export their own paginated profile and learning data from Settings.
- Administrators can export the versioned question bank, including private solutions, through the protected callable.
- Production should use daily and weekly Firestore scheduled backups, restricted pre-release exports, Storage soft delete, and an isolated restore drill.
- Restore into a new database or recovery project first; never experiment against the production `(default)` database.

Exports can contain personal and privileged educational data. Store them outside the web root with least-privilege access, encryption, retention limits, and checksums. Follow [Backup and recovery](docs/BACKUP.md) for commands and the approved recovery sequence.

## Security notes

- Firestore and Storage use default-deny rules with owner-scoped private paths.
- Roles come from protected custom claims; the profile role is display metadata only.
- Callable inputs are strict Zod schemas and sensitive operations are rate-limited and audited.
- App Check reduces abuse but never replaces Authentication or Rules.
- Learner-readable documents never contain private answer keys.
- Database lesson/question text is rendered as structured text/KaTeX, not injected HTML.
- Service-account keys, exports, refresh tokens, bootstrap values, and App Check debug tokens must never be committed.

Read [Security model](docs/SECURITY.md) before changing access, grading, import/export, Storage, or bootstrap behavior. The canonical data contract and conflict rules are in [Firebase schema](docs/FIREBASE_SCHEMA.md). Contributions should follow [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation

- [Deployment and rollback](docs/DEPLOYMENT.md)
- [Testing and release matrix](docs/TESTING.md)
- [Latest local release validation](docs/RELEASE_VALIDATION.md)
- [Firebase schema and synchronization contract](docs/FIREBASE_SCHEMA.md)
- [Security model and incident response](docs/SECURITY.md)
- [Backup and recovery](docs/BACKUP.md)

## License

Released under the terms in [LICENSE](LICENSE).
