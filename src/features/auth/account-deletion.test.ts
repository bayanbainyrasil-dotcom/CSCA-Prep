import { describe, expect, it } from 'vitest';
import { DeleteMyAccountSchema, ResetMyProgressSchema } from '../../../functions/src/schemas';
import indexSource from '../../../functions/src/index.ts?raw';
import settingsSource from '../../pages/settings-page.tsx?raw';
import authSource from './auth-provider.tsx?raw';

/**
 * Account deletion is the one irreversible thing a learner can do to their own
 * data, so what guards it is asserted rather than described.
 */

describe('the deletion request', () => {
  it('requires the word typed out, and nothing else', () => {
    expect(DeleteMyAccountSchema.safeParse({ confirmation: 'DELETE' }).success).toBe(true);
    expect(DeleteMyAccountSchema.safeParse({}).success).toBe(false);
    expect(DeleteMyAccountSchema.safeParse({ confirmation: 'delete' }).success).toBe(false);
    expect(DeleteMyAccountSchema.safeParse({ confirmation: 'RESET' }).success).toBe(false);
  });

  it('cannot name another account, or claim it was recently authenticated', () => {
    for (const forged of [
      { uid: 'someone-else' },
      { email: 'victim@example.test' },
      { auth_time: 9_999_999_999 },
      { reauthenticated: true },
      { skipReauthentication: true },
    ]) {
      expect(DeleteMyAccountSchema.safeParse({ confirmation: 'DELETE', ...forged }).success, JSON.stringify(forged)).toBe(false);
    }
  });

  it('is a different word from the reset it must not be confused with', () => {
    expect(ResetMyProgressSchema.safeParse({ confirmation: 'DELETE' }).success).toBe(false);
    expect(DeleteMyAccountSchema.safeParse({ confirmation: 'RESET' }).success).toBe(false);
  });
});

describe('the server guard', () => {
  const callable = indexSource.slice(indexSource.indexOf('export const deleteMyAccount'));

  it('reads the sign-in time from the verified token, not from the request', () => {
    expect(callable).toContain('principal.token.auth_time');
    expect(callable).toContain('REAUTHENTICATION_WINDOW_SECONDS');
    expect(callable).toContain('reauthentication-required');
    // The window is short enough that a session left open cannot be used.
    expect(indexSource).toContain('const REAUTHENTICATION_WINDOW_SECONDS = 5 * 60;');
  });

  it('acts on the caller’s own uid only', () => {
    expect(callable).toContain('db.collection("users").doc(principal.uid)');
    expect(callable).toContain('auth.deleteUser(principal.uid)');
    expect(callable).not.toMatch(/deleteUser\((?!principal\.uid)/);
  });

  it('removes the sign-in last, so a failure leaves an account that can retry', () => {
    expect(callable.indexOf('recursiveDelete(userRef)')).toBeLessThan(callable.indexOf('auth.deleteUser'));
    expect(callable.indexOf('getFiles')).toBeLessThan(callable.indexOf('auth.deleteUser'));
  });

  it('enforces App Check and rate-limits the attempt', () => {
    expect(callable).toContain('sensitiveCallableOptions');
    expect(callable).toContain('enforceRateLimit("deleteMyAccount"');
  });

  it('records counts only, never anything the learner wrote', () => {
    const audit = callable.slice(callable.indexOf('auditWithoutBreakingRequest'));
    expect(audit).toContain('collections: USER_PROGRESS_COLLECTIONS.length');
    expect(audit).toContain('filesDeleted');
    expect(audit).not.toContain('email');
    expect(audit).not.toContain('name');
  });
});

describe('the client flow', () => {
  it('re-proves the sign-in before it calls the server', () => {
    const flow = settingsSource.slice(settingsSource.indexOf('const deleteAccount'));
    expect(flow.indexOf('await reauthenticate()')).toBeLessThan(flow.indexOf("'deleteMyAccount'"));
  });

  it('will not call the server until the word is typed exactly', () => {
    expect(settingsSource).toContain("deleteConfirmation !== 'DELETE'");
    expect(settingsSource).toContain("disabled={deleting !== null || deleteConfirmation !== 'DELETE'}");
  });

  it('clears the device after the server has confirmed, not before', () => {
    const flow = settingsSource.slice(settingsSource.indexOf('const deleteAccount'));
    expect(flow.indexOf("'deleteMyAccount'")).toBeLessThan(flow.indexOf('clearLocalUserData'));
    expect(flow.indexOf('clearLocalUserData')).toBeLessThan(flow.indexOf('localStorage.clear()'));
  });

  it('is not offered in on-device mode, where there is no account to delete', () => {
    expect(settingsSource).toContain('{isDemo ? null : <Button variant="danger" onClick={() => { setDeleteConfirmation(\'\'); setDeleteOpen(true); }}>');
  });

  it('re-authenticates the current user rather than signing a new one in', () => {
    expect(authSource).toContain('reauthenticateWithPopup');
    expect(authSource).toContain('current.getIdToken(true)');
  });
});
