/**
 * The client half of the coverage read: what it accepts, what it caches, and
 * what it refuses to invent when the read fails.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const callable = vi.fn();
vi.mock('firebase/functions', () => ({ httpsCallable: () => callable }));
vi.mock('@/lib/firebase', () => ({
  get isFirebaseConfigured() { return configured; },
  get functions() { return configured ? ({} as unknown) : undefined; },
}));

let configured = true;

const { fetchCoverageSummary, readCachedCoverageSummary } = await import('./coverage-summary-service');

const VALID = {
  generatedAt: '2026-09-01T10:00:00.000Z',
  outOf: { total: 2, mathematics: 1, physics: 1 },
  cells: [
    { id: 'math-cell', subject: 'mathematics', status: 'covered', totalItems: 4, demoItems: 0, publicKeyItems: 0 },
    { id: 'phys-cell', subject: 'physics', status: 'empty', totalItems: 0, demoItems: 0, publicKeyItems: 0 },
  ],
};

beforeEach(() => {
  configured = true;
  callable.mockReset();
  localStorage.clear();
});

describe('reading coverage', () => {
  it('returns a live read and marks it current', async () => {
    callable.mockResolvedValue({ data: VALID });
    const result = await fetchCoverageSummary();
    expect(result.stale).toBe(false);
    expect(result.cells).toHaveLength(2);
    expect(result.summary.outOf.total).toBe(2);
  });

  it('sends no arguments', async () => {
    callable.mockResolvedValue({ data: VALID });
    await fetchCoverageSummary();
    expect(callable).toHaveBeenCalledWith({});
  });

  it('refuses a response carrying a field the contract does not name', async () => {
    callable.mockResolvedValue({
      data: { ...VALID, cells: [{ ...VALID.cells[0], correctAnswer: 'b', reviewer: 'someone@example.test' }, VALID.cells[1]] },
    });
    await expect(fetchCoverageSummary()).rejects.toThrow();
  });

  it('refuses a response with an unknown cell status', async () => {
    callable.mockResolvedValue({ data: { ...VALID, cells: [{ ...VALID.cells[0], status: 'verified' }] } });
    await expect(fetchCoverageSummary()).rejects.toThrow();
  });

  it('fails rather than reporting zeros when the deployment has no coverage service', async () => {
    configured = false;
    await expect(fetchCoverageSummary()).rejects.toThrow();
    expect(callable).not.toHaveBeenCalled();
  });

  it('fails rather than reporting zeros when the call is refused', async () => {
    callable.mockRejectedValue(new Error('permission-denied'));
    await expect(fetchCoverageSummary()).rejects.toThrow();
  });
});

describe('the offline cache', () => {
  it('keeps the last good read', async () => {
    callable.mockResolvedValue({ data: VALID });
    await fetchCoverageSummary();
    expect(readCachedCoverageSummary()?.generatedAt).toBe(VALID.generatedAt);
  });

  it('serves the cache when the live read fails, and says it is stale', async () => {
    callable.mockResolvedValue({ data: VALID });
    await fetchCoverageSummary();
    callable.mockRejectedValue(new Error('offline'));
    const result = await fetchCoverageSummary();
    expect(result.stale).toBe(true);
    expect(result.summary.generatedAt).toBe(VALID.generatedAt);
  });

  it('prefers a live read over the cache', async () => {
    callable.mockResolvedValue({ data: VALID });
    await fetchCoverageSummary();
    const fresher = { ...VALID, generatedAt: '2026-09-02T10:00:00.000Z' };
    callable.mockResolvedValue({ data: fresher });
    const result = await fetchCoverageSummary();
    expect(result.stale).toBe(false);
    expect(result.summary.generatedAt).toBe(fresher.generatedAt);
  });

  it('ignores a cache that no longer matches the contract', async () => {
    localStorage.setItem('csca.coverage-summary.v1', JSON.stringify({ ...VALID, cells: [{ id: 'x' }] }));
    expect(readCachedCoverageSummary()).toBeNull();
    callable.mockRejectedValue(new Error('offline'));
    await expect(fetchCoverageSummary()).rejects.toThrow();
  });

  it('ignores unreadable stored text without throwing', () => {
    localStorage.setItem('csca.coverage-summary.v1', 'not json');
    expect(readCachedCoverageSummary()).toBeNull();
  });
});
