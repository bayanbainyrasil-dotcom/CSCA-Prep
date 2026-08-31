# Release validation

Validated on 2026-08-30 from a clean production build without Firebase credentials. In this configuration the application intentionally enters its clearly labelled local demo mode.

## Passed locally

- TypeScript project references and Firebase Functions typecheck
- ESLint with zero warnings
- 29 unit and React integration tests
- Web production build and generated PWA service worker (14 shell assets, 359.43 KiB, with runtime caching for larger chunks)
- Firebase Functions production build
- 16 Playwright browser scenarios; 20 project-specific duplicates intentionally skipped
- Desktop, iPhone portrait, iPad portrait, and iPad landscape layouts
- Horizontal-overflow checks across the core study routes on every browser project
- Dark/light theme switching and persistence
- Understand → answer → confidence → feedback practice flow
- 32-question diagnostic generation
- Mock-exam answer/flag recovery after reload
- Production service-worker recovery after an offline reload
- Delayed-response loading and interaction behavior
- Demo-mode admin denial
- Lazy-loaded global search and topic routing
- Production dependency audit with no known vulnerabilities in either workspace
- Publishable-source credential scan with no credential-like values found

## Lighthouse lab audit

The final production build was audited locally on 2026-08-30. These are lab results, not real-user field data.

| Profile | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Desktop | 99 | 100 | 100 | 100 | 0.7 s | 0.9 s | 10 ms | 0 |
| Simulated mobile | 77 | 100 | 100 | 100 | 2.9 s | 3.7 s | 320 ms | 0 |

The initial route transfers approximately 327 KiB in this audit. Firebase, global search, learning data, charts, and subject-heavy modules are split from the initial shell where their loading order permits it.

## Deployment acceptance checks

These checks require the operator's real Firebase, App Check, Google OAuth, Vercel domains, and at least two signed-in browser profiles. They cannot be truthfully completed against the credential-free local demo:

1. Google sign-in, sign-out, token refresh, and returning-user profile reuse.
2. Normal-user denial and owner access to `/admin` after the one-time server bootstrap.
3. App Check enforcement for callable Functions.
4. Firestore and Storage rules tests against the staging Emulator Suite/project.
5. Secure grading with published prompt/solution pairs and offline-answer replay after reconnect.
6. Cross-device convergence between two sessions, including a deliberate stale edit.
7. Vercel response headers, deep-link refresh, iOS Add to Home Screen, and service-worker update from the final HTTPS hostname.

Use the step-by-step matrix in [Testing](TESTING.md) and the staged release procedure in [Deployment](DEPLOYMENT.md). Production release is blocked until these environment-dependent checks pass on staging.
