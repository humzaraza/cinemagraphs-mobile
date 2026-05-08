import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchScreen3Candidates } from './onboarding-api';

describe('fetchScreen3Candidates', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('POSTs eras and genres to the screen3 endpoint with JSON body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ films: [], fallback: 'exact' }),
    });
    globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

    await fetchScreen3Candidates(['era_1990s'], ['genre_drama', 'genre_thriller']);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/onboarding/screen3-candidates');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({
      eras: ['era_1990s'],
      genres: ['genre_drama', 'genre_thriller'],
    });
  });

  it('returns the parsed JSON response on 200', async () => {
    const expected = {
      films: [
        { id: 'tt0110912', tmdbId: 680, title: 'Pulp Fiction', year: 1994, posterPath: '/x.jpg' },
      ],
      fallback: 'exact' as const,
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => expected,
    }) as unknown as typeof globalThis.fetch;

    const result = await fetchScreen3Candidates([], []);
    expect(result).toEqual(expected);
  });

  it('throws on non-2xx with status code in the error message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }) as unknown as typeof globalThis.fetch;

    await expect(fetchScreen3Candidates([], [])).rejects.toThrow('500');
  });
});
