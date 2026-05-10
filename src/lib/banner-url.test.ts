import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock SecureStore so apiFetch (used by getBackdrops) can read a token
// without touching the native module. Auth header presence is verified
// in the fetch tests below.
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
  parseBackdropBannerValue,
  resolveBannerSource,
  resolveBackdropUri,
} from './banner-url';
import { getBackdrops } from './api';
import { BANNER_DEFAULT_KEY } from '../constants/bannerPresets';

// ---------------------------------------------------------------------------
// parseBackdropBannerValue: dual-shape parsing (PR 1c)
// ---------------------------------------------------------------------------

describe('parseBackdropBannerValue', () => {
  it('returns null for empty string', () => {
    expect(parseBackdropBannerValue('')).toBeNull();
  });

  it('parses the new JSON-encoded shape with a non-null backdropPath', () => {
    const raw = JSON.stringify({ filmId: 'tt0068646', backdropPath: '/abc.jpg' });
    expect(parseBackdropBannerValue(raw)).toEqual({
      filmId: 'tt0068646',
      backdropPath: '/abc.jpg',
    });
  });

  it('parses the new JSON-encoded shape with a null backdropPath (migrated rows)', () => {
    const raw = JSON.stringify({ filmId: 'tt0068646', backdropPath: null });
    expect(parseBackdropBannerValue(raw)).toEqual({
      filmId: 'tt0068646',
      backdropPath: null,
    });
  });

  it('treats a plain filmId string as legacy: backdropPath null', () => {
    expect(parseBackdropBannerValue('tt0068646')).toEqual({
      filmId: 'tt0068646',
      backdropPath: null,
    });
  });

  it('treats malformed JSON as legacy plain string', () => {
    expect(parseBackdropBannerValue('{not-json')).toEqual({
      filmId: '{not-json',
      backdropPath: null,
    });
  });

  it('treats a JSON object missing filmId as legacy plain string', () => {
    const raw = JSON.stringify({ foo: 'bar' });
    expect(parseBackdropBannerValue(raw)).toEqual({
      filmId: raw,
      backdropPath: null,
    });
  });

  it('coerces non-string backdropPath in JSON to null', () => {
    const raw = JSON.stringify({ filmId: 'x', backdropPath: 42 });
    expect(parseBackdropBannerValue(raw)).toEqual({
      filmId: 'x',
      backdropPath: null,
    });
  });

  // Regression: numeric filmId in the JSON shape used to fall through
  // to the legacy branch and stuff the entire JSON-encoded string into
  // filmId, yielding /api/films/{"filmId":...}/... and a 404 from
  // fetchFilmDetail in the header picker.
  it('parses JSON-encoded shape with a numeric filmId (coerced to string)', () => {
    const raw = JSON.stringify({ filmId: 12345, backdropPath: '/abc.jpg' });
    expect(parseBackdropBannerValue(raw)).toEqual({
      filmId: '12345',
      backdropPath: '/abc.jpg',
    });
  });

  it('parses JSON-encoded shape with a numeric filmId and null backdropPath', () => {
    const raw = JSON.stringify({ filmId: 67890, backdropPath: null });
    expect(parseBackdropBannerValue(raw)).toEqual({
      filmId: '67890',
      backdropPath: null,
    });
  });

  it('returns null for null input without throwing', () => {
    expect(parseBackdropBannerValue(null)).toBeNull();
  });

  it('returns null for undefined input without throwing', () => {
    expect(parseBackdropBannerValue(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveBackdropUri: now routes through getBackdropUrl(_, 'preview')
// for the w1280 sharpness upgrade (PR 1c).
// ---------------------------------------------------------------------------

describe('resolveBackdropUri', () => {
  it('returns null for null / undefined / empty input', () => {
    expect(resolveBackdropUri(null)).toBeNull();
    expect(resolveBackdropUri(undefined)).toBeNull();
    expect(resolveBackdropUri({ backdropUrl: null, backdropPath: null })).toBeNull();
    expect(resolveBackdropUri({})).toBeNull();
  });

  it('uses w1280 for plain-path inputs (sharpness upgrade)', () => {
    expect(resolveBackdropUri({ backdropPath: '/abc.jpg' })).toBe(
      'https://image.tmdb.org/t/p/w1280/abc.jpg',
    );
  });

  it('rewrites a baked-in TMDB URL to w1280 even if it had w780', () => {
    expect(
      resolveBackdropUri({ backdropUrl: 'https://image.tmdb.org/t/p/w780/x.jpg' }),
    ).toBe('https://image.tmdb.org/t/p/w1280/x.jpg');
  });

  it('passes non-TMDB full URLs through unchanged', () => {
    expect(
      resolveBackdropUri({ backdropUrl: 'https://cdn.example.com/y.jpg' }),
    ).toBe('https://cdn.example.com/y.jpg');
  });

  it('prefers backdropUrl over backdropPath when both are set', () => {
    expect(
      resolveBackdropUri({ backdropUrl: 'https://x.com/y.jpg', backdropPath: '/z.jpg' }),
    ).toBe('https://x.com/y.jpg');
  });
});

// ---------------------------------------------------------------------------
// resolveBannerSource: BACKDROP dual-shape behaviour (PR 1c)
// ---------------------------------------------------------------------------

describe('resolveBannerSource (BACKDROP, PR 1c dual-shape)', () => {
  it('uses backdropPath from JSON-encoded value directly (no film record needed)', () => {
    const raw = JSON.stringify({ filmId: 'tt0068646', backdropPath: '/path-from-json.jpg' });
    const src = resolveBannerSource('BACKDROP', raw);
    expect(src).toEqual({
      kind: 'backdrop',
      uri: 'https://image.tmdb.org/t/p/w1280/path-from-json.jpg',
    });
  });

  it('falls back to film.backdropUrl when JSON-encoded value has null backdropPath', () => {
    const raw = JSON.stringify({ filmId: 'tt0068646', backdropPath: null });
    const src = resolveBannerSource('BACKDROP', raw, {
      backdropPath: '/from-film.jpg',
    });
    expect(src).toEqual({
      kind: 'backdrop',
      uri: 'https://image.tmdb.org/t/p/w1280/from-film.jpg',
    });
  });

  it('legacy plain-string filmId falls back to film.backdropUrl', () => {
    const src = resolveBannerSource('BACKDROP', 'tt0068646', {
      backdropPath: '/legacy-default.jpg',
    });
    expect(src).toEqual({
      kind: 'backdrop',
      uri: 'https://image.tmdb.org/t/p/w1280/legacy-default.jpg',
    });
  });

  it('JSON with null backdropPath + missing film record falls back to default gradient', () => {
    const raw = JSON.stringify({ filmId: 'x', backdropPath: null });
    const src = resolveBannerSource('BACKDROP', raw);
    expect(src).toEqual({ kind: 'gradient', presetKey: BANNER_DEFAULT_KEY });
  });

  it('legacy plain-string filmId + missing film record falls back to default gradient', () => {
    const src = resolveBannerSource('BACKDROP', 'tt0068646');
    expect(src).toEqual({ kind: 'gradient', presetKey: BANNER_DEFAULT_KEY });
  });

  it('malformed JSON does not throw; treated as legacy + film fallback', () => {
    const src = resolveBannerSource('BACKDROP', '{not-json', {
      backdropPath: '/from-film.jpg',
    });
    expect(src).toEqual({
      kind: 'backdrop',
      uri: 'https://image.tmdb.org/t/p/w1280/from-film.jpg',
    });
  });

  it('JSON-encoded backdropPath wins over film.backdropUrl when both present', () => {
    const raw = JSON.stringify({ filmId: 'x', backdropPath: '/picked.jpg' });
    const src = resolveBannerSource('BACKDROP', raw, {
      backdropPath: '/different-from-film.jpg',
    });
    expect(src).toEqual({
      kind: 'backdrop',
      uri: 'https://image.tmdb.org/t/p/w1280/picked.jpg',
    });
  });
});

// ---------------------------------------------------------------------------
// getBackdrops API wrapper (PR 1c): URL, headers, response parsing.
// ---------------------------------------------------------------------------

describe('getBackdrops', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Object.keys(tokenStore).forEach((k) => delete tokenStore[k]);
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockBackdropsResponse(payload: unknown) {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(payload),
    });
  }

  it('hits /api/films/<filmId>/backdrops', async () => {
    mockBackdropsResponse({ backdrops: [] });
    await getBackdrops('tt0068646');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe(
      'https://cinemagraphs.ca/api/films/tt0068646/backdrops',
    );
  });

  it('URL-encodes filmId so colons / slashes do not break the path', async () => {
    mockBackdropsResponse({ backdrops: [] });
    await getBackdrops('weird/id:with-chars');
    expect(fetchSpy.mock.calls[0][0]).toBe(
      'https://cinemagraphs.ca/api/films/weird%2Fid%3Awith-chars/backdrops',
    );
  });

  it('parses { backdrops: [...] } envelope', async () => {
    mockBackdropsResponse({
      backdrops: [
        { file_path: '/a.jpg', width: 1920, height: 1080, vote_count: 50, vote_average: 5.5 },
        { file_path: '/b.jpg', width: 1920, height: 1080, vote_count: 30, vote_average: 5.0 },
      ],
    });
    const result = await getBackdrops('tt-1');
    expect(result).toHaveLength(2);
    expect(result[0].file_path).toBe('/a.jpg');
    expect(result[1].vote_count).toBe(30);
  });

  it('parses a bare-array response (no envelope)', async () => {
    mockBackdropsResponse([
      { file_path: '/x.jpg', width: 1, height: 1, vote_count: 0, vote_average: 0 },
    ]);
    const result = await getBackdrops('tt-2');
    expect(result).toHaveLength(1);
    expect(result[0].file_path).toBe('/x.jpg');
  });

  it('returns empty array when envelope has no backdrops field', async () => {
    mockBackdropsResponse({});
    expect(await getBackdrops('tt-3')).toEqual([]);
  });

  it('throws on non-OK responses with status detail', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    });
    await expect(getBackdrops('tt-missing')).rejects.toThrow(/404/);
  });

  it('sends Authorization header when token is stored', async () => {
    tokenStore['auth_tokens'] = JSON.stringify({
      accessToken: 'jwt-abc',
      refreshToken: 'refresh-abc',
    });
    mockBackdropsResponse({ backdrops: [] });
    await getBackdrops('tt-auth');
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer jwt-abc');
  });
});
