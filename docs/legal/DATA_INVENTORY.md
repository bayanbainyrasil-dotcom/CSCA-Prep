# What CSCA Prep stores

**Status: an engineering inventory, not a legal document.** It exists so the
privacy policy draft describes what the code actually does. Every entry below
was read from the source, not assumed; a change to storage should change this
file in the same commit.

## On the learner's own device

| Key | What it holds | Cleared by |
| --- | --- | --- |
| `csca-local-session-v2` | The on-device profile: display name, email (empty in on-device mode), role, onboarding flag, timezone, target exam date, language preference, settings | Signing out; clearing site data |
| `csca-device-id-v1` | A random per-device identifier used to attribute a sync mutation to a device | Clearing site data |
| `csca-session-v1-…` | A pointer to an in-progress attempt, so a reload does not lose it | Finishing or abandoning the attempt |
| `csca-theme` | Light or dark preference | Changing it; clearing site data |
| IndexedDB (`Dexie`) | The local-first copy of the learner's own study data listed below, so the app works offline | Signing out; clearing site data |

No answer key or worked solution is stored on the device for a
server-authoritative exam: the browser receives prompts only, and results come
from the server. See `docs/IMPLEMENTATION_STATUS.md`.

## In Firestore, under `users/{uid}`

Every one of these is the learner's own record and is readable only by that
learner. The rules default-deny everything else.

| Collection | What it holds |
| --- | --- |
| `attempts` | One record per answered question: which question, what was selected, whether it was correct, how long it took, confidence |
| `mistakes` | Questions answered incorrectly, kept so they can be re-surfaced |
| `topicMastery` | A per-topic mastery estimate derived from those attempts |
| `dailyPlans` | The generated plan for a given day and what was completed |
| `studyPlans` | The overall plan: start date, target date, daily minutes |
| `examAttempts` | Diagnostic and mock attempts, including the server-owned question order, clock and result |
| `vocabularyProgress`, `formulaProgress` | Spaced-repetition state for the trainers |
| `notes`, `bookmarks` | Text the learner wrote and items they saved |

The user profile document holds the same fields as the on-device profile above.

## Server-owned collections, not personal data

`questions`, `questionSolutions`, `blueprintCells`, `examTemplates`,
`subjects`, `topics`, `lessons`, `vocabulary`, `formulas`. These are content.
No learner writes to them, and `questionSolutions` is unreadable by any learner.

## Operational records

| Collection | What it holds | Contains personal data? |
| --- | --- | --- |
| `_auditLogs` | Administrator actions: who, what action, counts, batch ids | The administrator's uid |
| `_rateLimits` | A hashed action-and-identity key with a counter and an expiry | A hash, not an identity |
| `_importBatches` | Which content import batches have been applied | The administrator's uid |

Audit entries deliberately carry no question text, answer key or solution, and
no learner's words. This is asserted by test.

## What is not collected

No date of birth, no address, no phone number, no payment details, no
government identifier, no photograph, no contact list, no location, and no
analytics or advertising identifier. There is no third-party analytics SDK and
no advertising SDK in the bundle.

## The AI tutor

Not enabled. The feature flag is off, no provider is registered and no key
exists. If it is turned on, `docs/legal/AI_DISCLOSURE.md` describes exactly
what would be sent and to whom, and that description must be true before the
flag is set for any real learner.
