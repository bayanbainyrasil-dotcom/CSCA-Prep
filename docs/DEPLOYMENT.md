# Deployment

This guide deploys the React PWA to Vercel and the trusted data layer to Firebase. Use separate Firebase projects for development/staging and production so tests and preview deployments can never modify production learner data.

## Prerequisites

- Node.js 22 and pnpm 11 for the web app
- A Firebase project on the Blaze plan (Cloud Functions and current Cloud Storage projects require billing)
- Firebase CLI access with permission to deploy rules, indexes, Storage rules, functions, and secrets
- A Vercel account connected to the GitHub repository
- Optional: Google Cloud CLI for backup administration

Install dependencies and create a local configuration:

```sh
pnpm install --frozen-lockfile
pnpm --dir functions install --frozen-lockfile
cp .env.example .env.local
```

Fill `.env.local` from **Firebase console → Project settings → Your apps → Web app**. Never put a service-account key or the administrator bootstrap code in a `VITE_` variable: Vite embeds those values in the public browser bundle.

## 1. Configure Firebase

1. Create a Firebase Web app.
2. Under **Authentication → Sign-in method**, enable Google. Set the support email.
3. Create Firestore in Native mode. Choose the location deliberately; changing it later requires a migration. The Cloud Functions region in this project is `asia-east1`.
4. Create the default Cloud Storage bucket and keep it private. New buckets use the `PROJECT_ID.firebasestorage.app` naming format.
5. Under **Authentication → Settings → Authorized domains**, add `localhost`, the final production hostname, and only the exact preview/staging hostnames that need sign-in. Do not treat a wildcard preview domain as trusted.
6. Under **App Check**, register the Web app with reCAPTCHA v3 and copy its site key into `VITE_FIREBASE_APP_CHECK_SITE_KEY`. Deploy and inspect App Check metrics before turning on product-level enforcement. The callable functions already require valid App Check tokens.

The required browser variables are:

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_APP_CHECK_SITE_KEY=
```

Firebase web configuration identifies the project; it is not an authorization boundary. Firestore/Storage rules, callable authorization, App Check, and restricted API-key settings provide the actual protection.

### Deploy the backend

From the repository root:

```sh
firebase login
firebase use --add
firebase functions:secrets:set ADMIN_BOOTSTRAP_CODE
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

Enter the one-time owner setup value at the secret prompt (the requested initial value is `2007`). Secret Manager stores it outside the repository. Do not place it in `.env`, GitHub, Vercel, screenshots, or logs.

The deployed `asia-east1` callables are `ensureUserProfile`, `bootstrapAdmin`, `setUserRole`, `exportMyData`, `exportQuestionBank`, `importQuestionBank`, and `gradeQuestion`. Admin and import operations verify authorization server-side; the client must never assign its own role.

## 2. Bootstrap the owner account

Complete App Check and the function deployment first.

1. Open the deployed app and sign in with the owner's verified Google account.
2. Open `/admin` and use the one-time setup control with the bootstrap value.
3. Let the app refresh the ID token, or sign out and back in once.
4. Confirm `/admin` is available to that account and denied to a normal test account.
5. Confirm `_system/adminBootstrap` is marked `completed` and names the correct owner UID.

Bootstrap is locked to the first completed owner in Firestore. Knowing the setup value must not grant a second account admin access. Keep the secret in Secret Manager because the deployed function declares it, and remove the setup prompt from normal user flow after completion.

## 3. Push to GitHub

Create a repository, push the default branch, and enable the repository's dependency graph. Protect the production branch and require these checks before merge:

- **Typecheck, lint, test, and build**
- **Cloud Functions typecheck and build**
- **Playwright smoke tests** when E2E files are present
- **Reject vulnerable dependency additions**

The GitHub workflow intentionally performs no production deployment and needs no Firebase credentials. Vercel only publishes a deployment after its own build succeeds; use the protected production branch for production releases.

## 4. Deploy to Vercel

1. Import the GitHub repository into Vercel.
2. Keep the project root as `.` and select the Vite framework preset.
3. Set Node.js 22 in Project Settings. `vercel.json` supplies the frozen pnpm install, build command, `dist` output, SPA fallback, security headers, CSP, and service-worker cache headers.
4. Add every `VITE_FIREBASE_*` value under **Settings → Environment Variables**. Use the production Firebase project only for the Production environment; point Preview and Development at a staging project.
5. Deploy, attach the production domain, then add that exact domain to Firebase Authentication and the App Check registration.

CLI deployment is also supported after `vercel link`:

```sh
vercel
vercel --prod
```

The CSP is deliberately allowlist-based for Firebase and Google sign-in. When adding another analytics, media, or API origin, update the smallest relevant CSP directive instead of weakening the whole policy.

## 5. Verify production

Run `pnpm validate` before release, then verify:

- a deep link such as `/roadmap` loads directly and after refresh;
- Google login works on the final domain and a normal user cannot enter `/admin`;
- response headers include the CSP, HSTS, `nosniff`, frame protection, and `same-origin-allow-popups`;
- the generated manifest uses **CSCA Prep**, standalone display, and the 192/512/maskable icons;
- the Workbox service worker updates without being CDN-cached and never caches Firebase/Auth responses;
- installation works from Chrome/Edge and **Add to Home Screen** on iPhone/iPad Safari;
- an already-loaded lesson/session still opens offline and pending progress syncs after reconnect;
- the checks in [TESTING.md](./TESTING.md) pass against production-like staging.

The PWA service worker is generated during `pnpm build`; it is intentionally disabled in the Vite development server. Test installation and offline behavior from `pnpm preview` or HTTPS staging.

## Rollback

- **Web:** promote the last known-good Vercel deployment. Do not roll back to a client that writes an older, incompatible data shape.
- **Rules/functions:** deploy a reviewed known-good Git revision. Rules and function code do not restore data already written.
- **Data:** follow [BACKUP.md](./BACKUP.md). Practice the restore in a separate Firebase project/database before any production recovery.

Official references: [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin), [Firebase App Check for Web](https://firebase.google.com/docs/app-check/web/recaptcha-provider), [Vite SPAs on Vercel](https://vercel.com/docs/frameworks/frontend/vite), and [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json).
