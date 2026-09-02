import { beforeEach, describe, expect, it } from 'vitest';
import { exportQuestionBank, importBlueprintDraft, importPublicQuestionSeed } from '../../../functions/src/index';
import { DRAFT_QUESTION_SEED } from '../../../functions/src/public-question-seed';
import { BLUEPRINT_SEED_VERSION, PUBLIC_SEED_VERSION } from '../../../functions/src/seed-versions';
import { resetFirestore } from '@/test/firebase/firestore';
import type { CallableRequest, TestableCallable } from '@/test/firebase/functions';

/**
 * What the reviewer actually sees. `exportQuestionBank` is the callable behind
 * the review queue, so this asserts the queue itself, not a re-description of it.
 */

const ADMIN = { uid: 'admin-1', token: { admin: true } };

function call<R>(callable: unknown, data: Record<string, unknown>): Promise<R> {
  return (callable as TestableCallable<Record<string, unknown>, R>).__handler({
    data,
    auth: ADMIN,
  } as CallableRequest<Record<string, unknown>>);
}

interface QueueItem {
  id: string;
  expectedVersion: number;
  question: Record<string, unknown> | null;
}

beforeEach(resetFirestore);

describe('the review queue after an import', () => {
  beforeEach(async () => {
    await call(importBlueprintDraft, { batchId: 'b', seedVersion: BLUEPRINT_SEED_VERSION, dryRun: false });
    await call(importPublicQuestionSeed, { batchId: 'q', seedVersion: PUBLIC_SEED_VERSION, dryRun: false });
  });

  it('offers every imported question for review, none of them approved', async () => {
    const response = await call<{ items: QueueItem[] }>(exportQuestionBank, { pageSize: 100 });

    expect(response.items).toHaveLength(DRAFT_QUESTION_SEED.length);
    for (const item of response.items) {
      expect(item.question, item.id).not.toBeNull();
      expect(item.question?.verificationStatus, item.id).toBe('pending-review');
      expect(item.question?.reviewer, item.id).toBeNull();
      expect(item.question?.reviewedAt, item.id).toBeNull();
    }
  });

  it('hands the reviewer the key and the solution they need to judge the item', async () => {
    const response = await call<{ items: QueueItem[] }>(exportQuestionBank, { pageSize: 100 });

    for (const item of response.items) {
      expect(item.question, item.id).toHaveProperty('correctAnswer');
      expect(item.question, item.id).toHaveProperty('solution');
      // And the version the reviewer is approving, so a later edit cannot inherit it.
      expect(typeof item.expectedVersion, item.id).toBe('number');
    }
  });

  it('is empty before anything is imported', async () => {
    resetFirestore();
    const response = await call<{ items: QueueItem[] }>(exportQuestionBank, { pageSize: 100 });
    expect(response.items).toHaveLength(0);
  });
});
