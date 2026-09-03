# Production deployment runbook — Workstream 1

**What this document is.** Everything needed to bring CSCA Prep up on a real
domain, in the order it has to happen, with the exact console screen and value
shape for each step the owner must do himself.

**What has and has not been proven.** Nothing in this repository has been
deployed. The verification harness below is tested and works; the deployment it
is meant to check does not exist yet. Every gate item is marked accordingly, and
none is ticked from reading configuration.

---

## Order of operations

Firebase first, Vercel second: the web build needs the Firebase client
identifiers as build-time variables, so the Firebase project must exist before
the first real Vercel build.

### 1. Firebase project

1. **Create or choose the project.** `console.firebase.google.com` → Add project.
   One project. Do not create a second one for staging until the first is proven.
2. **Upgrade to Blaze.** Settings → Usage and billing → Details and settings →
   Modify plan. Cloud Functions v2 cannot deploy on Spark. Set a budget alert at
   a level you choose; expected spend at current traffic is inside the free tier.
3. **Register a Web app.** Project settings → Your apps → Web. Copy the six
   config values; they become the `VITE_FIREBASE_*` variables. These are public
   client identifiers, not secrets — they are protected by Security Rules, App
   Check and API-key restrictions, not by being hidden.
4. **Enable Google sign-in.** Authentication → Sign-in method → Google → Enable.
   Set the support email.
5. **Authorized domains.** Authentication → Settings → Authorized domains → add
   the production hostname. Sign-in fails silently without this.
6. **App Check.** App Check → Apps → register the Web app with reCAPTCHA v3.
   Copy the site key into `VITE_FIREBASE_APP_CHECK_SITE_KEY`. Then App Check →
   APIs → set **Cloud Functions** and **Cloud Firestore** to *Enforced*.
   Unenforced App Check is the single most consequential misconfiguration
   available here: it would let anyone call the grading and mock endpoints
   directly. The harness checks this.
7. **Bootstrap secret.** The one server secret this app has:
   ```
   firebase functions:secrets:set ADMIN_BOOTSTRAP_CODE
   ```
   A long random string, entered at the prompt. It never appears in Git, in a
   `VITE_` variable, in a log or in this file. It is used once, to grant the
   first administrator claim, and can be rotated afterwards.

### 2. Deploy the backend

```
firebase login
firebase use --add                 # select the project, alias it "default"
firebase deploy --only firestore:rules,firestore:indexes,storage
firebase deploy --only functions
```

`firebase use --add` writes `.firebaserc`, which is deliberately absent from the
repository: it names a specific project and is the owner's choice, not a
committed default.

Functions deploy to **asia-east1** (`functions/src/platform.ts`). Callable URLs
are therefore `https://asia-east1-<project-id>.cloudfunctions.net/<name>`.

### 3. Vercel

1. Import the GitHub repository. Framework preset: Vite. `vercel.json` supplies
   the build command, output directory, rewrites and headers.
2. **Environment variables**, Production scope, all seven:
   | Variable | Value shape |
   | --- | --- |
   | `VITE_DEPLOYMENT_MODE` | `firebase` — must not be `local-demo` on any Vercel environment |
   | `VITE_FIREBASE_API_KEY` | `AIza…` from the Web app config |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `<project>.firebaseapp.com` |
   | `VITE_FIREBASE_PROJECT_ID` | `<project-id>` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `<project-id>.firebasestorage.app` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | numeric sender id |
   | `VITE_FIREBASE_APP_ID` | `1:…:web:…` |
   | `VITE_FIREBASE_APP_CHECK_SITE_KEY` | reCAPTCHA v3 site key |

   No server secret is ever a `VITE_` variable. Everything in this table is a
   public client identifier by design.
3. **Domain.** Add the production domain and its DNS records. Then add that same
   hostname to Firebase Authorized domains (step 1.5) and to the reCAPTCHA key's
   allowed domains, or sign-in and App Check will both fail on it.

---

## Verifying the deployment

Two scripts. Neither trusts configuration; both ask the running site.

```
# Preview the real header behaviour locally before spending a deploy on it.
pnpm build && node scripts/preview-with-headers.mjs 4180

# Verify a deployed origin. Exits non-zero on any failure, so it can gate a release.
node scripts/verify-deployment.mjs https://<your-domain> \
  --callable https://asia-east1-<project-id>.cloudfunctions.net/startMockExam
```

`verify-deployment.mjs` reads `vercel.json` as the source of truth, so it cannot
drift from the config: adding a header to `vercel.json` adds a check.

It covers: every declared header served exactly as declared; the SPA rewrite on
deep routes; the PWA manifest and service worker; that no seed solution string
appears in the served JavaScript; and that an unattested callable is refused.
The App Check probe **fails when not given a callable URL** rather than passing
silently, and fails when the endpoint answers 200.

### Checks the harness cannot do

These need a browser and a human, once, on the deployed domain:

- Google sign-in and sign-out complete.
- Account deletion with reauthentication completes (Settings → Delete my account;
  the server refuses a sign-in older than five minutes).
- Onboarding state written on one device restores on a second device.

---

## Release gate — current state

| Gate item | State |
| --- | --- |
| Security headers served on the real domain | **Not deployed.** Harness written and proven against a local replay of `vercel.json`. |
| Google sign-in / sign-out | **Not deployed.** Code path exists, unverified. |
| App Check rejects an unattested request | **Not deployed.** Harness probe written and proven to fail against a non-enforcing endpoint. |
| Account deletion with reauthentication | **Not deployed.** Code path exists and is unit-tested; unverified on a real Auth token. |
| Two-device sync of onboarding state | **Not deployed.** Code path exists, unverified. |
| Firestore/Storage rules deployed | **Not deployed.** Rules source-contract tests pass locally. |
| No answer key in the served bundle | Passing locally (`scripts/check-bundle-secrets.mjs`); re-checked against the domain by the harness after deploy. |
