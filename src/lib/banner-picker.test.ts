import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock SecureStore so apiFetch can read a token without touching the
// native module. Auth header presence is verified in the fetch tests.
const tokenStore: Record<string, string> = {};
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn((key: string) => Promise.resolve(tokenStore[key] ?? null)),
  setItemAsync: vi.fn((key: string, val: string) => {
    tokenStore[key] = val;
    return Promise.resolve();
  }),
  deleteItemAsync: vi.fn((key: string) => {
    delete tokenStore[key];
    return Promise.resolve();
  }),
}));

import {
  isSaveEnabled,
  getResetStateForTab,
  getStateAfterFilmSelection,
  getInitialState,
  type PickerState,
  type PickerPersisted,
} from './banner-picker';
import {
  resolveBannerSource,
  resolveBackdropUri,
} from './banner-url';
import { fetchBackdropFilms } from './api';
import { BANNER_DEFAULT_KEY } from '../constants/bannerPresets';
import type { Film } from '../types/film';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const filmStub = (overrides: Partial<Film> = {}): Film => ({
  id: 'film-1',
  title: 'Test Film',
  year: 2024,
  posterPath: '/poster.jpg',
  posterUrl: '/poster.jpg',
  backdropPath: '/backdrop.jpg',
  backdropUrl: '/backdrop.jpg',
  runtime: 120,
  genres: ['Drama'],
  director: 'Director',
  sentimentGraph: null,
  ...overrides,
});

const persistedGradient: PickerPersisted = {
  bannerType: 'GRADIENT',
  bannerValue: 'midnight',
};

const persistedBackdrop: PickerPersisted = {
  bannerType: 'BACKDROP',
  bannerValue: 'film-saved',
};

// ---------------------------------------------------------------------------
// banner-picker.ts: pure state-machine helpers
// ---------------------------------------------------------------------------

describe('isSaveEnabled', () => {
  it('returns false when draft equals persisted (Gradient)', () => {
    const draft = { bannerType: 'GRADIENT' as const, bannerValue: 'midnight', selectedFilm: null };
    expect(isSaveEnabled(draft, persistedGradient, 'GRADIENT')).toBe(false);
  });

  it('returns true when draft bannerValue differs from persisted', () => {
    const draft = { bannerType: 'GRADIENT' as const, bannerValue: 'ember', selectedFilm: null };
    expect(isSaveEnabled(draft, persistedGradient, 'GRADIENT')).toBe(true);
  });

  it('returns true when draft bannerType differs from persisted', () => {
    const draft = { bannerType: 'BACKDROP' as const, bannerValue: 'film-1', selectedFilm: filmStub() };
    expect(isSaveEnabled(draft, persistedGradient, 'BACKDROP')).toBe(true);
  });

  it('returns false when draft equals persisted backdrop', () => {
    const draft = { bannerType: 'BACKDROP' as const, bannerValue: 'film-saved', selectedFilm: null };
    expect(isSaveEnabled(draft, persistedBackdrop, 'BACKDROP')).toBe(false);
  });

  it('always returns false in PHOTO mode (placeholder)', () => {
    const draft = { bannerType: 'BACKDROP' as const, bannerValue: 'film-99', selectedFilm: filmStub() };
    expect(isSaveEnabled(draft, persistedGradient, 'PHOTO')).toBe(false);
  });
});

describe('getResetStateForTab', () => {
  it('switches activeTab and resets draft to persisted (Gradient persisted -> Backdrop tab)', () => {
    const next = getResetStateForTab('BACKDROP', persistedGradient);
    expect(next.activeTab).toBe('BACKDROP');
    expect(next.bannerType).toBe('GRADIENT');
    expect(next.bannerValue).toBe('midnight');
    expect(next.selectedFilm).toBeNull();
  });

  it('switches activeTab and resets draft to persisted (Backdrop persisted -> Gradient tab)', () => {
    const next = getResetStateForTab('GRADIENT', persistedBackdrop);
    expect(next.activeTab).toBe('GRADIENT');
    expect(next.bannerType).toBe('BACKDROP');
    expect(next.bannerValue).toBe('film-saved');
    expect(next.selectedFilm).toBeNull();
  });

  it('clears any in-progress film selection on tab switch', () => {
    const next = getResetStateForTab('PHOTO', persistedBackdrop);
    expect(next.selectedFilm).toBeNull();
    expect(next.activeTab).toBe('PHOTO');
  });
});

describe('getStateAfterFilmSelection', () => {
  it('sets bannerType to BACKDROP, bannerValue to film.id, stores selectedFilm', () => {
    const initial: PickerState = {
      activeTab: 'BACKDROP',
      bannerType: 'GRADIENT',
      bannerValue: 'midnight',
      selectedFilm: null,
    };
    const film = filmStub({ id: 'film-godfather' });
    const next = getStateAfterFilmSelection(initial, film);
    expect(next.bannerType).toBe('BACKDROP');
    expect(next.bannerValue).toBe('film-godfather');
    expect(next.selectedFilm).toBe(film);
    expect(next.activeTab).toBe('BACKDROP');
  });

  it('preserves activeTab from prior state (does not force BACKDROP tab)', () => {
    const initial: PickerState = {
      activeTab: 'BACKDROP',
      bannerType: 'BACKDROP',
      bannerValue: 'film-1',
      selectedFilm: filmStub({ id: 'film-1' }),
    };
    const next = getStateAfterFilmSelection(initial, filmStub({ id: 'film-2' }));
    expect(next.activeTab).toBe('BACKDROP');
    expect(next.bannerValue).toBe('film-2');
  });
});

describe('getInitialState', () => {
  it('mirrors persisted GRADIENT into draft and activeTab', () => {
    const init = getInitialState(persistedGradient);
    expect(init.activeTab).toBe('GRADIENT');
    expect(init.bannerType).toBe('GRADIENT');
    expect(init.bannerValue).toBe('midnight');
    expect(init.selectedFilm).toBeNull();
  });

  it('mirrors persisted BACKDROP into draft and activeTab', () => {
    const init = getInitialState(persistedBackdrop);
    expect(init.activeTab).toBe('BACKDROP');
    expect(init.bannerType).toBe('BACKDROP');
    expect(init.bannerValue).toBe('film-saved');
    expect(init.selectedFilm).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// banner-url.ts: source resolver + backdrop URI builder
// ---------------------------------------------------------------------------

describe('resolveBackdropUri', () => {
  it('returns null when input is null or undefined', () => {
    expect(resolveBackdropUri(null)).toBeNull();
    expect(resolveBackdropUri(undefined)).toBeNull();
  });

  it('returns null when both backdropUrl and backdropPath are missing', () => {
    expect(resolveBackdropUri({ backdropUrl: null, backdropPath: null })).toBeNull();
    expect(resolveBackdropUri({})).toBeNull();
  });

  it('passes through a fully-qualified URL unchanged', () => {
    const url = 'https://example.com/cdn/backdrop.jpg';
    expect(resolveBackdropUri({ backdropUrl: url })).toBe(url);
  });

  it('prepends the TMDB base for a path with a leading slash', () => {
    expect(resolveBackdropUri({ backdropPath: '/abc.jpg' })).toBe(
      'https://image.tmdb.org/t/p/w780/abc.jpg',
    );
  });

  it('prepends the TMDB base for a path without a leading slash', () => {
    expect(resolveBackdropUri({ backdropPath: 'abc.jpg' })).toBe(
      'https://image.tmdb.org/t/p/w780/abc.jpg',
    );
  });

  it('prefers backdropUrl over backdropPath when both are set', () => {
    expect(
      resolveBackdropUri({ backdropUrl: 'https://x.com/y.jpg', backdropPath: '/z.jpg' }),
    ).toBe('https://x.com/y.jpg');
  });
});

describe('resolveBannerSource', () => {
  it('returns gradient source for known GRADIENT key', () => {
    const src = resolveBannerSource('GRADIENT', 'ember');
    expect(src).toEqual({ kind: 'gradient', presetKey: 'ember' });
  });

  it('falls back to default gradient for unknown GRADIENT value', () => {
    const src = resolveBannerSource('GRADIENT', 'not-a-preset');
    expect(src).toEqual({ kind: 'gradient', presetKey: BANNER_DEFAULT_KEY });
  });

  it('returns backdrop source when BACKDROP and film provided', () => {
    const src = resolveBannerSource(
      'BACKDROP',
      'film-1',
      filmStub({ backdropPath: '/bd.jpg', backdropUrl: '/bd.jpg' }),
    );
    expect(src).toEqual({
      kind: 'backdrop',
      uri: 'https://image.tmdb.org/t/p/w780/bd.jpg',
    });
  });

  it('falls back to default gradient for BACKDROP without a film', () => {
    const src = resolveBannerSource('BACKDROP', 'film-1');
    expect(src).toEqual({ kind: 'gradient', presetKey: BANNER_DEFAULT_KEY });
  });

  it('falls back to default gradient for BACKDROP with film missing backdrop fields', () => {
    const src = resolveBannerSource(
      'BACKDROP',
      'film-1',
      filmStub({ backdropPath: null, backdropUrl: null }),
    );
    expect(src).toEqual({ kind: 'gradient', presetKey: BANNER_DEFAULT_KEY });
  });

  it('PHOTO returns gradient fallback (placeholder until next prompt)', () => {
    const src = resolveBannerSource('PHOTO', 'some-blob-path');
    expect(src).toEqual({ kind: 'gradient', presetKey: BANNER_DEFAULT_KEY });
  });
});

// ---------------------------------------------------------------------------
// fetchBackdropFilms wrapper: URL params + headers + parsing
// ---------------------------------------------------------------------------

describe('fetchBackdropFilms', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Object.keys(tokenStore).forEach((k) => delete tokenStore[k]);
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFilmsResponse(films: Partial<Film>[]) {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ films }),
    });
  }

  it('hits /api/films with sort=popular and hasBackdrop=true and default limit=12', async () => {
    mockFilmsResponse([]);
    await fetchBackdropFilms();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url.startsWith('https://cinemagraphs.ca/api/films?')).toBe(true);
    expect(url).toContain('sort=popular');
    expect(url).toContain('hasBackdrop=true');
    expect(url).toContain('limit=12');
    expect(url).not.toContain('q=');
  });

  it('passes the q param when a non-empty query is provided', async () => {
    mockFilmsResponse([]);
    await fetchBackdropFilms({ q: 'godfather' });
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('q=godfather');
    expect(url).toContain('sort=popular');
    expect(url).toContain('hasBackdrop=true');
  });

  it('omits the q param when query is whitespace only', async () => {
    mockFilmsResponse([]);
    await fetchBackdropFilms({ q: '   ' });
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).not.toContain('q=');
  });

  it('honours a custom limit', async () => {
    mockFilmsResponse([]);
    await fetchBackdropFilms({ limit: 24 });
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('limit=24');
  });

  it('sends Authorization header when a token is stored', async () => {
    tokenStore['auth_token'] = 'token-abc';
    mockFilmsResponse([]);
    await fetchBackdropFilms();
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer token-abc');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('omits Authorization header when no token is stored', async () => {
    mockFilmsResponse([]);
    await fetchBackdropFilms();
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('parses the films array from the response envelope', async () => {
    mockFilmsResponse([
      { id: 'a', title: 'A', backdropPath: '/a.jpg' },
      { id: 'b', title: 'B', backdropPath: '/b.jpg' },
    ]);
    const films = await fetchBackdropFilms();
    expect(films).toHaveLength(2);
    expect(films[0].id).toBe('a');
    expect(films[1].title).toBe('B');
  });

  it('parses a bare-array response (no envelope)', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'x', title: 'X' }]),
    });
    const films = await fetchBackdropFilms();
    expect(films).toHaveLength(1);
    expect(films[0].id).toBe('x');
  });

  it('throws on non-OK responses so callers can show an error state', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });
    await expect(fetchBackdropFilms()).rejects.toThrow(/500/);
  });

  it('forwards the AbortSignal so callers can cancel an in-flight request', async () => {
    mockFilmsResponse([]);
    const ctrl = new AbortController();
    await fetchBackdropFilms({ q: 'x', signal: ctrl.signal });
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBe(ctrl.signal);
  });
});
