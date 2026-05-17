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
} from './api';

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

  const sampleResponse = {
    reviews: [
      {
        id: 'r1',
        user: { id: 'u1', name: 'Other User' },
        score: 8.5,
        content: 'Great film',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ],
    total: 1,
    myReview: {
      id: 'r-mine',
      user: { id: 'me', name: 'Me' },
      score: 9.2,
      content: 'My take',
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
    expect(result?.myReview?.score).toBe(9.2);
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
