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
  computePhotoCrop,
  computeSourceCropRect,
  type PickerState,
  type PickerPersisted,
} from './banner-picker';
import {
  resolveBannerSource,
  resolveBackdropUri,
  resolvePhotoUri,
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

  it('returns false in PHOTO mode when draft is still the persisted non-PHOTO state', () => {
    // Tab switched to PHOTO but no photo picked yet: draft still
    // mirrors the persisted GRADIENT state, so Save stays disabled.
    const draft = { bannerType: 'GRADIENT' as const, bannerValue: 'midnight', selectedFilm: null };
    expect(isSaveEnabled(draft, persistedGradient, 'PHOTO')).toBe(false);
  });

  it('returns true in PHOTO mode once draft.bannerType has flipped to PHOTO', () => {
    // After the user picks a photo, the picker sets draft.bannerType
    // to PHOTO. The runtime gate (pickedPhoto present, not uploading)
    // is layered on top of this in header-picker.tsx; here we only
    // assert the type-level behaviour.
    const draft = { bannerType: 'PHOTO' as const, bannerValue: '', selectedFilm: null };
    expect(isSaveEnabled(draft, persistedGradient, 'PHOTO')).toBe(true);
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

  it('prepends the TMDB base for a path with a leading slash (PR 1c uses w1280)', () => {
    expect(resolveBackdropUri({ backdropPath: '/abc.jpg' })).toBe(
      'https://image.tmdb.org/t/p/w1280/abc.jpg',
    );
  });

  it('prepends the TMDB base for a path without a leading slash (PR 1c uses w1280)', () => {
    expect(resolveBackdropUri({ backdropPath: 'abc.jpg' })).toBe(
      'https://image.tmdb.org/t/p/w1280/abc.jpg',
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

  it('returns backdrop source when BACKDROP (legacy filmId) and film provided (PR 1c uses w1280)', () => {
    const src = resolveBannerSource(
      'BACKDROP',
      'film-1',
      filmStub({ backdropPath: '/bd.jpg', backdropUrl: '/bd.jpg' }),
    );
    expect(src).toEqual({
      kind: 'backdrop',
      uri: 'https://image.tmdb.org/t/p/w1280/bd.jpg',
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

  it('PHOTO returns photo source when EXPO_PUBLIC_VERCEL_BLOB_HOST is configured', () => {
    const prev = process.env.EXPO_PUBLIC_VERCEL_BLOB_HOST;
    process.env.EXPO_PUBLIC_VERCEL_BLOB_HOST = 'abc123.public.blob.vercel-storage.com';
    try {
      const src = resolveBannerSource('PHOTO', 'banners/user-1/123.jpg');
      expect(src).toEqual({
        kind: 'photo',
        uri: 'https://abc123.public.blob.vercel-storage.com/banners/user-1/123.jpg',
      });
    } finally {
      if (prev === undefined) delete process.env.EXPO_PUBLIC_VERCEL_BLOB_HOST;
      else process.env.EXPO_PUBLIC_VERCEL_BLOB_HOST = prev;
    }
  });

  it('PHOTO falls back to gradient when EXPO_PUBLIC_VERCEL_BLOB_HOST is missing', () => {
    const prev = process.env.EXPO_PUBLIC_VERCEL_BLOB_HOST;
    delete process.env.EXPO_PUBLIC_VERCEL_BLOB_HOST;
    try {
      const src = resolveBannerSource('PHOTO', 'banners/user-1/123.jpg');
      expect(src).toEqual({ kind: 'gradient', presetKey: BANNER_DEFAULT_KEY });
    } finally {
      if (prev !== undefined) process.env.EXPO_PUBLIC_VERCEL_BLOB_HOST = prev;
    }
  });

  it('PHOTO passes through a fully-qualified URL even without env host', () => {
    const prev = process.env.EXPO_PUBLIC_VERCEL_BLOB_HOST;
    delete process.env.EXPO_PUBLIC_VERCEL_BLOB_HOST;
    try {
      const src = resolveBannerSource(
        'PHOTO',
        'https://abc.public.blob.vercel-storage.com/banners/u/x.jpg',
      );
      expect(src).toEqual({
        kind: 'photo',
        uri: 'https://abc.public.blob.vercel-storage.com/banners/u/x.jpg',
      });
    } finally {
      if (prev !== undefined) process.env.EXPO_PUBLIC_VERCEL_BLOB_HOST = prev;
    }
  });
});

// ---------------------------------------------------------------------------
// resolvePhotoUri standalone
// ---------------------------------------------------------------------------

describe('resolvePhotoUri', () => {
  let prevHost: string | undefined;

  beforeEach(() => {
    prevHost = process.env.EXPO_PUBLIC_VERCEL_BLOB_HOST;
  });

  afterEach(() => {
    if (prevHost === undefined) delete process.env.EXPO_PUBLIC_VERCEL_BLOB_HOST;
    else process.env.EXPO_PUBLIC_VERCEL_BLOB_HOST = prevHost;
  });

  it('returns null for empty bannerValue', () => {
    process.env.EXPO_PUBLIC_VERCEL_BLOB_HOST = 'abc.public.blob.vercel-storage.com';
    expect(resolvePhotoUri('')).toBeNull();
  });

  it('returns null when env host missing and value is just a pathname', () => {
    delete process.env.EXPO_PUBLIC_VERCEL_BLOB_HOST;
    expect(resolvePhotoUri('banners/u/x.jpg')).toBeNull();
  });

  it('passes a fully-qualified https URL through unchanged', () => {
    delete process.env.EXPO_PUBLIC_VERCEL_BLOB_HOST;
    expect(resolvePhotoUri('https://x.public.blob.vercel-storage.com/banners/u/x.jpg')).toBe(
      'https://x.public.blob.vercel-storage.com/banners/u/x.jpg',
    );
  });

  it('joins env host + pathname with a single slash regardless of leading slash', () => {
    process.env.EXPO_PUBLIC_VERCEL_BLOB_HOST = 'abc.public.blob.vercel-storage.com';
    expect(resolvePhotoUri('banners/u/x.jpg')).toBe(
      'https://abc.public.blob.vercel-storage.com/banners/u/x.jpg',
    );
    expect(resolvePhotoUri('/banners/u/x.jpg')).toBe(
      'https://abc.public.blob.vercel-storage.com/banners/u/x.jpg',
    );
  });

  it('strips https:// prefix from env host if accidentally included', () => {
    process.env.EXPO_PUBLIC_VERCEL_BLOB_HOST = 'https://abc.public.blob.vercel-storage.com/';
    expect(resolvePhotoUri('banners/u/x.jpg')).toBe(
      'https://abc.public.blob.vercel-storage.com/banners/u/x.jpg',
    );
  });
});

// ---------------------------------------------------------------------------
// computePhotoCrop: cover-fit + clamp
// ---------------------------------------------------------------------------

describe('computePhotoCrop', () => {
  // 16:9 frame at 360 x 202.5 (matches a 360pt screen with 20pt side padding
  // and the picker's 16:9 lock).
  const frame = { frameWidth: 360, frameHeight: 202.5 };

  it('landscape photo wider than frame: matches heights, overflows horizontally', () => {
    // 4000x2000 photo, photoAspect 2.0 > frameAspect 1.778
    const r = computePhotoCrop({
      ...frame,
      photoWidth: 4000,
      photoHeight: 2000,
      panX: 0,
      panY: 0,
    });
    expect(r.renderedHeight).toBeCloseTo(202.5);
    expect(r.renderedWidth).toBeCloseTo(405); // 202.5 * 2
    expect(r.maxPanX).toBeCloseTo(22.5); // (405 - 360) / 2
    expect(r.maxPanY).toBe(0); // no vertical overflow
  });

  it('portrait photo taller than frame: matches widths, overflows vertically', () => {
    // 1000x2000 photo, photoAspect 0.5 < frameAspect 1.778
    const r = computePhotoCrop({
      ...frame,
      photoWidth: 1000,
      photoHeight: 2000,
      panX: 0,
      panY: 0,
    });
    expect(r.renderedWidth).toBeCloseTo(360);
    expect(r.renderedHeight).toBeCloseTo(720); // 360 / 0.5
    expect(r.maxPanX).toBe(0);
    expect(r.maxPanY).toBeCloseTo(258.75); // (720 - 202.5) / 2
  });

  it('square photo (1:1) overflows vertically only', () => {
    const r = computePhotoCrop({
      ...frame,
      photoWidth: 1000,
      photoHeight: 1000,
      panX: 0,
      panY: 0,
    });
    expect(r.renderedWidth).toBeCloseTo(360);
    expect(r.renderedHeight).toBeCloseTo(360);
    expect(r.maxPanX).toBe(0);
    expect(r.maxPanY).toBeCloseTo(78.75);
  });

  it('exact 16:9 photo: no overflow on either axis, no panning possible', () => {
    const r = computePhotoCrop({
      ...frame,
      photoWidth: 1600,
      photoHeight: 900,
      panX: 0,
      panY: 0,
    });
    expect(r.renderedWidth).toBeCloseTo(360);
    expect(r.renderedHeight).toBeCloseTo(202.5);
    expect(r.maxPanX).toBe(0);
    expect(r.maxPanY).toBe(0);
  });

  it('clamps panX inside [-maxPanX, maxPanX] for a landscape photo', () => {
    const base = {
      ...frame,
      photoWidth: 4000,
      photoHeight: 2000,
      panY: 0,
    };
    expect(computePhotoCrop({ ...base, panX: 0 }).clampedPanX).toBe(0);
    expect(computePhotoCrop({ ...base, panX: 100 }).clampedPanX).toBeCloseTo(22.5);
    expect(computePhotoCrop({ ...base, panX: -100 }).clampedPanX).toBeCloseTo(-22.5);
    expect(computePhotoCrop({ ...base, panX: 10 }).clampedPanX).toBe(10);
  });

  it('clamps panY for a portrait photo and zeros panX', () => {
    const base = {
      ...frame,
      photoWidth: 1000,
      photoHeight: 2000,
      panX: 50, // try to pan horizontally; should be zeroed
    };
    const r = computePhotoCrop({ ...base, panY: 1000 });
    expect(r.clampedPanX).toBe(0);
    expect(r.clampedPanY).toBeCloseTo(258.75);
  });

  it('returns safe defaults for degenerate inputs (zero or negative dims)', () => {
    const r = computePhotoCrop({
      photoWidth: 0,
      photoHeight: 1000,
      frameWidth: 360,
      frameHeight: 202.5,
      panX: 50,
      panY: 50,
    });
    expect(r.renderedWidth).toBe(360);
    expect(r.renderedHeight).toBe(202.5);
    expect(r.maxPanX).toBe(0);
    expect(r.maxPanY).toBe(0);
    expect(r.clampedPanX).toBe(0);
    expect(r.clampedPanY).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeSourceCropRect: rendered -> original photo pixel coordinates
// ---------------------------------------------------------------------------

describe('computeSourceCropRect', () => {
  const frame = { frameWidth: 360, frameHeight: 202.5 };

  it('landscape photo, no pan: crop is centered horizontally', () => {
    // 4000x2000 photo, scaleFactor = 202.5/2000 = 0.10125
    // renderedWidth = 405; visible region in rendered space starts at
    // (405-360)/2 = 22.5 from the left of the rendered photo.
    // In photo pixels: 22.5 / 0.10125 = ~222.22
    const r = computeSourceCropRect({
      ...frame,
      photoWidth: 4000,
      photoHeight: 2000,
      panX: 0,
      panY: 0,
    });
    expect(r.originX).toBeCloseTo(222.22, 1);
    expect(r.originY).toBeCloseTo(0, 5);
    expect(r.width).toBeCloseTo(3555.56, 1); // 360 / 0.10125
    expect(r.height).toBeCloseTo(2000, 1);
  });

  it('landscape photo panned right reveals more of the photo left side', () => {
    // panX = +22.5 (max) shifts the photo right, so the visible region
    // starts at the photo's left edge in rendered space (origin 0).
    const r = computeSourceCropRect({
      ...frame,
      photoWidth: 4000,
      photoHeight: 2000,
      panX: 22.5,
      panY: 0,
    });
    expect(r.originX).toBeCloseTo(0, 5);
  });

  it('landscape photo panned left reveals more of the photo right side', () => {
    // panX = -22.5 (max negative) shifts the photo left, so the visible
    // region starts deeper into the photo. originX should be 2 * 222.22.
    const r = computeSourceCropRect({
      ...frame,
      photoWidth: 4000,
      photoHeight: 2000,
      panX: -22.5,
      panY: 0,
    });
    expect(r.originX).toBeCloseTo(444.44, 1);
  });

  it('portrait photo, panned down reveals top of photo', () => {
    // 1000x2000 photo, scaleFactor = 360/1000 = 0.36
    // renderedHeight = 720; (720-202.5)/2 = 258.75 of vertical overflow each side
    // panY = +258.75 (max) reveals the top of the photo (originY=0)
    const r = computeSourceCropRect({
      ...frame,
      photoWidth: 1000,
      photoHeight: 2000,
      panX: 0,
      panY: 258.75,
    });
    expect(r.originX).toBeCloseTo(0, 5);
    expect(r.originY).toBeCloseTo(0, 1);
  });

  it('exact 16:9 photo: crop covers the entire photo (originX=0, width=photoWidth)', () => {
    const r = computeSourceCropRect({
      ...frame,
      photoWidth: 1600,
      photoHeight: 900,
      panX: 0,
      panY: 0,
    });
    expect(r.originX).toBeCloseTo(0, 5);
    expect(r.originY).toBeCloseTo(0, 5);
    expect(r.width).toBeCloseTo(1600);
    expect(r.height).toBeCloseTo(900);
  });

  it('returns zero rect for degenerate inputs', () => {
    const r = computeSourceCropRect({
      photoWidth: 0,
      photoHeight: 0,
      frameWidth: 0,
      frameHeight: 0,
      panX: 0,
      panY: 0,
    });
    expect(r).toEqual({ originX: 0, originY: 0, width: 0, height: 0 });
  });

  it('out-of-range pan input is clamped before computing the crop', () => {
    // panX way beyond the max should still produce an in-bounds origin
    // (clamped to maxPanX internally by computePhotoCrop).
    const r = computeSourceCropRect({
      ...frame,
      photoWidth: 4000,
      photoHeight: 2000,
      panX: 100000,
      panY: 0,
    });
    expect(r.originX).toBeCloseTo(0, 5); // same as max-pan-right case
    expect(r.originX).toBeGreaterThanOrEqual(0);
    expect(r.originX + r.width).toBeLessThanOrEqual(4000.001);
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
    tokenStore['auth_tokens'] = JSON.stringify({
      accessToken: 'token-abc',
      refreshToken: 'refresh-abc',
    });
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
