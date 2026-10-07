import { AUTH_ERROR_MESSAGES } from './errors.ts';

/** Bounds the caller's wait only; the wrapped operation is not cancelled and may still complete later. */
export const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(AUTH_ERROR_MESSAGES.unknown, { cause: error }));
      },
    );
  });
