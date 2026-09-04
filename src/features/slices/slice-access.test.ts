import { describe, expect, it } from 'vitest';
import { sliceAccess, sliceAudience } from './slice-access';
import { SLICE_LESSON_CELL_IDS } from '@/data/teaching-slices';

const KNOWN = Object.values(SLICE_LESSON_CELL_IDS);
const CELL = 'math-linear-isolate-unknown';

describe('who counts as which audience', () => {
  it('treats any demo build as the demo audience, whatever the role', () => {
    expect(sliceAudience({ isDemo: true, role: 'user' })).toBe('demo');
    expect(sliceAudience({ isDemo: true, role: 'admin' })).toBe('demo');
    expect(sliceAudience({ isDemo: true, role: undefined })).toBe('demo');
  });

  it('separates an administrator from a learner on a real deployment', () => {
    expect(sliceAudience({ isDemo: false, role: 'admin' })).toBe('admin');
    expect(sliceAudience({ isDemo: false, role: 'user' })).toBe('learner');
    expect(sliceAudience({ isDemo: false, role: undefined })).toBe('learner');
  });
});

describe('an ordinary learner on a real deployment', () => {
  const access = sliceAccess({ cellId: CELL, knownCellIds: KNOWN, audience: 'learner' });

  it('is refused, because the content has not been reviewed', () => {
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe('awaiting-review');
  });

  it('is told it is coming, not that it is broken or missing', () => {
    expect(access.label).toBe('Coming soon');
    expect(access.note).toMatch(/waiting for a subject-matter review/i);
    expect(access.note).toMatch(/Nothing unreviewed is shown as study material/i);
  });
});

describe('the demo and the administrator preview', () => {
  it('both open, and both say the content is unreviewed', () => {
    for (const audience of ['demo', 'admin'] as const) {
      const access = sliceAccess({ cellId: CELL, knownCellIds: KNOWN, audience });
      expect(access.allowed, audience).toBe(true);
      expect(access.label, audience).toMatch(/[Aa]waiting human review/);
      expect(access.note, audience).toMatch(/no subject-matter reviewer has read it yet|unreviewed content/i);
      expect(access.note, audience).toMatch(/counts? toward no coverage|does not count toward coverage/i);
    }
  });

  it('tells an administrator why they can see it, and that learners cannot', () => {
    const access = sliceAccess({ cellId: CELL, knownCellIds: KNOWN, audience: 'admin' });
    expect(access.reason).toBe('admin-preview');
    expect(access.note).toMatch(/signed in as an administrator/i);
    expect(access.note).toMatch(/hidden from learners/i);
  });

  it('never makes an affirmative claim of verification', () => {
    // A denial is fine and wanted — "it is not verified exam preparation". What
    // must never appear is the positive form.
    const CLAIMS = [
      /\bis verified\b/i,
      /\bverified content\b/i,
      /\breviewer[- ]verified\b/i,
      /\bhas been reviewed\b/i,
      /\bis published\b/i,
      /\brecommended\b/i,
      /\bofficial\b/i,
    ];
    for (const audience of ['demo', 'admin', 'learner'] as const) {
      const access = sliceAccess({ cellId: CELL, knownCellIds: KNOWN, audience });
      const text = `${access.label} ${access.note}`;
      for (const claim of CLAIMS) {
        expect(claim.test(text), `${audience} matched ${String(claim)}`).toBe(false);
      }
    }
  });

  it('says the material is unreviewed in plain words, for every audience', () => {
    for (const audience of ['demo', 'admin', 'learner'] as const) {
      const access = sliceAccess({ cellId: CELL, knownCellIds: KNOWN, audience });
      expect(`${access.label} ${access.note}`, audience).toMatch(/review/i);
    }
  });
});

describe('an unknown cell', () => {
  it('is not found for anyone, including an administrator', () => {
    for (const audience of ['demo', 'admin', 'learner'] as const) {
      const access = sliceAccess({ cellId: 'no-such-cell', knownCellIds: KNOWN, audience });
      expect(access.allowed, audience).toBe(false);
      expect(access.reason, audience).toBe('unknown-cell');
      expect(access.label, audience).toBe('Not found');
    }
  });

  it('recognises exactly the authored slices and nothing else', () => {
    expect([...KNOWN].sort()).toEqual([
      'math-foundation-estimate-magnitude',
      'math-foundation-fraction-decimal-percent',
      'math-foundation-integer-operations',
      'math-linear-isolate-unknown',
      'math-linear-linear-word-problem',
      'math-linear-multi-step-linear',
      'phys-thermodynamics-heat-transfer',
      'phys-units-si-base-derived',
      'phys-units-unit-conversion-si',
    ]);
    expect(sliceAccess({ cellId: 'phys-thermodynamics-heat-transfer', knownCellIds: KNOWN, audience: 'demo' }).allowed).toBe(true);
    expect(sliceAccess({ cellId: '', knownCellIds: KNOWN, audience: 'demo' }).allowed).toBe(false);
  });
});

describe('every allowed answer carries a label to render', () => {
  it('never returns an empty label or note', () => {
    for (const cellId of [...KNOWN, 'unknown']) {
      for (const audience of ['demo', 'admin', 'learner'] as const) {
        const access = sliceAccess({ cellId, knownCellIds: KNOWN, audience });
        expect(access.label.length, `${cellId}/${audience}`).toBeGreaterThan(0);
        expect(access.note.length, `${cellId}/${audience}`).toBeGreaterThan(20);
      }
    }
  });
});
