/**
 * Small async caching primitives.
 *
 * These exist because of one measured defect. `loungeService.getAllLounges`
 * fetched the whole `lounges` collection on every call, and the collection
 * grew from the "few dozen lounges" its comment assumed to **8,294 documents
 * (~6.8 MB)** once the Yelp + Google Places import ran. Home, Map, Search,
 * Trip Planner, both Concierge screens, the name-lookup hook and
 * passportService all called it, so every tab switch re-downloaded the lot.
 *
 * SearchScreen was worse than one fetch: its focus effect calls
 * getPopularDestinations, getTrendingCities, getFeaturedCityGuide and
 * getDistinctCities, each of which independently re-fetched everything —
 * and getTrendingCities calls getPopularDestinations too. One tap on Search
 * was five full-collection downloads.
 *
 * Two properties matter here and both are load-bearing:
 *
 * 1. **In-flight de-duplication.** Concurrent callers must share one
 *    request. A plain TTL cache does not fix SearchScreen, because all five
 *    of its calls start before any of them resolve, so all five miss.
 * 2. **Failures are never cached.** A cached rejection would turn one
 *    dropped request into a dead screen until the TTL expired.
 */

type Clock = () => number;

export type AsyncCache<T> = {
  /** Cached value if fresh, the in-flight request if one is running, else a new one. */
  get(): Promise<T>;
  /** Drops the cached value so the next `get()` refetches. For pull-to-refresh. */
  invalidate(): void;
  /** Whether a `get()` right now would resolve without a network call. */
  isFresh(): boolean;
  /** The cached value without triggering a load, or null. For internal derivations. */
  peek(): T | null;
};

export function createAsyncCache<T>(
  load: () => Promise<T>,
  ttlMs: number,
  clock: Clock = Date.now,
): AsyncCache<T> {
  let entry: { data: T; at: number } | null = null;
  let inFlight: Promise<T> | null = null;

  const fresh = () => entry !== null && clock() - entry.at < ttlMs;

  return {
    get() {
      if (entry && fresh()) {
        return Promise.resolve(entry.data);
      }
      if (inFlight) {
        return inFlight;
      }
      inFlight = load().then(
        data => {
          entry = { data, at: clock() };
          inFlight = null;
          return data;
        },
        error => {
          // Deliberately not cached — see note 2 above.
          inFlight = null;
          throw error;
        },
      );
      return inFlight;
    },
    invalidate() {
      entry = null;
    },
    isFresh: fresh,
    peek() {
      return entry && fresh() ? entry.data : null;
    },
  };
}

/**
 * The same thing, per key, for queries that take arguments — the nearby
 * lounge query, whose key is a coarsened map centre.
 *
 * `maxEntries` keeps a long panning session from growing without bound; the
 * oldest key is evicted first (insertion-ordered Map).
 */
export function createKeyedAsyncCache<T>(
  load: (key: string) => Promise<T>,
  ttlMs: number,
  maxEntries = 12,
  clock: Clock = Date.now,
): {
  get(key: string): Promise<T>;
  invalidate(): void;
  size(): number;
} {
  const caches = new Map<string, AsyncCache<T>>();

  return {
    get(key: string) {
      let cache = caches.get(key);
      if (!cache) {
        cache = createAsyncCache(() => load(key), ttlMs, clock);
        caches.set(key, cache);
        while (caches.size > maxEntries) {
          const oldest = caches.keys().next();
          if (oldest.done) {
            break;
          }
          caches.delete(oldest.value);
        }
      }
      return cache.get();
    },
    invalidate() {
      caches.clear();
    },
    size() {
      return caches.size;
    },
  };
}

/**
 * Memoizes a derivation against the *identity* of its input.
 *
 * The city-highlight aggregation walks all 8,294 lounges to group them by
 * city, and four SearchScreen loaders ask for it on every focus. Once the
 * underlying fetch is cached its array is reference-stable, so keying on
 * that reference collapses those four walks into one.
 */
export function memoizeOnIdentity<I, O>(derive: (input: I) => O): (input: I) => O {
  let lastInput: I | null = null;
  let lastOutput: O | null = null;
  let primed = false;

  return (input: I): O => {
    if (primed && input === lastInput) {
      return lastOutput as O;
    }
    const output = derive(input);
    lastInput = input;
    lastOutput = output;
    primed = true;
    return output;
  };
}
