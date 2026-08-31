# CSCA Prep security model

## Trust boundaries

The browser is untrusted, including the admin UI. Route guards improve user
experience but grant no authority. Firestore/Storage Rules protect direct SDK
access; callable Functions independently authenticate and validate because the
Admin SDK bypasses Rules.

The authorization sources are:

- Firebase Authentication for identity.
- The Auth custom claim `admin: true` (and mirrored `role: "admin"`) for admin
  authorization.
- App Check for app attestation and abuse reduction. App Check is not a replacement
  for Authentication or Rules.
- Secret Manager for the temporary administrator bootstrap credential.

The `role` field in `users/{uid}` is display/query metadata only. Rules never grant
admin access from that document, and client writes cannot change it.

## One-time administrator bootstrap

The repository and every Vite environment must contain no bootstrap credential.
Set it through a hidden CLI prompt from a trusted workstation:

```sh
firebase functions:secrets:set ADMIN_BOOTSTRAP_CODE
firebase deploy --only functions
```

At the prompt, enter the owner-provided initial setup code. Do not place it in a
shell history argument, `.env`, Vercel variable, screenshot, issue, or CI log.

Bootstrap flow:

1. Enable Google Authentication and App Check, then sign in with the intended
   owner account. The Google email must be verified.
2. Call `bootstrapAdmin` once with an App Check protected callable request.
3. The Function rate-limits by UID and source address, compares fixed-length
   hashes in constant time, and transactionally reserves `_system/adminBootstrap`.
4. Admin SDK sets `admin: true` and `role: "admin"` custom claims, updates the
   protected profile role, and permanently marks bootstrap `completed`.
5. Force a fresh ID token in the client (`currentUser.getIdToken(true)`) before
   navigating to `/admin`.

After completion, no other UID can bootstrap even with the original code. The
owner call is idempotent so a partial Auth/Firestore failure can repair itself.
The server state, not a password prompt, is the permanent disable switch. Rotate
the secret after setup, and keep the completed lock document. A full Functions
deployment may redeploy the callable, but the lock still prevents reuse.

For a stricter production ceremony, restrict Function invocation at the platform
level during bootstrap and monitor `_auditLogs` for denied/completed events.

## Firestore isolation

- Default deny applies to every unmatched path.
- An owner may access only `users/{request.auth.uid}` and its explicitly listed
  subcollections. User A cannot get or list User B's data.
- Admins may read user data for the stated admin analytics/support use case, but
  cannot edit another user's progress through client rules.
- Profile identity and privilege fields are immutable to clients.
- Sync writes require the path UID, envelope owner, and authenticated UID to match.
- Mutable writes require an exact `version + 1` transition and
  `serverUpdatedAt == request.time`.
- Attempts and diagnostics are append-only. Clients cannot author trusted result,
  score, baseline, or mastery fields.
- Exam answers become immutable once the parent attempt is sealed.
- Only published shared content is readable to normal signed-in users. Firestore
  Rules are not query filters: client queries must include `status == "published"`.
- `questionSolutions`, operational collections, audit logs, and backup paths are
  not client writable.

Question prompts and answers are split because any field in a readable Firestore
document is readable through the SDK/devtools, regardless of whether React renders
it. Full mock grading must stay server-side; never copy answer keys into cached
exam documents.

## Storage isolation

- Personal objects belong below `users/{uid}` and are readable/writable only by
  that owner; admins have read access for support.
- Personal uploads are at most 5 MiB and limited to raster images, PDF, JSON, or
  plain text. SVG/HTML are intentionally rejected because they can execute active
  content in unsafe rendering contexts.
- Shared learning media below `content/` is authenticated-read and admin-write,
  at most 25 MiB, with an explicit media MIME allowlist.
- Server-created exports are owner-read/delete but never client-created.
- Backups are denied to every client, including admins. Use a service identity and
  bucket IAM for managed backups.

File extensions are not trusted; rendering code must also honor a safe content
type, use download disposition for documents, and never inject uploaded text as
HTML.

## Callable protections

- Every callable enforces App Check. Bootstrap, role mutation, and import also
  enable App Check replay protection.
- Every input is parsed by a strict Zod schema. Unknown keys are rejected.
- Admin callables call `requireAdmin` against the current custom claim before any
  data access.
- Bootstrap, role changes, grading, imports, and exports have transactional
  per-identity rate limits in `_rateLimits`.
- Role changes, bootstrap, and question imports/exports write server-only audit
  events. Secret values and question bodies are never logged.
- Imports cap batch and text sizes, reject raw executable markup, require version
  preconditions, and commit atomically.
- User and admin exports are paginated; callers must assemble and encrypt/store
  the resulting file safely.
- `resetMyProgress` requires the exact Zod-validated confirmation `RESET`, takes a
  short server-only write lock, and recursively deletes only the caller's listed
  learning subcollections. It preserves the Auth account and `users/{uid}` profile;
  direct physical deletes remain denied by Rules.

Mastery and review documents are user-scoped adaptive-learning state, not security
claims. A determined owner can modify their own local learning metrics; those values
must never grant privileges or be represented as an official CSCA score. Trusted
question correctness still comes from `gradeQuestion` and private answer keys.

Enable Firestore TTL for `_rateLimits.expiresAt` so expired limiter documents are
removed automatically. TTL deletion is asynchronous; correctness does not depend
on immediate cleanup.

## App Check rollout

1. Register the production Vercel domains in Firebase App Check using the selected
   web provider.
2. Put only the public site key in `VITE_FIREBASE_APP_CHECK_SITE_KEY`.
3. Register local debug tokens in the Firebase console; never commit a debug token.
4. Verify callable, Firestore, and Storage metrics in monitor mode.
5. Enforce App Check for Cloud Functions, Firestore, and Storage after legitimate
   traffic is confirmed.

The Functions code already rejects missing/invalid App Check tokens. A frontend
without correctly initialized App Check will receive a failed-precondition or
unauthenticated callable error; do not weaken the backend to work around a missing
site configuration.

## Browser and content safety

- Store lesson/question content as structured plain text and KaTeX source. Do not
  use `dangerouslySetInnerHTML` with database content.
- Sanitize any future rich-text format on ingestion and rendering with a narrow
  allowlist.
- Keep Vercel CSP, frame restrictions, MIME sniffing protection, referrer policy,
  and permissions policy enabled.
- Firebase web configuration is a public project identifier, not a server secret.
  Service-account keys, bootstrap credentials, App Check debug tokens, and private
  API credentials are secrets and must never use a `VITE_` prefix.
- Run dependency audit and CI checks before deployment. Treat dependency lockfile
  changes as security-sensitive review items.

## Required emulator tests

Before a Rules deployment, test at least:

1. unauthenticated access is denied;
2. User A cannot read/list/write User B's profile or subcollections;
3. a user cannot change `role`, `roleVersion`, UID, email, or `createdAt`;
4. stale/equal/skipped versions and forged server timestamps are denied;
5. attempts cannot update/delete or include trusted result fields;
6. tombstones work only for notes/bookmarks and physical deletes fail;
7. submitted exam attempts and their answers are immutable;
8. normal users cannot read drafts, archived content, or `questionSolutions`;
9. admins can manage versioned public content and read analytics/user data;
10. Storage prevents cross-user access, executable types, oversized files, and all
    backup access.

Use a dedicated Firebase test project or the Emulator Suite. Never run destructive
security tests against production.

## Incident response

If an admin account or secret may be compromised:

1. Disable the Auth user and revoke refresh tokens.
2. Remove its admin custom claim using a trusted Admin SDK environment.
3. Rotate affected Secret Manager versions and service credentials.
4. Review `_auditLogs`, Cloud Logging, Auth events, Firestore changes, and Storage
   access for the exposure window.
5. Restore data only from a verified immutable backup, then validate versions and
   ownership before reopening writes.
6. Document the cause and add a regression test before redeployment.
