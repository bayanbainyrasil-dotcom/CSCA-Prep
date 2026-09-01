import { describe, expect, it } from 'vitest';
import rawRules from '../../../firestore.rules?raw';
import { normalizeLineEndings } from './normalize-line-endings';

const rules = normalizeLineEndings(rawRules);

const CONTRACT_FRAGMENTS = {
  'keeps mock attempts out of the generic mutable create path': [
    "collectionId != 'examAttempts'",
    "collectionId == 'examAttempts'\n              && validClientExamDraftCreate(uid, documentId)",
  ],
  'allows client drafts only without trusted submission or result data': [
    "payload.status in ['in-progress', 'abandoned']",
    'payload.submittedAt == null',
    'payload.result == null',
    "data.entityType == 'mock-attempt'",
  ],
  'accepts nested answers only while the parent is in progress': [
    "get(path).data.payload.status == 'in-progress'",
    "data.entityType == 'mock-answer'",
    'validClientExamAnswer(uid, answerId)',
  ],
  'makes server-authoritative attempts read-only to the browser': [
    "('questionIds' in resource.data.payload)",
    "('durationSeconds' in resource.data.payload)",
    '&& !serverOwnedExamAttempt()',
    "!('questionIds' in get(path).data.payload)",
    "!('durationSeconds' in get(path).data.payload)",
  ],
  'syncs the study plan through the same versioned envelope as other progress': [
    "'studyPlans',",
  ],
  'keeps the blueprint and its verification server-owned': [
    "match /blueprintCells/{cellId} {\n      allow read: if signedIn();\n      allow write: if false;",
    "'verificationStatus', 'reviewer', 'reviewedAt'",
  ],
  'lets a mock be published only through the gated callable': [
    "match /examTemplates/{examTemplateId} {",
    "allow write: if false;",
  ],
  'keeps private solutions unreadable from any client': [
    'match /questionSolutions/{questionId} {\n      allow read: if isAdmin();\n      allow write: if false;',
  ],
} as const;

describe('mock exam Firestore source contract', () => {
  for (const [title, fragments] of Object.entries(CONTRACT_FRAGMENTS)) {
    it(title, () => {
      for (const fragment of fragments) {
        expect(rules).toContain(fragment);
      }
    });
  }

  it('holds on a CRLF checkout of the same rules source', () => {
    const crlfRules = normalizeLineEndings(rules.replace(/\n/g, '\r\n'));

    for (const fragments of Object.values(CONTRACT_FRAGMENTS)) {
      for (const fragment of fragments) {
        expect(crlfRules).toContain(fragment);
      }
    }
  });
});
