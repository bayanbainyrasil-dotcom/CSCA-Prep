import { describe, expect, it } from 'vitest';
import rules from '../../../firestore.rules?raw';

describe('mock exam Firestore source contract', () => {
  it('keeps mock attempts out of the generic mutable create path', () => {
    expect(rules).toContain("collectionId != 'examAttempts'");
    expect(rules).toContain("collectionId == 'examAttempts'\n              && validClientExamDraftCreate(uid, documentId)");
  });

  it('allows client drafts only without trusted submission or result data', () => {
    expect(rules).toContain("payload.status in ['in-progress', 'abandoned']");
    expect(rules).toContain('payload.submittedAt == null');
    expect(rules).toContain('payload.result == null');
    expect(rules).toContain("data.entityType == 'mock-attempt'");
  });

  it('accepts nested answers only while the parent is in progress', () => {
    expect(rules).toContain("get(path).data.payload.status == 'in-progress'");
    expect(rules).toContain("data.entityType == 'mock-answer'");
    expect(rules).toContain('validClientExamAnswer(uid, answerId)');
  });
});
