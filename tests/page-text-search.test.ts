import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { searchPageText } from '../src/lib/pdf/page-text-search';

const engine = vi.hoisted(() => {
  return {
    destroy: vi.fn(async () => {
      return undefined;
    }),
    open: vi.fn(),
  };
});
vi.mock('@embedpdf/engine', () => {
  return {
    localEngine: () => {
      return engine;
    },
  };
});

const never = () => {
  return new Promise<never>(() => {
    return undefined;
  });
};
const blank = {
  close: async () => {
    return undefined;
  },
};
const search = (signal = new AbortController().signal) => {
  return searchPageText(new Uint8Array([1]), 'term', undefined, signal);
};

describe('page text search time limits', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    engine.open.mockReset();
    engine.destroy.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('waits for a slow engine load without starting the search limit', async () => {
    let loaded!: (value: typeof blank) => void;
    engine.open
      .mockReturnValueOnce(
        new Promise((done) => {
          return (loaded = done);
        })
      )
      .mockReturnValueOnce(never());
    const result = search();
    const settled = vi.fn();
    result.catch(settled);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(settled).not.toHaveBeenCalled();
    loaded(blank);
    const timedOut = expect(result).rejects.toThrow('Page text search exceeded 15 seconds. Try a smaller PDF or another search mode.');
    await vi.advanceTimersByTimeAsync(15_000);
    await timedOut;
    expect(engine.destroy).toHaveBeenCalled();
  });
  it('blames the engine when it does not load within 2 minutes', async () => {
    engine.open.mockReturnValueOnce(never());
    const result = expect(search()).rejects.toThrow(
      'The page text engine did not load within 2 minutes. Check your connection and search again.'
    );
    await vi.advanceTimersByTimeAsync(120_000);
    await result;
    expect(engine.open).toHaveBeenCalledTimes(1);
  });
  it('blames the engine when it fails to load', async () => {
    engine.open.mockReturnValueOnce(Promise.reject(new Error('engine failed to boot')));
    await expect(search()).rejects.toThrow('The page text engine could not load. Check your connection and search again.');
    expect(engine.open).toHaveBeenCalledTimes(1);
  });
  it('reports a cancellation during the engine load as a cancellation', async () => {
    const controller = new AbortController();
    engine.open.mockReturnValueOnce(
      new Promise((_, reject) => {
        return controller.signal.addEventListener('abort', () => {
          return reject(new Error('engine destroyed'));
        });
      })
    );
    const result = search(controller.signal);
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(engine.destroy).toHaveBeenCalled();
  });
});
