import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import {
  getTokens,
  setTokens,
  removeTokens,
  getAccessToken,
  getRefreshToken,
  cleanupLegacyTokenKey,
  apiFetch,
  setOnAuthFailure,
  requestServerLogout,
  registerWithEmail,
  loginWithApple,
  loginWithGoogle,
  deleteAccount,
  fetchFilmReviews,
  fetchReviewDetail,
  fetchReviewReplies,
  postReply,
  deleteReply,
  likeReview,
  unlikeReview,
  decodeTokenExp,
  isTokenExpiredOrExpiring,
  refreshIfExpiringSoon,
} from './api';
import * as payloadCache from './payload-cache';

const TOKENS_KEY = 'auth_tokens';

beforeEach(() => {
  vi.mocked(SecureStore.getItemAsync).mockReset();
  vi.mocked(SecureStore.setItemAsync).mockReset();
  vi.mocked(SecureStore.deleteItemAsync).mockReset();
});

describe('getTokens', () => {
  it('returns null when SecureStore returns null', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    const result = await getTokens();
    expect(result).toBeNull();
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(TOKENS_KEY);
  });

  it('returns parsed TokenPair when SecureStore returns valid JSON', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({ accessToken: 'a-token', refreshToken: 'r-token' }),
    );
    const result = await getTokens();
    expect(result).toEqual({ accessToken: 'a-token', refreshToken: 'r-token' });
  });

  it('returns null on malformed JSON', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue('not-json{');
    const result = await getTokens();
    expect(result).toBeNull();
  });

  it('returns null when JSON is valid but missing accessToken', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({ refreshToken: 'r-token' }),
    );
    const result = await getTokens();
    expect(result).toBeNull();
  });

  it('returns null when JSON is valid but missing refreshToken', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({ accessToken: 'a-token' }),
    );
    const result = await getTokens();
    expect(result).toBeNull();
  });
});

describe('setTokens', () => {
  it('writes JSON-encoded pair to SecureStore under correct key', async () => {
    vi.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
    await setTokens({ accessToken: 'a-token', refreshToken: 'r-token' });
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      TOKENS_KEY,
      JSON.stringify({ accessToken: 'a-token', refreshToken: 'r-token' }),
    );
  });

  it('throws when accessToken is empty string', async () => {
    await expect(
      setTokens({ accessToken: '', refreshToken: 'r-token' }),
    ).rejects.toThrow('accessToken');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('throws when refreshToken is empty string', async () => {
    await expect(
      setTokens({ accessToken: 'a-token', refreshToken: '' }),
    ).rejects.toThrow('refreshToken');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});

describe('removeTokens', () => {
  it('calls SecureStore.deleteItemAsync with correct key', async () => {
    vi.mocked(SecureStore.deleteItemAsync).mockResolvedValue(undefined);
    await removeTokens();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(TOKENS_KEY);
  });
});

describe('getAccessToken / getRefreshToken', () => {
  it('getAccessToken returns the access token from a stored pair', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({ accessToken: 'a-token', refreshToken: 'r-token' }),
    );
    expect(await getAccessToken()).toBe('a-token');
  });

  it('getRefreshToken returns null when no pair is stored', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    expect(await getRefreshToken()).toBeNull();
  });
});

describe('cleanupLegacyTokenKey', () => {
  it('calls SecureStore.deleteItemAsync with the legacy auth_token key exactly once', async () => {
    vi.mocked(SecureStore.deleteItemAsync).mockResolvedValue(undefined);
    await cleanupLegacyTokenKey();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
  });
});

describe('apiFetch Authorization header', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('attaches Bearer access token from the new pair storage', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({ accessToken: 'a-token', refreshToken: 'r-token' }),
    );
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await apiFetch('/films');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer a-token');
  });

  it('omits the Authorization header when no tokens are stored', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await apiFetch('/films');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });
});

describe('apiFetch refresh flow', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    setOnAuthFailure(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setOnAuthFailure(null);
  });

  const storedPair = JSON.stringify({
    accessToken: 'a-token',
    refreshToken: 'r-token',
  });
  const refreshSuccessBody = JSON.stringify({
    accessToken: 'new-a-token',
    refreshToken: 'new-r-token',
  });

  function jsonResponse(body: string, status: number): Response {
    return new Response(body, {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('returns the response untouched on 200, no refresh attempt, fetch called once', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(storedPair);
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const res = await apiFetch('/films');

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const refreshCalls = fetchSpy.mock.calls.filter((c) =>
      String(c[0]).includes('/auth/mobile/refresh'),
    );
    expect(refreshCalls).toHaveLength(0);
  });

  it('returns 401 directly when no tokens are stored, no refresh attempt', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const res = await apiFetch('/user/profile');

    expect(res.status).toBe(401);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const refreshCalls = fetchSpy.mock.calls.filter((c) =>
      String(c[0]).includes('/auth/mobile/refresh'),
    );
    expect(refreshCalls).toHaveLength(0);
  });

  it('on 401 with stored tokens, refreshes and retries once with the new access token', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(storedPair);
    vi.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse(refreshSuccessBody, 200))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const res = await apiFetch('/user/profile');

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    const refreshUrl = String(fetchSpy.mock.calls[1][0]);
    expect(refreshUrl).toContain('/auth/mobile/refresh');
    const retryInit = fetchSpy.mock.calls[2][1] as RequestInit;
    const retryHeaders = retryInit.headers as Record<string, string>;
    expect(retryHeaders['Authorization']).toBe('Bearer new-a-token');
  });

  it('on refresh endpoint returning non-2xx, invokes onAuthFailure and returns the original 401', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(storedPair);
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const handler = vi.fn();
    setOnAuthFailure(handler);

    const res = await apiFetch('/user/profile');

    expect(res.status).toBe(401);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('on refresh network error, invokes onAuthFailure and returns the original 401', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(storedPair);
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockRejectedValueOnce(new Error('network down'));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const handler = vi.fn();
    setOnAuthFailure(handler);

    const res = await apiFetch('/user/profile');

    expect(res.status).toBe(401);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('three concurrent 401s share a single in-flight refresh, all retry with the same new token', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(storedPair);
    vi.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse(refreshSuccessBody, 200))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const results = await Promise.all([
      apiFetch('/films'),
      apiFetch('/user/profile'),
      apiFetch('/user/lists'),
    ]);

    for (const res of results) {
      expect(res.status).toBe(200);
    }
    expect(fetchSpy).toHaveBeenCalledTimes(7);
    const refreshCalls = fetchSpy.mock.calls.filter((c) =>
      String(c[0]).includes('/auth/mobile/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
    const retryAuthHeaders = fetchSpy.mock.calls
      .slice(4)
      .map((c) => (c[1] as RequestInit).headers as Record<string, string>)
      .map((h) => h['Authorization']);
    expect(retryAuthHeaders).toEqual([
      'Bearer new-a-token',
      'Bearer new-a-token',
      'Bearer new-a-token',
    ]);
  });

  it('a request arriving during an in-flight refresh shares the same refresh promise (slow-refresh window)', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(storedPair);
    vi.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);

    let resolveRefresh: ((response: Response) => void) | null = null;
    const refreshPending = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });

    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockReturnValueOnce(refreshPending)
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    // Fire the first two requests, then yield so they both reach
    // refreshTokensViaApi and the refresh fetch goes out.
    const p1 = apiFetch('/films');
    const p2 = apiFetch('/user/profile');
    await new Promise<void>((resolve) => setImmediate(resolve));

    // Fire the third request mid-refresh-window. With dedup it should
    // attach to the same refresh promise instead of triggering a
    // second /auth/mobile/refresh call.
    const p3 = apiFetch('/user/lists');
    await new Promise<void>((resolve) => setImmediate(resolve));

    // Resolve the refresh and let all three retries fan out.
    resolveRefresh!(jsonResponse(refreshSuccessBody, 200));

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(200);

    const refreshCalls = fetchSpy.mock.calls.filter((c) =>
      String(c[0]).includes('/auth/mobile/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);

    // All three retries must carry the rotated access token.
    const retryHeaders = fetchSpy.mock.calls
      .slice(4)
      .map((c) => (c[1] as RequestInit).headers as Record<string, string>);
    for (const h of retryHeaders) {
      expect(h['Authorization']).toBe('Bearer new-a-token');
    }
  });
});

describe('requestServerLogout', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('POSTs to /auth/mobile/logout with the refresh token and an AbortSignal', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    requestServerLogout('refresh-abc');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/mobile/logout');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ refreshToken: 'refresh-abc' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not throw or reject when the network call fails', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('network down'));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    expect(() => requestServerLogout('refresh-abc')).not.toThrow();
    // Yield to the microtask queue so the rejected fetch's .catch runs.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when given an empty refresh token', () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    requestServerLogout('');

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('signup endpoints send terms acceptance fields', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // The three signup functions call res.json() at the end, so the mocked
  // Response must carry a JSON body. The tests don't inspect the returned
  // value; an empty object is enough to keep res.json() from throwing.
  function okJsonResponse(): Response {
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('registerWithEmail POSTs to /auth/register with termsAccepted and termsVersion in the body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(okJsonResponse());
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await registerWithEmail('test@example.com', 'password123', 'Test User');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/register');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      termsAccepted: true,
      termsVersion: '2026-05-15',
    });
  });

  it('loginWithApple POSTs to /auth/mobile/apple with termsAccepted and termsVersion in the body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(okJsonResponse());
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await loginWithApple('fake-identity-token', 'Test User');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/mobile/apple');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      identityToken: 'fake-identity-token',
      fullName: 'Test User',
      termsAccepted: true,
      termsVersion: '2026-05-15',
    });
  });

  it('loginWithGoogle POSTs to /auth/mobile/google with termsAccepted and termsVersion in the body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(okJsonResponse());
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await loginWithGoogle('fake-id-token');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/mobile/google');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      idToken: 'fake-id-token',
      termsAccepted: true,
      termsVersion: '2026-05-15',
    });
  });
});

describe('fetchFilmReviews', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // Matches the wire shape of GET /api/films/[id]/reviews: the rating is
  // overallRating and prose lives in the section fields plus the
  // denormalized combinedText (the server never sends score/content).
  const sampleResponse = {
    reviews: [
      {
        id: 'r1',
        user: { id: 'u1', name: 'Other User' },
        overallRating: 8.5,
        beginning: 'A gripping open.',
        middle: null,
        ending: 'Sticks the landing.',
        otherThoughts: null,
        combinedText: 'A gripping open.\n\nSticks the landing.',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ],
    total: 1,
    myReview: {
      id: 'r-mine',
      user: { id: 'me', name: 'Me' },
      overallRating: 9.2,
      beginning: null,
      middle: null,
      ending: null,
      otherThoughts: 'My take',
      combinedText: 'My take',
      createdAt: '2026-02-01T00:00:00Z',
    },
  };

  it('omits the excludeCurrentUser query param when not requested', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(sampleResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await fetchFilmReviews('film-1');

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain('/films/film-1/reviews');
    expect(url).not.toContain('excludeCurrentUser');
  });

  it('appends ?excludeCurrentUser=true when requested', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(sampleResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await fetchFilmReviews('film-1', { excludeCurrentUser: true });

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain('/films/film-1/reviews?excludeCurrentUser=true');
  });

  it('returns the parsed body on 2xx with myReview as a top-level field', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(sampleResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const result = await fetchFilmReviews('film-1', { excludeCurrentUser: true });
    expect(result?.reviews).toHaveLength(1);
    expect(result?.total).toBe(1);
    expect(result?.myReview?.overallRating).toBe(9.2);
  });

  it('returns null on non-2xx', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const result = await fetchFilmReviews('film-1');
    expect(result).toBeNull();
  });
});

describe('deleteAccount', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    // Stored access token so apiFetch attaches Authorization and treats
    // the request as authenticated. Without this, a 401 would bypass the
    // refresh path (no stored token) and shape the error semantics
    // differently than the production call site.
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({ accessToken: 'a-token', refreshToken: 'r-token' }),
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('calls apiFetch with DELETE on /user, carrying the Bearer access token', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Account deleted' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await deleteAccount();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/user$/);
    expect(init.method).toBe('DELETE');
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer a-token');
  });

  it('resolves with no return value on a 200 ok response', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Account deleted' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const result = await deleteAccount();
    expect(result).toBeUndefined();
  });

  it('throws with the server-provided error message on a non-ok response', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: 'Too many attempts. Please try again later.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await expect(deleteAccount()).rejects.toThrow(
      'Too many attempts. Please try again later.',
    );
  });

  it('throws the default "Failed to delete account" message when the body is not JSON', async () => {
    // Empty body + a status that does not trigger apiFetch's refresh path.
    // res.json() rejects, so the .catch(() => ({})) branch fires and the
    // fallback error message is used.
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 500 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    await expect(deleteAccount()).rejects.toThrow('Failed to delete account');
  });
});

describe('review detail helpers', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    // No stored token: the review detail and replies reads are public, and
    // a null token keeps a non-ok response from entering the refresh path.
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  function stubFetch(response: Response) {
    const fetchSpy = vi.fn().mockResolvedValue(response);
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
    return fetchSpy;
  }

  describe('fetchReviewDetail', () => {
    it('GETs /reviews/:id and returns the parsed payload on 2xx', async () => {
      const payload = {
        id: 'r1',
        filmId: 'f1',
        overallRating: 8.5,
        likes: { count: 2, liked: false },
        replyCount: 3,
      };
      const fetchSpy = stubFetch(jsonResponse(payload));

      const result = await fetchReviewDetail('r1');

      expect(String(fetchSpy.mock.calls[0][0])).toMatch(/\/reviews\/r1$/);
      expect(result?.likes).toEqual({ count: 2, liked: false });
      expect(result?.replyCount).toBe(3);
    });

    it('returns null on non-2xx', async () => {
      stubFetch(new Response(null, { status: 404 }));
      expect(await fetchReviewDetail('r1')).toBeNull();
    });
  });

  describe('fetchReviewReplies', () => {
    it('GETs /reviews/:id/replies and returns the grouped payload on 2xx', async () => {
      const payload = { comments: [{ id: 'c1', children: [] }], total: 1 };
      const fetchSpy = stubFetch(jsonResponse(payload));

      const result = await fetchReviewReplies('r1');

      expect(String(fetchSpy.mock.calls[0][0])).toMatch(/\/reviews\/r1\/replies$/);
      expect(result?.total).toBe(1);
      expect(result?.comments).toHaveLength(1);
    });

    it('returns null on non-2xx', async () => {
      stubFetch(new Response(null, { status: 500 }));
      expect(await fetchReviewReplies('r1')).toBeNull();
    });
  });

  describe('postReply', () => {
    it('POSTs the body, omitting parentReplyId for a top-level comment', async () => {
      const fetchSpy = stubFetch(jsonResponse({ id: 'c1' }, 201));

      await postReply('r1', 'Nice review');

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(String(url)).toMatch(/\/reviews\/r1\/replies$/);
      expect(init.method).toBe('POST');
      expect(JSON.parse(String(init.body))).toEqual({ body: 'Nice review' });
    });

    it('includes parentReplyId when replying to a comment', async () => {
      const fetchSpy = stubFetch(jsonResponse({ id: 'c2' }, 201));

      await postReply('r1', 'Agreed', 'c1');

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(String(init.body))).toEqual({
        body: 'Agreed',
        parentReplyId: 'c1',
      });
    });

    it('throws with the server-provided error message on a non-ok response', async () => {
      stubFetch(
        jsonResponse({ error: 'Replies are limited to 2000 characters' }, 400),
      );
      await expect(postReply('r1', 'x')).rejects.toThrow(
        'Replies are limited to 2000 characters',
      );
    });
  });

  describe('deleteReply', () => {
    it('DELETEs /reviews/replies/:replyId', async () => {
      const fetchSpy = stubFetch(jsonResponse({ success: true }));

      await deleteReply('c1');

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(String(url)).toMatch(/\/reviews\/replies\/c1$/);
      expect(init.method).toBe('DELETE');
    });

    it('throws on a non-ok response', async () => {
      stubFetch(new Response(null, { status: 500 }));
      await expect(deleteReply('c1')).rejects.toThrow('Failed to delete comment');
    });
  });

  describe('likeReview / unlikeReview', () => {
    it('likeReview POSTs /reviews/:id/like and returns the { liked, count } body', async () => {
      const fetchSpy = stubFetch(jsonResponse({ liked: true, count: 5 }));

      const result = await likeReview('r1');

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(String(url)).toMatch(/\/reviews\/r1\/like$/);
      expect(init.method).toBe('POST');
      expect(result).toEqual({ liked: true, count: 5 });
    });

    it('unlikeReview DELETEs /reviews/:id/like and returns the { liked, count } body', async () => {
      const fetchSpy = stubFetch(jsonResponse({ liked: false, count: 4 }));

      const result = await unlikeReview('r1');

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(String(url)).toMatch(/\/reviews\/r1\/like$/);
      expect(init.method).toBe('DELETE');
      expect(result).toEqual({ liked: false, count: 4 });
    });

    it('likeReview throws with the server error on a non-ok response', async () => {
      stubFetch(jsonResponse({ error: 'You cannot like your own review' }, 403));
      await expect(likeReview('r1')).rejects.toThrow(
        'You cannot like your own review',
      );
    });

    it('unlikeReview throws on a non-ok response with no JSON body', async () => {
      stubFetch(new Response(null, { status: 500 }));
      await expect(unlikeReview('r1')).rejects.toThrow('Failed to unlike review');
    });
  });
});

// ---------------------------------------------------------------------------
// Proactive token refresh (expiry-aware apiFetch)
//
// Viewer-personalized PUBLIC endpoints answer 200 to an expired token
// (treated as anonymous), so the reactive 401 path never fires for them.
// apiFetch therefore decodes the token's exp locally and refreshes BEFORE
// attaching a token the server would silently reject.
// ---------------------------------------------------------------------------

// Build a structurally valid JWT whose payload carries the given exp
// (epoch seconds). The signature is garbage; only the payload segment is
// decoded client-side.
function makeJwt(expSeconds: number): string {
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: 'u1',
    exp: expSeconds,
  })}.sig`;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);
// Comfortably valid: 10 minutes out, far beyond the 30s skew window.
const validJwt = () => makeJwt(nowSeconds() + 600);
// Expired one minute ago.
const expiredJwt = () => makeJwt(nowSeconds() - 60);

describe('decodeTokenExp', () => {
  it('extracts exp from a well-formed JWT payload', () => {
    expect(decodeTokenExp(makeJwt(1234567890))).toBe(1234567890);
  });

  it('returns null for a token without a payload segment', () => {
    expect(decodeTokenExp('not-a-jwt')).toBeNull();
  });

  it('returns null for a payload that is not valid base64url JSON', () => {
    expect(decodeTokenExp('header.!!!invalid!!!.sig')).toBeNull();
  });

  it('returns null when exp is missing or not a number', () => {
    const encode = (obj: object) =>
      Buffer.from(JSON.stringify(obj)).toString('base64url');
    expect(decodeTokenExp(`h.${encode({ sub: 'u1' })}.s`)).toBeNull();
    expect(decodeTokenExp(`h.${encode({ exp: 'soon' })}.s`)).toBeNull();
  });
});

describe('isTokenExpiredOrExpiring', () => {
  it('is true for an already-expired token', () => {
    expect(isTokenExpiredOrExpiring(expiredJwt())).toBe(true);
  });

  it('is true inside the skew window (expires in 10s)', () => {
    expect(isTokenExpiredOrExpiring(makeJwt(nowSeconds() + 10))).toBe(true);
  });

  it('is false for a comfortably valid token', () => {
    expect(isTokenExpiredOrExpiring(validJwt())).toBe(false);
  });

  it('is false on decode failure (attach and let the 401 path handle it)', () => {
    expect(isTokenExpiredOrExpiring('garbage')).toBe(false);
  });
});

describe('apiFetch proactive refresh', () => {
  let originalFetch: typeof globalThis.fetch;

  interface RecordedCall {
    url: string;
    method: string;
    authorization: string | undefined;
  }

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    setOnAuthFailure(null);
    payloadCache.clearPayloadCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setOnAuthFailure(null);
    payloadCache.clearPayloadCache();
  });

  function storeTokens(accessToken: string) {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({ accessToken, refreshToken: 'refresh-1' }),
    );
    vi.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
  }

  // Route by URL instead of by call order so concurrency tests stay
  // robust: the refresh endpoint answers with a rotated pair, everything
  // else goes through `apiResponder` (default 200). Records every call.
  function installFetch(options?: {
    apiResponder?: (call: RecordedCall) => { status: number };
    refreshStatus?: number;
  }) {
    const calls: RecordedCall[] = [];
    const rotated = {
      accessToken: makeJwt(nowSeconds() + 900),
      refreshToken: 'refresh-2',
    };
    const fetchSpy = vi.fn(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const call: RecordedCall = {
        url: String(url),
        method: init?.method ?? 'GET',
        authorization: headers['Authorization'],
      };
      calls.push(call);
      if (call.url.includes('/auth/mobile/refresh')) {
        const status = options?.refreshStatus ?? 200;
        return new Response(JSON.stringify(rotated), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const status = options?.apiResponder?.(call).status ?? 200;
      return new Response(JSON.stringify({}), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
    return { calls, rotated };
  }

  const refreshCalls = (calls: RecordedCall[]) =>
    calls.filter((c) => c.url.includes('/auth/mobile/refresh'));
  const apiCalls = (calls: RecordedCall[]) =>
    calls.filter((c) => !c.url.includes('/auth/mobile/refresh'));

  it('an expired token triggers a refresh BEFORE the request, not after a 401', async () => {
    storeTokens(expiredJwt());
    const { calls, rotated } = installFetch();

    const res = await apiFetch('/films/1');
    expect(res.status).toBe(200);

    // First wire call is the refresh; the API request follows with the
    // rotated token attached. The server never had to say 401.
    expect(calls[0].url).toContain('/auth/mobile/refresh');
    expect(calls).toHaveLength(2);
    expect(apiCalls(calls)[0].authorization).toBe(
      `Bearer ${rotated.accessToken}`,
    );

    // The rotated pair is persisted.
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'auth_tokens',
      JSON.stringify(rotated),
    );
  });

  it('a valid token is attached as-is with no refresh call', async () => {
    const access = validJwt();
    storeTokens(access);
    const { calls } = installFetch();

    const res = await apiFetch('/films/1');
    expect(res.status).toBe(200);

    expect(refreshCalls(calls)).toHaveLength(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].authorization).toBe(`Bearer ${access}`);
  });

  it('concurrent calls with an expired token share ONE refresh (single-flight)', async () => {
    storeTokens(expiredJwt());
    const { calls, rotated } = installFetch();

    const results = await Promise.all([
      apiFetch('/films/1'),
      apiFetch('/films/2'),
      apiFetch('/user/profile'),
    ]);
    for (const res of results) {
      expect(res.status).toBe(200);
    }

    expect(refreshCalls(calls)).toHaveLength(1);
    expect(apiCalls(calls)).toHaveLength(3);
    // Every API request went out with the rotated token.
    for (const call of apiCalls(calls)) {
      expect(call.authorization).toBe(`Bearer ${rotated.accessToken}`);
    }
  });

  it('a decode failure falls through to existing behavior: token attached, reactive 401 path still refreshes', async () => {
    storeTokens('not-a-jwt');
    const { calls, rotated } = installFetch({
      apiResponder: (call) =>
        // The undecodable token gets attached and rejected by an
        // auth-required endpoint; the retry with the rotated token
        // succeeds.
        call.authorization === 'Bearer not-a-jwt'
          ? { status: 401 }
          : { status: 200 },
    });

    const res = await apiFetch('/user/profile');
    expect(res.status).toBe(200);

    // No proactive refresh: the FIRST wire call is the API request with
    // the undecodable token attached verbatim.
    expect(calls[0].url).not.toContain('/auth/mobile/refresh');
    expect(calls[0].authorization).toBe('Bearer not-a-jwt');
    // Then the existing 401-driven refresh and retry.
    expect(calls[1].url).toContain('/auth/mobile/refresh');
    expect(calls[2].authorization).toBe(`Bearer ${rotated.accessToken}`);
  });

  it('a decode failure with a 200 response makes no refresh call at all', async () => {
    storeTokens('not-a-jwt');
    const { calls } = installFetch();

    const res = await apiFetch('/films/1');
    expect(res.status).toBe(200);
    expect(refreshCalls(calls)).toHaveLength(0);
    expect(calls).toHaveLength(1);
  });

  it('a failed proactive refresh attaches the stale token so the 401 fallback stays reachable', async () => {
    const access = expiredJwt();
    storeTokens(access);
    const { calls } = installFetch({ refreshStatus: 500 });

    const res = await apiFetch('/films/1');
    // Public endpoint still answers 200 (anonymous); the request went out
    // with the stale token rather than being dropped.
    expect(res.status).toBe(200);
    expect(refreshCalls(calls)).toHaveLength(1);
    expect(apiCalls(calls)[0].authorization).toBe(`Bearer ${access}`);
  });

  describe('token rotation cache invalidation', () => {
    it('rotation clears viewer-dependent keys and leaves viewer-neutral keys', async () => {
      storeTokens(expiredJwt());
      installFetch();

      // Viewer-dependent payloads (potentially the anonymous variant,
      // fetched while the token was expired).
      payloadCache.set('film:42', { id: '42' });
      payloadCache.set('reviews:42:ex', { reviews: [] });
      payloadCache.set('reviews:42:all', { reviews: [] });
      payloadCache.set('review:9', { id: '9', likes: { liked: false } });
      // Viewer-neutral / auth-required payloads that must survive.
      payloadCache.set('category:drama', { films: [] });
      payloadCache.set('profile:me', { user: { id: 'u1' } });
      payloadCache.set('films:me', []);
      payloadCache.set('watchlist:me', []);
      payloadCache.set('lists:me', []);

      // Trigger the proactive refresh (which rotates the pair).
      await apiFetch('/films/42');

      expect(payloadCache.get('film:42')).toBeUndefined();
      expect(payloadCache.get('reviews:42:ex')).toBeUndefined();
      expect(payloadCache.get('reviews:42:all')).toBeUndefined();
      expect(payloadCache.get('review:9')).toBeUndefined();

      expect(payloadCache.get('category:drama')).toEqual({ films: [] });
      expect(payloadCache.get('profile:me')).toEqual({ user: { id: 'u1' } });
      expect(payloadCache.get('films:me')).toEqual([]);
      expect(payloadCache.get('watchlist:me')).toEqual([]);
      expect(payloadCache.get('lists:me')).toEqual([]);
    });

    it('a failed refresh does not touch the cache', async () => {
      storeTokens(expiredJwt());
      installFetch({ refreshStatus: 500 });

      payloadCache.set('film:42', 'cached');
      await apiFetch('/films/42');
      expect(payloadCache.get('film:42')).toBe('cached');
    });
  });

  describe('refreshIfExpiringSoon (foreground check)', () => {
    it('refreshes when the stored token is expired and returns the new pair', async () => {
      storeTokens(expiredJwt());
      const { calls, rotated } = installFetch();

      const pair = await refreshIfExpiringSoon();

      expect(pair).toEqual(rotated);
      expect(refreshCalls(calls)).toHaveLength(1);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'auth_tokens',
        JSON.stringify(rotated),
      );
    });

    it('does nothing when the stored token is still valid', async () => {
      storeTokens(validJwt());
      const { calls } = installFetch();

      const pair = await refreshIfExpiringSoon();

      expect(pair).toBeNull();
      expect(calls).toHaveLength(0);
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('does nothing when signed out (no stored tokens)', async () => {
      vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
      const { calls } = installFetch();
      expect(await refreshIfExpiringSoon()).toBeNull();
      expect(calls).toHaveLength(0);
    });
  });
});
