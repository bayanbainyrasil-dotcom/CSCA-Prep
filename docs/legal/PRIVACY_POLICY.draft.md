# Privacy Policy — DRAFT

**This is a draft written by an engineer from the source code. It is not legal
advice and has not been reviewed by a lawyer. It must not be published as a
policy until a qualified person has reviewed it against the law that applies to
the operator and to the learners, and until the operator's real identity and
contact details replace the placeholders below.**

Placeholders that must be filled in before publication are marked `[…]`.

---

## Who runs this service

CSCA Prep is operated by `[operator's legal name]`, `[address]`. Questions about
this policy: `[contact email]`.

## What this policy covers

The CSCA Prep web application at `[hostname]`. The public demo deployment on
GitHub Pages stores everything on the learner's own device and sends nothing to
a server; the hosted deployment additionally stores study data in Google
Firebase, described below.

## What is collected

`docs/legal/DATA_INVENTORY.md` lists every field, read from the code. In summary:

- **Account.** A display name, an email address, and the account identifier
  supplied by Google Sign-In. No password is ever seen by this application.
- **Setup.** The target exam date, subject levels, language preference and daily
  study minutes — all entered by the learner.
- **Study activity.** Answers, whether they were correct, time taken, confidence,
  mistakes, per-topic mastery, plans, exam attempts, trainer progress, and any
  notes or bookmarks the learner writes.
- **Technical.** A random per-device identifier used to reconcile changes made
  on more than one device, and a timezone taken from the browser.

## What is not collected

No date of birth, address, phone number, payment details, government
identifier, photograph, contact list or location. There is no analytics SDK and
no advertising SDK. Nobody pays to place anything in this application.

## Why it is collected

To run the service the learner asked for: to show their progress, to schedule
what they study next, to re-surface what they got wrong, and to keep the same
state on more than one device. `[Legal basis, per the applicable law — to be
completed with legal advice.]`

## Who it is shared with

- **Google Firebase** (Authentication, Firestore, Cloud Functions, Storage,
  App Check) as the hosting and database provider. `[Confirm the data region.]`
- `[Hosting provider for the web application, if separate.]`
- Nobody else. Study data is not sold, rented, or shared with advertisers, and
  is not used to train any model.

## AI

There is no AI feature enabled. See `docs/legal/AI_DISCLOSURE.md`. If one is
ever enabled, this policy must be updated before it is turned on for any
learner, and the disclosure must name the provider and its retention terms.

## How long it is kept

Study data is kept while the account exists. Deleting the account deletes it —
see below. `[Retention period for operational records such as audit logs, to be
set by the operator.]`

## Security

Access is default-deny: a learner can read and write only their own records,
enforced by server-side rules rather than by the application. Answer keys and
worked solutions live in a collection no learner can read, and are never sent to
the browser during a server-authoritative exam. Administrator actions require an
administrator claim and App Check, and are recorded in an audit log that
deliberately contains no question or answer text.

## What a learner can do

- **See it.** Everything about a learner is visible in the app itself.
- **Export it.** `[Export flow — implemented? state honestly here.]`
- **Correct it.** Profile and setup fields are editable in Settings.
- **Delete it.** `[Deletion flow — implemented? state honestly here.]`
- **Complain.** `[Supervisory authority, per the applicable law.]`

## Children

`[The operator must decide and state the minimum age, and what happens if a
younger learner signs up. This affects which laws apply and cannot be answered
from the code.]`

## Changes

`[How changes will be notified.]`

Last updated: `[date]`.
