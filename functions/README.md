# CSCA Prep Cloud Functions

This package builds independently from the Vite application.

```sh
pnpm install --ignore-workspace
pnpm run typecheck
pnpm run build
```

The deployed runtime is Node.js 20 and the region is `asia-east1`. All exported
callables enforce Firebase App Check. Before the first Functions deployment, set
the one-time owner credential through Secret Manager:

```sh
firebase functions:secrets:set ADMIN_BOOTSTRAP_CODE
```

Never create a `VITE_` variable for this secret. For local emulation, place the
value in `functions/.secret.local`; that file is ignored and must never be shared.

See `docs/FIREBASE_SCHEMA.md` for callable/data contracts and `docs/SECURITY.md`
for the bootstrap and threat model.
