import { describe, it, expect } from 'vitest';
import { getPosterUrl, getBackdropUrl } from './tmdb-image';

// ---------------------------------------------------------------------------
// getPosterUrl: existing behaviour (light coverage, since the helper has
// shipped through PR 1a + and its core paths are exercised end-to-end by
// every poster grid).
// ---------------------------------------------------------------------------

describe('getPosterUrl', () => {
  it('returns null for missing film or path', () => {
    expect(getPosterUrl(null, 'thumbnail')).toBeNull();
    expect(getPosterUrl(undefined, 'thumbnail')).toBeNull();
    expect(getPosterUrl({ posterUrl: null, posterPath: null }, 'thumbnail')).toBeNull();
    expect(getPosterUrl({}, 'thumbnail')).toBeNull();
  });

  it('builds URL from a plain TMDB path with leading slash', () => {
    expect(getPosterUrl({ posterPath: '/abc.jpg' }, 'card')).toBe(
      'https://image.tmdb.org/t/p/w342/abc.jpg',
    );
  });

  it('rewrites the size segment of a baked-in TMDB URL', () => {
    expect(
      getPosterUrl({ posterUrl: 'https://image.tmdb.org/t/p/w185/abc.jpg' }, 'grid'),
    ).toBe('https://image.tmdb.org/t/p/w500/abc.jpg');
  });

  it('passes a non-TMDB full URL through unchanged', () => {
    expect(
      getPosterUrl({ posterUrl: 'https://example.com/avatar.png' }, 'card'),
    ).toBe('https://example.com/avatar.png');
  });
});

// ---------------------------------------------------------------------------
// getBackdropUrl (PR 1c): mirrors getPosterUrl shape but with backdrop
// sizes (thumbnail = w780 for the selection grid, preview = w1280 for
// the live preview + Profile banner).
// ---------------------------------------------------------------------------

describe('getBackdropUrl', () => {
  it('returns null for empty / null / undefined input', () => {
    expect(getBackdropUrl(null, 'thumbnail')).toBeNull();
    expect(getBackdropUrl(undefined, 'preview')).toBeNull();
    expect(getBackdropUrl('', 'preview')).toBeNull();
  });

  it('builds w780 URL for thumbnail context from a leading-slash path', () => {
    expect(getBackdropUrl('/abc.jpg', 'thumbnail')).toBe(
      'https://image.tmdb.org/t/p/w780/abc.jpg',
    );
  });

  it('builds w1280 URL for preview context from a leading-slash path', () => {
    expect(getBackdropUrl('/abc.jpg', 'preview')).toBe(
      'https://image.tmdb.org/t/p/w1280/abc.jpg',
    );
  });

  it('builds URL from a TMDB path without leading slash', () => {
    expect(getBackdropUrl('abc.jpg', 'thumbnail')).toBe(
      'https://image.tmdb.org/t/p/w780/abc.jpg',
    );
  });

  it('rewrites the size segment of a baked-in TMDB URL', () => {
    expect(
      getBackdropUrl('https://image.tmdb.org/t/p/w300/abc.jpg', 'preview'),
    ).toBe('https://image.tmdb.org/t/p/w1280/abc.jpg');
    expect(
      getBackdropUrl('https://image.tmdb.org/t/p/original/abc.jpg', 'thumbnail'),
    ).toBe('https://image.tmdb.org/t/p/w780/abc.jpg');
  });

  it('passes a non-TMDB full URL through unchanged', () => {
    expect(getBackdropUrl('https://cdn.example.com/x.jpg', 'preview')).toBe(
      'https://cdn.example.com/x.jpg',
    );
  });
});
