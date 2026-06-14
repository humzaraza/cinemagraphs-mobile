/**
 * payload-cache: a tiny in-memory, session-lived cache for screen
 * payloads (film detail, reviews, profile data, category first page).
 *
 * Why this exists: screens fetch into local component state, so re-opening
 * a screen (re-mount on navigation, or focus refetch) shows a skeleton or
 * a blank-then-fill flash even when the data was loaded moments ago. This
 * cache keeps the last fetched payload per key in a plain Map for the life
 * of the JS session. It dies when the app is killed, which is the correct
 * lifetime: no persistence, so no stale data survives a relaunch.
 *
 * Deliberately NOT a global store and NOT react-query. It does not trigger
 * re-renders on its own. Callers read get(key) synchronously for an
 * instant paint (e.g. in a useState initializer) and drive revalidation
 * through getWithRevalidate. The working set (a few films, the profile, a
 * handful of categories) is small, so there is no eviction beyond the
 * TTL-driven background refresh.
 */

// Default freshness window: 2 minutes. Within this window a re-open serves
// the cached payload with no network call; past it, the cache is served
// once more and refreshed in the background for the next open.
export const PAYLOAD_TTL_MS = 120000;

interface CacheEntry<T> {
  value: T;
  // Epoch milliseconds when the value was stored. Used to decide staleness.
  storedAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
// Per-key write generation. Bumped by every explicit set() and invalidate()
// so a slow background refresh that started earlier can notice the cache has
// moved on (a mutation seeded an authoritative value, or a forced refresh
// wrote a newer payload) and decline to overwrite it with its stale result.
const generation = new Map<string, number>();

function bumpGeneration(key: string): void {
  generation.set(key, (generation.get(key) ?? 0) + 1);
}

/**
 * Read a cached payload synchronously. Returns undefined when nothing is
 * cached for the key. Never returns null on its own (callers decide how to
 * treat a stored null), so an undefined result reliably means "cold".
 */
export function get<T>(key: string): T | undefined {
  const entry = store.get(key);
  return entry ? (entry.value as T) : undefined;
}

/**
 * Store a payload, stamping it with the current time. Use this to seed the
 * cache from an authoritative result (e.g. a mutation response or a forced
 * refresh) so a later getWithRevalidate treats it as fresh.
 */
export function set<T>(key: string, value: T): void {
  store.set(key, { value, storedAt: Date.now() });
  bumpGeneration(key);
}

/**
 * Drop a single entry (and any in-flight fetch) for a key. Call this after
 * a mutation invalidates a cached payload so the next read refetches.
 */
export function invalidate(key: string): void {
  store.delete(key);
  inFlight.delete(key);
  bumpGeneration(key);
}

/**
 * Drop everything. Intended for sign-out so the next user starts clean.
 */
export function clearPayloadCache(): void {
  store.clear();
  inFlight.clear();
}

/**
 * Run fetcher at most once per key while a call is in flight: concurrent
 * callers share the same promise (request de-dup). On success the result
 * is stored. On failure the error propagates and the cache is left as-is.
 */
function runDeduped<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  // Snapshot the generation at fetch start. If an explicit set() or
  // invalidate() bumps it while this fetch is in flight, the result is stale
  // on arrival and must not clobber the newer state. The value is still
  // returned to the caller; only the cache write is skipped. The success
  // write goes straight to the store (not through set()) so it does not bump
  // the generation itself.
  const startGeneration = generation.get(key) ?? 0;
  const pending = (async () => {
    try {
      const value = await fetcher();
      if ((generation.get(key) ?? 0) === startGeneration) {
        store.set(key, { value, storedAt: Date.now() });
      }
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, pending);
  return pending;
}

/**
 * Stale-while-revalidate read.
 *
 * - Fresh cache (younger than ttlMs): resolves with the cached value and
 *   makes no network call.
 * - Stale cache (older than ttlMs): resolves with the cached value
 *   immediately and refreshes the cache in the background (deduped) so the
 *   next open is fresh. A background failure keeps the cached value and is
 *   swallowed, never thrown to the caller.
 * - No cache: awaits the fetcher and resolves with the fresh value. Here a
 *   failure has nothing to fall back to, so the promise rejects and the
 *   caller can show an error state.
 *
 * Concurrent calls for the same key share a single in-flight fetch.
 */
export async function getWithRevalidate<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
): Promise<T> {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (entry) {
    const isStale = Date.now() - entry.storedAt >= ttlMs;
    if (isStale) {
      // Refresh for next time; keep serving what we have right now.
      runDeduped(key, fetcher).catch(() => {
        // Keep the existing cached value on failure.
      });
    }
    return entry.value;
  }
  // Cold: nothing to serve, so wait for the network and surface errors.
  return runDeduped(key, fetcher);
}
