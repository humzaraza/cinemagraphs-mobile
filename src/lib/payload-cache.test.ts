import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as cache from './payload-cache';
import { PAYLOAD_TTL_MS } from './payload-cache';

// A deferred promise whose resolve/reject we control, so background refreshes
// can be settled deterministically inside a test.
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Flush the microtask queue so a settled background fetch's continuation
// (the cache write inside runDeduped) runs before we assert. Works under fake
// timers, which mock timers and Date but not the microtask queue.
async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('payload-cache', () => {
  beforeEach(() => {
    cache.clearPayloadCache();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes a 2 minute TTL constant', () => {
    expect(PAYLOAD_TTL_MS).toBe(120000);
  });

  it('get returns undefined when cold and the value after set', () => {
    expect(cache.get('k')).toBeUndefined();
    cache.set('k', { a: 1 });
    expect(cache.get<{ a: number }>('k')).toEqual({ a: 1 });
  });

  it('fetches and caches on a cold key', async () => {
    const fetcher = vi.fn().mockResolvedValue('v1');
    const v = await cache.getWithRevalidate('k', fetcher, 1000);
    expect(v).toBe('v1');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.get('k')).toBe('v1');
  });

  it('serves a fresh cached value without fetching', async () => {
    cache.set('k', 'cached');
    const fetcher = vi.fn().mockResolvedValue('new');
    const v = await cache.getWithRevalidate('k', fetcher, 100000);
    expect(v).toBe('cached');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('dedupes concurrent cold fetches into a single network call', async () => {
    const d = deferred<string>();
    const fetcher = vi.fn(() => d.promise);
    const p1 = cache.getWithRevalidate('k', fetcher, 1000);
    const p2 = cache.getWithRevalidate('k', fetcher, 1000);
    d.resolve('v');
    expect(await p1).toBe('v');
    expect(await p2).toBe('v');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects on a cold fetch error with nothing to fall back to', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(cache.getWithRevalidate('k', fetcher, 1000)).rejects.toThrow('boom');
    expect(cache.get('k')).toBeUndefined();
  });

  it('serves a stale value immediately and refreshes the cache in the background', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    cache.set('k', 'old');
    vi.setSystemTime(1_000_000 + 200); // age past ttl below
    const d = deferred<string>();
    const fetcher = vi.fn(() => d.promise);

    const v = await cache.getWithRevalidate('k', fetcher, 100);
    expect(v).toBe('old'); // stale value returned right away
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.get('k')).toBe('old'); // not refreshed yet

    d.resolve('fresh');
    await flush();
    expect(cache.get('k')).toBe('fresh'); // background refresh updated the cache
  });

  it('keeps the cached value when a background refresh fails (no throw)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    cache.set('k', 'old');
    vi.setSystemTime(1_000_000 + 5000);
    const fetcher = vi.fn().mockRejectedValue(new Error('net'));

    const v = await cache.getWithRevalidate('k', fetcher, 100);
    expect(v).toBe('old');
    await flush();
    expect(cache.get('k')).toBe('old'); // unchanged, error swallowed
  });

  it('discards a background refresh that resolves after an explicit set (generation guard)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    cache.set('k', 'old');
    vi.setSystemTime(1_000_000 + 5000);
    const d = deferred<string>();
    const fetcher = vi.fn(() => d.promise);

    const v = await cache.getWithRevalidate('k', fetcher, 100); // stale -> bg refresh in flight
    expect(v).toBe('old');

    // An authoritative mutation seeds a newer value while the refresh is in flight.
    cache.set('k', 'mutated');
    expect(cache.get('k')).toBe('mutated');

    // The background fetch resolves with the pre-mutation snapshot; it must not
    // clobber the newer value.
    d.resolve('stale-bg');
    await flush();
    expect(cache.get('k')).toBe('mutated');
  });

  it('drops an in-flight result and the entry when invalidate runs mid-fetch', async () => {
    const d = deferred<string>();
    const fetcher = vi.fn(() => d.promise);
    const p = cache.getWithRevalidate('k', fetcher, 1000); // cold, in flight

    cache.invalidate('k');
    d.resolve('v');
    expect(await p).toBe('v'); // caller still gets the value
    await flush();
    expect(cache.get('k')).toBeUndefined(); // but it was not written back
  });

  it('clearPayloadCache stops an in-flight fetch from repopulating the cache', async () => {
    const d = deferred<string>();
    const fetcher = vi.fn(() => d.promise);
    const p = cache.getWithRevalidate('profile:me', fetcher, 1000); // cold, in flight

    cache.clearPayloadCache(); // e.g. sign-out before the fetch resolves
    d.resolve('userA-profile');
    expect(await p).toBe('userA-profile'); // caller still gets its value

    await flush();
    // The previous user's payload must NOT land back in the cleared store, or
    // the next user could be served it.
    expect(cache.get('profile:me')).toBeUndefined();
  });

  it('treats a value younger than the TTL as fresh and an older one as stale', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    cache.set('k', 'v0');

    // Just under the TTL: fresh, no fetch.
    vi.setSystemTime(PAYLOAD_TTL_MS - 1);
    const fresh = vi.fn().mockResolvedValue('vNew');
    expect(await cache.getWithRevalidate('k', fresh, PAYLOAD_TTL_MS)).toBe('v0');
    expect(fresh).not.toHaveBeenCalled();

    // At the TTL boundary: stale, triggers a background refresh.
    vi.setSystemTime(PAYLOAD_TTL_MS);
    const d = deferred<string>();
    const stale = vi.fn(() => d.promise);
    expect(await cache.getWithRevalidate('k', stale, PAYLOAD_TTL_MS)).toBe('v0');
    expect(stale).toHaveBeenCalledTimes(1);
    d.resolve('vNew');
    await flush();
    expect(cache.get('k')).toBe('vNew');
  });
});
