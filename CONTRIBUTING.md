# Contributing to CSCA Prep

Thank you for improving CSCA Prep. Changes should protect learner progress, keep exam content accurate, and preserve the app's calm, accessible experience.

## Local setup

1. Install Node.js 22 and pnpm 11.
2. Run `pnpm install --frozen-lockfile`.
3. Copy `.env.example` to `.env.local` and fill in a non-production Firebase web configuration when the change needs Firebase.
4. Run `pnpm dev`.

Cloud Functions are an independent package:

```sh
pnpm --dir functions install --frozen-lockfile
pnpm --dir functions typecheck
```

Never commit `.env.local`, service-account JSON, Firebase refresh tokens, the administrator bootstrap secret, database exports, or user data.

## Development expectations

- Keep TypeScript strict and avoid bypassing validation with `any`.
- Use the existing design tokens and components; preserve keyboard access, visible focus, sufficient contrast, touch targets, safe-area padding, and `prefers-reduced-motion`.
- Treat attempts and history as append-only where practical. Progress writes must remain local-first, idempotent, and conflict-aware.
- Do not place answer keys or privileged role logic in client-readable data.
- Keep authenticated Firebase/API responses out of service-worker caches.
- Hide unfinished actions instead of shipping non-functional controls or invented production data.

## Educational content

Every question and parameterized template must have a reproducibly verified answer. Include units, acceptable precision, formula assumptions, realistic distractors, and a worked solution. Mark seed material as demo content and use one of the documented `sourceType` values; never represent original practice material as an official CSCA question.

For a content change, include the verification method in the pull request. A second reviewer should check high-impact Mathematics and Physics content before publication.

## Before opening a pull request

Run the same gates as CI:

```sh
pnpm typecheck
pnpm --dir functions typecheck
pnpm lint
pnpm test
pnpm build
pnpm --dir functions build
pnpm test:e2e
```

If the change affects data access, test both an allowed request and a denied cross-user request. If it affects persistence, test offline edits, reconnect, refresh recovery, and two-tab conflict behavior.

## Pull requests

Keep pull requests focused. Explain the outcome, data migrations, security impact, screenshots or viewport checks, and exact verification performed. CI must pass before merge. Do not merge changes that can silently discard or overwrite newer learner progress.

Report suspected vulnerabilities privately through GitHub's **Security → Report a vulnerability** flow rather than a public issue.
