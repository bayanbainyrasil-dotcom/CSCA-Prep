# CSCA Prep Firebase schema

This document is the contract between the web client, Cloud Functions, Firestore,
and the offline outbox. Firestore is deliberately split into small documents; a
user profile must never grow into a container for all learning history.

## Design invariants

- Every private path is nested below `users/{uid}`. The UID in the path is the
  security boundary; clients never query a shared progress collection.
- Mutable synced records use a monotonic `version` and a trusted
  `serverUpdatedAt`. A stale device cannot overwrite a newer version.
- Attempts and diagnostics are append-only. A stable idempotency key is the
  document ID, so retrying a queued action cannot create a duplicate.
- Notes and bookmarks use versioned tombstones. A physical delete would allow an
  old offline device to resurrect deleted data.
- Public question prompts and private answer/solution documents are separate.
  Firestore rules cannot hide individual fields in an otherwise readable document.
- Trusted answer correctness and diagnostic baselines are server-owned. A user may
  queue raw answers offline, but cannot author trusted attempt result fields through
  the Firestore client. User-facing mastery mirrors are private to that user and are
  never an authorization or privilege source.

## Root collections

| Path | Purpose | Client access |
| --- | --- | --- |
| `users/{uid}` | Identity-facing profile and preferences | Owner read/create/safe update; admin read |
| `questions/{questionId}` | Sanitized prompt, choices, classification, publication metadata | Signed-in users read published; admin manages |
| `questionSolutions/{questionId}` | Correct answer, solution, explanation, common mistakes | Cloud Functions and admins only |
| `subjects/{id}` | Subject navigation metadata | Published read; admin manages |
| `topics/{id}` | Normalized Math/Physics topic hierarchy | Published read; admin manages |
| `lessons/{id}` | Lesson content and relationships | Published read; admin manages |
| `questionTemplates/{id}` | Verified parameterized question templates | Published read; admin manages |
| `examTemplates/{id}` | Mock composition and timing metadata, never answer keys | Published read; admin manages |
| `vocabulary/{id}` | Shared CSCA vocabulary | Published read; admin manages |
| `formulas/{id}` | Shared formula trainer content | Published read; admin manages |
| `appConfig/{id}` | Versioned configuration with `visibility` | Authenticated public read or admin-only |
| `analyticsDaily/{date}` | Server-derived aggregate analytics | Admin read only |

Operational collections beginning with `_` are server-only:
`_system`, `_rateLimits`, and `_auditLogs`. Import/backup jobs should follow the
same convention and remain denied by the catch-all rule.

## User profile

`users/{uid}` contains direct fields, not a sync envelope:

```text
uid, name, email, photoURL
role, roleVersion
createdAt, lastActiveAt, updatedAt, version
timezone, targetExam, targetDate, preferredLanguage
settings, onboarding
```

`uid`, `email`, `role`, `roleVersion`, and `createdAt` are immutable to the web
client. The callable `ensureUserProfile` sources identity fields from Firebase
Authentication and creates `role: "user"`. Only Admin SDK code can change a role.
Clients refresh a profile with a transaction that increments `version` by exactly
one and sends `serverTimestamp()` for `lastActiveAt` and `updatedAt`.

## User subcollections

All paths below are `users/{uid}/{collection}/{entityId}`.

| Collection | Mutation model | Typical payload |
| --- | --- | --- |
| `progress` | Versioned | Lesson/topic position, completion state |
| `topicMastery` | Versioned | Accuracy, speed, confidence, next review |
| `attempts` | Append-only | Raw response or server-graded response |
| `studySessions` | Versioned | Active/completed session and duration |
| `dailyPlans` | Versioned | Date, ordered activities, completion |
| `mistakes` | Versioned | Question, reason, repetition and next review |
| `bookmarks` | Versioned + tombstone | Target type and target ID |
| `notes` | Versioned + tombstone | Topic ID and plain-text/structured note |
| `examAttempts` | Versioned, sealed after submit | Template, timer, status, summary |
| `vocabularyProgress` | Versioned | SRS state and review dates |
| `formulaProgress` | Versioned | SRS state and rearrangement mastery |
| `diagnostics` | Append-only | Raw diagnostic responses |
| `syncState` | Versioned | Small per-device sync checkpoint only |

Mock responses live at
`users/{uid}/examAttempts/{examAttemptId}/answers/{questionId}`. They can be
created or updated only while the parent attempt is not `submitted`, `completed`,
or `graded`.

### Sync envelope

Every user subcollection document uses this exact envelope:

```ts
interface SyncEnvelope<T> {
  entityType: string;
  entityId: string;        // exactly the Firestore document ID
  ownerId: string;         // exactly the authenticated path UID
  operation: "upsert" | "delete";
  version: number;         // create at 1; update existing + 1
  updatedAt: string;       // ISO-8601 client event time; may be old after offline use
  mutationId: string;      // stable retry/idempotency ID
  payload?: T | null;      // map for upsert; absent/null only for tombstone
  serverUpdatedAt: Timestamp; // always serverTimestamp()
}
```

Physical client deletes are denied. Only `notes` and `bookmarks` accept the
`delete` operation. All other collections require an upsert.

## Conflict and offline algorithm

1. Save every action to Dexie immediately with a stable `mutationId`.
2. Send critical actions immediately; debounce ordinary state for 1–3 seconds.
3. For mutable cloud documents, run an online Firestore transaction. Read the
   current document, require the outbox entry's base version to match, then write
   `current.version + 1` and `serverTimestamp()`.
4. On a version rejection, retain the outbox entry, fetch the newer document, and
   merge by entity semantics. Never show “Saved” for a rejected write.
5. Attempts/diagnostics use the stable mutation ID as the document ID and are
   create-only. Treat “already exists” as an idempotent success after comparing
   identity.
6. For notes/bookmarks, sync tombstones like normal versions. Compact old
   tombstones only in trusted maintenance code after every supported offline
   retention window has elapsed.

Firestore transactions do not run offline. The Dexie outbox is therefore the
source of pending mutations, not a promise that Firestore already accepted them.

## Content versioning

Shared content has:

```text
status: draft | published | archived
version: positive integer
createdAt, createdBy
updatedAt, updatedBy
```

Admin client updates increment `version` exactly once and use
`serverTimestamp()`. The `importQuestionBank` callable requires
`expectedVersion` for every item (`0` means create) and aborts the complete batch
if any version differs. Imports never partially apply.

The callable validates full question objects with Zod, rejects executable markup,
verifies unique options, and ensures `correctAnswer` references an option. It then
splits the object:

- `questions/{id}` receives the safe prompt and published metadata.
- `questionSolutions/{id}` receives the answer key and explanations.

`gradeQuestion` is unavailable for exam mode. It reads the private solution,
writes one idempotent attempt (and mistake when needed), then returns feedback for
learn/practice modes.

## Callable API summary

All callables are deployed in `asia-east1`, require Firebase Authentication where
applicable, and enforce App Check.

| Callable | Authorization | Contract |
| --- | --- | --- |
| `ensureUserProfile` | Signed-in user | Idempotently creates/updates the caller profile |
| `bootstrapAdmin` | Verified Google user + one-time server secret | Claims the single bootstrap owner and requests token refresh |
| `setUserRole` | Admin custom claim | Changes Auth custom claims and the server-owned role mirror |
| `gradeQuestion` | Signed-in user | Grades one non-exam answer with an idempotency key |
| `resetMyProgress` | Signed-in user + literal confirmation | Recursively removes only the caller's learning subcollections |
| `exportMyData` | Signed-in user | Pages through only the caller's profile/subcollections |
| `exportQuestionBank` | Admin custom claim | Pages prompts joined with private solutions |
| `importQuestionBank` | Admin custom claim | Dry-run or atomic validated import with version preconditions |

Exports are paginated to stay below callable response limits. `nextCursor` is the
last document ID; call again until an empty page or `nextCursor: null`. Firestore
timestamps are represented as `{"$type":"timestamp","value":"<ISO-8601>"}` in
export responses.

## Indexes

`firestore.indexes.json` includes the first production query shapes for content,
mastery review, attempts, mistakes, mock recovery, and daily plans. Deploying a
new compound query may require another index. Follow the Firestore error link in
development, add the generated definition to the checked-in index file, and
review it before deployment.
