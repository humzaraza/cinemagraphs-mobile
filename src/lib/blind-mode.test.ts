import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import {
  getBlindModeState,
  resolveBlindForFilm,
  setBlindForFilm,
  setBlindModeDefaults,
  markTooltipSeen,
  clearBlindModeCache,
  __setCachedStateForTesting,
  type BlindModeState,
} from './blind-mode';

const fullState: BlindModeState = {
  blindUnwatchedDefault: true,
  perFilm: { 'film-1': false, 'film-2': true },
  hasSeenBlindModeTooltip: true,
};

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  clearBlindModeCache();
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearBlindModeCache();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('getBlindModeState', () => {
  it('fetches from /user/blind-mode and normalizes the response', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(fullState));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const state = await getBlindModeState();

    expect(state).toEqual(fullState);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/user/blind-mode');
  });

  it('caches across calls (single network round-trip)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(fullState));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await getBlindModeState();
    await getBlindModeState();
    await getBlindModeState();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent in-flight requests', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(fullState));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await Promise.all([
      getBlindModeState(),
      getBlindModeState(),
      getBlindModeState(),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('returns null on non-2xx', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const state = await getBlindModeState();
    expect(state).toBeNull();
  });

  it('returns null on network error', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('network down'));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const state = await getBlindModeState();
    expect(state).toBeNull();
  });

  it('normalizes missing perFilm to an empty object', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({
        blindUnwatchedDefault: false,
        hasSeenBlindModeTooltip: false,
      }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const state = await getBlindModeState();
    expect(state?.perFilm).toEqual({});
  });
});

describe('resolveBlindForFilm', () => {
  it('returns false when state is null (default-safe fallback)', () => {
    expect(resolveBlindForFilm(null, 'film-1', false)).toBe(false);
    expect(resolveBlindForFilm(null, 'film-1', true)).toBe(false);
  });

  it('returns the perFilm override when set, regardless of defaults', () => {
    // film-1 has perFilm = false, but blindUnwatchedDefault = true.
    // The override wins.
    expect(resolveBlindForFilm(fullState, 'film-1', false)).toBe(false);
    // film-2 has perFilm = true. A reviewed film would otherwise
    // auto-lift to visible, but the per-film override still wins.
    expect(resolveBlindForFilm(fullState, 'film-2', true)).toBe(true);
  });

  it('falls back to blindUnwatchedDefault for unwatched films with no override', () => {
    expect(resolveBlindForFilm(fullState, 'unknown-film', false)).toBe(true);
  });

  it('returns false for reviewed films with no override (blind auto-lifts on review)', () => {
    // Once the user has reviewed a film, blind mode has nothing left to
    // protect, so it lifts regardless of blindUnwatchedDefault.
    const state: BlindModeState = {
      blindUnwatchedDefault: true,
      perFilm: {},
      hasSeenBlindModeTooltip: false,
    };
    expect(resolveBlindForFilm(state, 'unknown-film', true)).toBe(false);
  });

  it('treats explicit perFilm[id] = false as an override (not absence)', () => {
    // Without hasOwnProperty: false would look "missing" and fall back
    // to the default. Confirm we treat explicit false as an override.
    const state: BlindModeState = {
      blindUnwatchedDefault: true,
      perFilm: { 'explicitly-visible': false },
      hasSeenBlindModeTooltip: false,
    };
    expect(resolveBlindForFilm(state, 'explicitly-visible', false)).toBe(false);
  });
});

describe('setBlindForFilm', () => {
  it('PUTs to /user/blind-mode/film/[id] with the new value', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await setBlindForFilm('film-abc', true);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/user/blind-mode/film/film-abc');
    expect(init.method).toBe('PUT');
    // Server contract: body field is `isBlind`, not `blind`. Sending
    // `{ blind }` makes the route return 400 'isBlind (boolean) required',
    // which surfaces on device as the optimistic toggle reverting plus
    // an error toast. Guard against silent drift on either side.
    expect(JSON.parse(init.body as string)).toEqual({ isBlind: true });
  });

  it('sends { isBlind: false } when toggling off', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await setBlindForFilm('film-abc', false);

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ isBlind: false });
  });

  it('throws on non-2xx so callers can revert optimistic updates', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await expect(setBlindForFilm('film-abc', true)).rejects.toThrow();
  });

  it('updates the cached perFilm entry on success', async () => {
    __setCachedStateForTesting({
      blindUnwatchedDefault: false,
      perFilm: {},
      hasSeenBlindModeTooltip: false,
    });
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await setBlindForFilm('film-xyz', true);

    // Re-read without hitting the network — cache returns the updated value.
    const state = await getBlindModeState();
    expect(state?.perFilm['film-xyz']).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('setBlindModeDefaults', () => {
  it('PATCHes /user/blind-mode/defaults with the partial', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await setBlindModeDefaults({ blindUnwatchedDefault: true });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/user/blind-mode/defaults');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({
      blindUnwatchedDefault: true,
    });
  });

  it('merges patch into the cached state on success', async () => {
    __setCachedStateForTesting({
      blindUnwatchedDefault: false,
      perFilm: {},
      hasSeenBlindModeTooltip: false,
    });
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await setBlindModeDefaults({ blindUnwatchedDefault: true });

    const state = await getBlindModeState();
    expect(state?.blindUnwatchedDefault).toBe(true);
    expect(state?.hasSeenBlindModeTooltip).toBe(false);
  });

  it('throws on non-2xx', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await expect(
      setBlindModeDefaults({ blindUnwatchedDefault: true }),
    ).rejects.toThrow();
  });
});

describe('markTooltipSeen', () => {
  it('PATCHes hasSeenBlindModeTooltip: true', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await markTooltipSeen();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/user/blind-mode/defaults');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({
      hasSeenBlindModeTooltip: true,
    });
  });

  it('swallows errors so a tooltip-PATCH failure does not break the UI', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('network down'));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await expect(markTooltipSeen()).resolves.toBeUndefined();
  });
});

describe('clearBlindModeCache', () => {
  it('drops cached state so the next read re-fetches', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(fullState));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await getBlindModeState();
    clearBlindModeCache();
    await getBlindModeState();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
