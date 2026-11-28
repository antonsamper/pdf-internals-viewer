import { ENGINE_LOAD_TIMEOUT_MS } from './limits';

export const ENGINE_LOAD_FAILED = 'The page text engine could not load. Check your connection and search again.';
export const ENGINE_LOAD_SLOW = `The page text engine did not load within ${ENGINE_LOAD_TIMEOUT_MS / 60_000} minutes. Check your connection and search again.`;

/** Settles with `request`, or rejects with `message` after `ms` and calls `onTimeout`. */
export const withTimeout = async <T>(request: PromiseLike<T>, ms: number, message: string, onTimeout: () => void): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          onTimeout();
          reject(new Error(message));
        }, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
