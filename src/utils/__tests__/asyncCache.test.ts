/**
 * The caching layer that fixed "every tab takes seconds to open".
 *
 * The defect these pin: `getAllLounges` fetched all 8,294 lounge documents
 * (~6.8 MB) on every call, and nine call sites across five tabs called it. The
 * properties below are each one half of that fix, and each corresponds to a
 * way the naive version failed.
 */

import { createAsyncCache, createKeyedAsyncCache, memoizeOnIdentity } from '../asyncCache';

/** A load function that counts its calls and resolves when told to. */
function deferredLoader<T>(value: T) {
  let calls = 0;
  const resolvers: Array<(v: T) => void> = [];
  return {
    load: () => {
      calls += 1;
      return new Promise<T>(resolve => resolvers.push(resolve));
    },
    settleAll: () => resolvers.splice(0).forEach(resolve => resolve(value)),
    get calls() {
      return calls;
    },
  };
}

describe('createAsyncCache', () => {
  it('fetches once and serves the cached value afterwards', async () => {
    let calls = 0;
    const cache = createAsyncCache(async () => ++calls, 1000, () => 0);
    await cache.get();
    await cache.get();
    await cache.get();
    expect(calls).toBe(1);
  });

  it('shares one request between callers that all miss at once', async () => {
    // This is the property a plain TTL cache does not have, and it is the one
    // SearchScreen needed: its focus effect calls four loaders that each
    // wanted the whole collection, all starting before any resolved. Without
    // de-duplication every one of them missed and opening the Search tab was
    // four full-collection downloads.
    const loader = deferredLoader(['lounge']);
    const cache = createAsyncCache(loader.load, 1000, () => 0);

    const inFlight = [cache.get(), cache.get(), cache.get(), cache.get()];
    expect(loader.calls).toBe(1);

    loader.settleAll();
    const results = await Promise.all(inFlight);
    expect(loader.calls).toBe(1);
    results.forEach(result => expect(result).toEqual(['lounge']));
  });

  it('refetches once the TTL has passed', async () => {
    let now = 0;
    let calls = 0;
    const cache = createAsyncCache(async () => ++calls, 1000, () => now);
    await cache.get();
    now = 999;
    await cache.get();
    expect(calls).toBe(1);
    now = 1001;
    await cache.get();
    expect(calls).toBe(2);
  });

  it('does not cache a failure', async () => {
    // A cached rejection would turn one dropped request into a dead screen
    // for the whole TTL, with a retry button that could not work.
    let calls = 0;
    const cache = createAsyncCache(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('offline');
      }
      return 'recovered';
    }, 1000, () => 0);

    await expect(cache.get()).rejects.toThrow('offline');
    await expect(cache.get()).resolves.toBe('recovered');
    expect(calls).toBe(2);
  });

  it('rejects every caller sharing a failed in-flight request', async () => {
    const cache = createAsyncCache(async () => {
      throw new Error('offline');
    }, 1000, () => 0);
    const [a, b] = [cache.get(), cache.get()];
    await expect(a).rejects.toThrow('offline');
    await expect(b).rejects.toThrow('offline');
  });

  it('refetches after invalidate, for pull-to-refresh', async () => {
    let calls = 0;
    const cache = createAsyncCache(async () => ++calls, 10_000, () => 0);
    await cache.get();
    cache.invalidate();
    await cache.get();
    expect(calls).toBe(2);
  });

  it('reports freshness and peeks without loading', async () => {
    let now = 0;
    const cache = createAsyncCache(async () => 'value', 1000, () => now);
    expect(cache.isFresh()).toBe(false);
    expect(cache.peek()).toBeNull();
    await cache.get();
    expect(cache.isFresh()).toBe(true);
    expect(cache.peek()).toBe('value');
    now = 2000;
    expect(cache.isFresh()).toBe(false);
    expect(cache.peek()).toBeNull();
  });
});

describe('createKeyedAsyncCache', () => {
  it('caches per key and de-duplicates per key', async () => {
    const calls: string[] = [];
    const cache = createKeyedAsyncCache(async (key: string) => {
      calls.push(key);
      return key.toUpperCase();
    }, 1000, 12, () => 0);

    await Promise.all([cache.get('austin'), cache.get('austin'), cache.get('dallas')]);
    await cache.get('austin');
    expect(calls).toEqual(['austin', 'dallas']);
  });

  it('evicts the oldest key rather than growing without bound', async () => {
    // A long panning session on the Map would otherwise accumulate a full
    // result set per viewport, each one hundreds of lounge documents.
    const cache = createKeyedAsyncCache(async (key: string) => key, 10_000, 3, () => 0);
    for (const key of ['a', 'b', 'c', 'd', 'e']) {
      await cache.get(key);
    }
    expect(cache.size()).toBe(3);
  });

  it('invalidate clears every key', async () => {
    let calls = 0;
    const cache = createKeyedAsyncCache(async () => ++calls, 10_000, 12, () => 0);
    await cache.get('k');
    cache.invalidate();
    await cache.get('k');
    expect(calls).toBe(2);
  });
});

describe('memoizeOnIdentity', () => {
  it('recomputes only when the input reference changes', () => {
    let runs = 0;
    const derive = memoizeOnIdentity((items: number[]) => {
      runs += 1;
      return items.length;
    });
    const stable = [1, 2, 3];
    expect(derive(stable)).toBe(3);
    expect(derive(stable)).toBe(3);
    expect(runs).toBe(1);
    expect(derive([1, 2])).toBe(2);
    expect(runs).toBe(2);
  });

  it('caches a falsy result rather than recomputing it', () => {
    // Guarding on `lastOutput` instead of an explicit primed flag would make
    // 0, '' and null miss the cache forever — exactly the values a
    // count-style derivation returns when there is no data.
    let runs = 0;
    const derive = memoizeOnIdentity(() => {
      runs += 1;
      return 0;
    });
    const input: number[] = [];
    derive(input);
    derive(input);
    expect(runs).toBe(1);
  });
});
