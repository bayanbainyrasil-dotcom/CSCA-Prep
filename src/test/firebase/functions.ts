/**
 * Stand-ins for the `firebase-functions` entry points the trusted backend uses.
 *
 * `onCall` here keeps the options it was given and hands back the handler, so a
 * test can assert what a callable demands (App Check, for one) and then run the
 * real handler against the Firestore double.
 */

export class HttpsError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpsError';
  }
}

export interface CallableRequest<T = unknown> {
  data: T;
  auth?: { uid: string; token: Record<string, unknown> };
  app?: { appId: string };
  rawRequest?: unknown;
}

export interface CallableOptions {
  enforceAppCheck?: boolean;
  consumeAppCheckToken?: boolean;
  cors?: boolean;
  secrets?: unknown[];
  [key: string]: unknown;
}

export interface TestableCallable<T = unknown, R = unknown> {
  (request: CallableRequest<T>): Promise<R>;
  __options: CallableOptions;
  __handler: (request: CallableRequest<T>) => Promise<R>;
}

export function onCall<T, R>(
  optionsOrHandler: CallableOptions | ((request: CallableRequest<T>) => Promise<R>),
  maybeHandler?: (request: CallableRequest<T>) => Promise<R>,
): TestableCallable<T, R> {
  const options = typeof optionsOrHandler === 'function' ? {} : optionsOrHandler;
  const handler = typeof optionsOrHandler === 'function' ? optionsOrHandler : maybeHandler!;
  const callable = ((request: CallableRequest<T>) => handler(request)) as TestableCallable<T, R>;
  callable.__options = options;
  callable.__handler = handler;
  return callable;
}

export function onRequest(options: unknown, handler?: unknown): unknown {
  return handler ?? options;
}

export function setGlobalOptions(): void {
  // Region and instance limits have no meaning in a test double. The real
  // signature takes options; ignoring them here is the whole point.
}

export const logger = {
  info: (): void => undefined,
  warn: (): void => undefined,
  error: (): void => undefined,
  debug: (): void => undefined,
  log: (): void => undefined,
};

export function defineSecret(name: string): { name: string; value: () => string } {
  return { name, value: () => '' };
}

export function defineString(name: string): { name: string; value: () => string } {
  return { name, value: () => '' };
}

export function initializeApp(): Record<string, never> {
  return {};
}

/** Users the auth double has been asked to delete, for assertions. */
export const deletedUserIds: string[] = [];

export function resetAuthDouble(): void {
  deletedUserIds.length = 0;
}

export function getAuth(): {
  setCustomUserClaims: () => Promise<void>;
  deleteUser: (uid: string) => Promise<void>;
  getUser: () => Promise<never>;
  verifyIdToken: () => Promise<never>;
} {
  return {
    setCustomUserClaims: () => Promise.resolve(),
    deleteUser: (uid: string) => {
      deletedUserIds.push(uid);
      return Promise.resolve();
    },
    getUser: () => Promise.reject(new Error('The auth double does not read users.')),
    verifyIdToken: () => Promise.reject(new Error('The auth double does not verify tokens.')),
  };
}
