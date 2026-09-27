export const isBrowserRuntime = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const storage = window.sessionStorage;
    return Boolean(storage);
  } catch {
    return false;
  }
};

export const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeoutId);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
