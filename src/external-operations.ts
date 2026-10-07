/**
 * Ceiling for clients whose operations never settle. `oidc-client-ts` bounds its own silent
 * renewal, so this only protects custom factories from suppressing provider events forever.
 */
const MAX_PENDING_LIFETIME_MS = 60_000;

const pendingByManager = new WeakMap<object, Set<symbol>>();

/**
 * Marks an operation started outside the provider (the off-component getter) as pending on a
 * manager until it settles, even after the caller stopped waiting.
 */
export const runExternalOperation = <T>(manager: object, operation: () => Promise<T>): Promise<T> => {
  const pending = pendingByManager.get(manager) ?? new Set<symbol>();
  pendingByManager.set(manager, pending);
  const token = Symbol('external-operation');
  pending.add(token);

  const forget = (): void => {
    pending.delete(token);
  };
  const timer = setTimeout(forget, MAX_PENDING_LIFETIME_MS);
  const settle = (): void => {
    clearTimeout(timer);
    forget();
  };

  const started = new Promise<T>((resolve) => {
    resolve(operation());
  });
  started.then(settle, settle);
  return started;
};

export const isExternalOperationPending = (manager: object): boolean => (pendingByManager.get(manager)?.size ?? 0) > 0;
