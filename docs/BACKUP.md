# Backup and recovery

CSCA Prep has three data-protection layers: user/admin JSON exports, managed Firestore backups, and Cloud Storage recovery. A source-code backup is not a database backup, and IndexedDB on one device is not a disaster-recovery strategy.

## Recommended production policy

| Data | Protection | Retention | Restore drill |
| --- | --- | --- | --- |
| Firestore | Daily scheduled backup plus weekly scheduled backup | Daily 14 days; weekly 14 weeks | Quarterly to a new database/project |
| Question bank | Versioned admin JSON export after each content release | Keep current and previous releases | Validate with dry-run import monthly |
| User data | User-requested JSON export through `exportMyData` | User controlled | Parse and spot-check each release |
| Cloud Storage | Soft delete plus a separate restricted backup bucket where required | 30 days, subject to cost/privacy policy | Quarterly object recovery |
| Source/config | Protected GitHub repository and release tags | Indefinite | Build a tagged revision quarterly |

Backups can contain names, emails, notes, learning history, and answer attempts. Restrict them with least-privilege IAM, public-access prevention, encryption, access logging, and an explicit retention/deletion policy. Never commit an export to Git.

## Application exports

- **Export My Data** calls `exportMyData` and returns only the signed-in user's profile and paginated subcollections.
- **Export Question Bank** calls `exportQuestionBank` and requires an admin claim. Store the resulting JSON outside the web root.
- **Import Question Bank** calls `importQuestionBank`, requires admin and App Check, validates the payload, and supports a dry run. Always run the dry run, review IDs and versions, then import. Version conflicts abort instead of silently overwriting newer questions.

Create an admin question-bank export immediately before and after a bulk import. Record the app commit, export timestamp, actor, item count, and SHA-256 checksum in the private operations log.

## Firestore scheduled backups

Firestore scheduled backups are consistent point-in-time copies and include index configuration, but not TTL policies. They require billing and appropriate Google Cloud IAM permissions. Configure them in **Google Cloud console → Firestore → Databases → Scheduled backups**, or with the Google Cloud CLI:

```sh
gcloud config set project YOUR_PROJECT_ID
gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=14d
gcloud firestore backups schedules create --database='(default)' --recurrence=weekly --retention=14w --day-of-week=SUN
gcloud firestore backups schedules list --database='(default)'
gcloud firestore backups list --format="table(name, database, state)"
```

Firestore allows at most one daily and one weekly schedule. Alerts should cover failed backup operations and unexpected schedule removal.

### Manual export before a risky operation

For a release that changes many documents, also create a managed export to a dedicated bucket in the same location as Firestore:

```sh
gcloud firestore export gs://YOUR_RESTRICTED_BACKUP_BUCKET/firestore --async
gcloud firestore operations list
```

Save the command's exact `outputUriPrefix`; it is the restore input. Managed export/import reads and writes documents and incurs charges. Do not use the live Firebase Storage bucket as the export destination.

## Restore procedure

1. Stop admin imports and other bulk writers. Preserve the incident timeline and identify the last known-good timestamp.
2. Export the current damaged state for investigation before changing it.
3. Restore the selected scheduled backup to a **new database ID** or restore/export into an isolated recovery project. A scheduled-backup restore does not overwrite an existing database.
4. Deploy the same indexes and rules to the recovery environment and compare document counts, representative users, question/solution pairs, timestamps, and role records.
5. Check that private `questionSolutions` data is still inaccessible to learners and that user A cannot read user B.
6. Plan the cutover or selective copy, take a fresh pre-cutover backup, and obtain explicit operator approval.
7. After recovery, test login, progress sync, exam recovery, exports, and admin access, then document the recovery point and any data gap.

Example restore to a new database:

```sh
gcloud firestore databases restore \
  --source-backup=projects/YOUR_PROJECT_ID/locations/YOUR_LOCATION/backups/YOUR_BACKUP_ID \
  --destination-database='csca-recovery'
```

Do not delete or replace the production `(default)` database as an exploratory step. An in-place recovery is destructive and requires a separate approved runbook. See Google's [Firestore backup and restore guide](https://cloud.google.com/firestore/docs/backups) before an incident.

For managed exports, validate in a recovery project first, then use the recorded prefix:

```sh
gcloud firestore import gs://YOUR_RESTRICTED_BACKUP_BUCKET/firestore/EXACT_EXPORT_PREFIX --async
gcloud firestore operations list
```

Import merges data and overwrites documents with matching IDs; it does not remove extra documents. Account for that behavior in the recovery plan.

## Cloud Storage protection

Firestore backups do not include uploaded files. Verify the default bucket's soft-delete policy and use a 30-day window when it matches the project's privacy and cost requirements:

```sh
gcloud storage buckets describe gs://YOUR_PROJECT_ID.firebasestorage.app
gcloud storage buckets update gs://YOUR_PROJECT_ID.firebasestorage.app --soft-delete-duration=30d
```

For a second copy, schedule a one-way copy to a separate, private bucket owned by the production project or a dedicated backup project. Omit any option that deletes unmatched destination objects:

```sh
gcloud storage rsync --recursive \
  gs://YOUR_PROJECT_ID.firebasestorage.app \
  gs://YOUR_RESTRICTED_STORAGE_BACKUP_BUCKET
```

Test recovery using a disposable path/bucket. Soft delete and object versioning affect cost, and neither replaces a separate backup against project-wide compromise.

## Quarterly restore drill

- Confirm both Firestore schedules exist and recent backups are `READY`.
- Restore one backup to a non-production database/project.
- Validate counts and sample records from every critical collection.
- Dry-run the latest question-bank JSON import.
- Recover one soft-deleted Storage object.
- Run the critical checks in [TESTING.md](./TESTING.md).
- Record recovery time, recovery point, failures, and corrective actions.

Official references: [Firestore scheduled backups](https://cloud.google.com/firestore/docs/backups), [Firestore managed export/import](https://firebase.google.com/docs/firestore/manage-data/export-import), and [Cloud Storage soft delete](https://cloud.google.com/storage/docs/use-soft-delete).
