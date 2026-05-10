import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock SecureStore so apiFetch (used in step A) can read a token without
// touching the native module. We seed it before each test that needs auth.
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

import { uploadBannerPhoto } from './banner-upload';

describe('uploadBannerPhoto', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Object.keys(tokenStore).forEach((k) => delete tokenStore[k]);
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Three-call mock: step A (clientToken POST), file:// read, step B (PUT).
  // Order matters because the wrapper hits them sequentially. Each call
  // returns a separate Response shape.
  function setupHappyPath(opts: {
    clientToken?: string;
    finalPathname?: string;
    finalUrl?: string;
  } = {}) {
    const clientToken = opts.clientToken ?? 'tok_abc_xyz';
    const finalPathname =
      opts.finalPathname ?? 'banners/user-1/123-randomsuffix.jpg';
    const finalUrl =
      opts.finalUrl ?? `https://abc.public.blob.vercel-storage.com/${finalPathname}`;

    fetchSpy
      // Step A: POST our handleUpload route
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ clientToken }),
      })
      // Read cropped file from disk (file:// URI -> Response with Blob)
      .mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['fake-jpeg-bytes'], { type: 'image/jpeg' })),
      })
      // Step B: PUT to Vercel Blob
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ url: finalUrl, pathname: finalPathname }),
      });

    return { clientToken, finalPathname, finalUrl };
  }

  it('returns the FINAL pathname + url from the PUT response, NOT the requested pathname', async () => {
    const { finalPathname, finalUrl } = setupHappyPath();
    const result = await uploadBannerPhoto({
      fileUri: 'file:///tmp/cropped.jpg',
      userId: 'user-1',
    });
    expect(result.pathname).toBe(finalPathname);
    expect(result.url).toBe(finalUrl);
  });

  it('step A POSTs the handleUpload route with the generate-client-token shape', async () => {
    setupHappyPath();
    await uploadBannerPhoto({
      fileUri: 'file:///tmp/cropped.jpg',
      userId: 'user-1',
    });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://cinemagraphs.ca/api/user/banner/upload');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.type).toBe('blob.generate-client-token');
    expect(body.payload.pathname).toMatch(/^banners\/user-1\/\d+\.jpg$/);
    expect(body.payload.clientPayload).toBeNull();
    expect(body.payload.multipart).toBe(false);
  });

  it('step A includes Authorization header from the user JWT', async () => {
    tokenStore['auth_tokens'] = JSON.stringify({
      accessToken: 'user-jwt-abc',
      refreshToken: 'user-refresh-abc',
    });
    setupHappyPath();
    await uploadBannerPhoto({
      fileUri: 'file:///tmp/cropped.jpg',
      userId: 'user-1',
    });
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers['Authorization']).toBe('Bearer user-jwt-abc');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('step B PUTs to vercel.com/api/blob with the requested pathname in query', async () => {
    setupHappyPath();
    await uploadBannerPhoto({
      fileUri: 'file:///tmp/cropped.jpg',
      userId: 'user-1',
    });
    // Step B is the third fetch (call index 2; call 1 is the file:// read).
    const [url, init] = fetchSpy.mock.calls[2];
    expect(typeof url).toBe('string');
    expect(url.startsWith('https://vercel.com/api/blob/?')).toBe(true);
    expect(url).toContain('pathname=banners%2Fuser-1%2F');
    expect(init.method).toBe('PUT');
  });

  it('step B sends the protocol headers required by Vercel Blob', async () => {
    const { clientToken } = setupHappyPath();
    await uploadBannerPhoto({
      fileUri: 'file:///tmp/cropped.jpg',
      userId: 'user-1',
    });
    const [, init] = fetchSpy.mock.calls[2];
    expect(init.headers.authorization).toBe(`Bearer ${clientToken}`);
    expect(init.headers['x-vercel-blob-access']).toBe('public');
    expect(init.headers['x-content-type']).toBe('image/jpeg');
    expect(init.headers['x-api-version']).toBe('12');
    expect(init.headers['x-api-blob-request-id']).toMatch(/^user-1:\d+:[0-9a-f]+$/);
    expect(init.headers['x-api-blob-request-attempt']).toBe('0');
  });

  it('step B uses the contentType arg when set to image/png', async () => {
    setupHappyPath();
    await uploadBannerPhoto({
      fileUri: 'file:///tmp/cropped.png',
      userId: 'user-1',
      contentType: 'image/png',
    });
    // Pathname in step A should pick up .png ext
    const stepA = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(stepA.payload.pathname).toMatch(/\.png$/);
    // Step B should advertise image/png
    expect(fetchSpy.mock.calls[2][1].headers['x-content-type']).toBe('image/png');
  });

  it('throws when step A returns a non-OK response with the server error', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Authentication required' }),
    });
    await expect(
      uploadBannerPhoto({ fileUri: 'file:///tmp/x.jpg', userId: 'user-1' }),
    ).rejects.toThrow('Authentication required');
  });

  it('throws when step A response omits clientToken', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
    await expect(
      uploadBannerPhoto({ fileUri: 'file:///tmp/x.jpg', userId: 'user-1' }),
    ).rejects.toThrow(/clientToken/);
  });

  it('throws when reading the cropped file fails', async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientToken: 'tok_x' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 0,
      });
    await expect(
      uploadBannerPhoto({ fileUri: 'file:///tmp/missing.jpg', userId: 'user-1' }),
    ).rejects.toThrow(/Failed to read cropped photo/);
  });

  it('throws with status when step B returns a non-OK response', async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientToken: 'tok_x' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob([])),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 413,
        json: () => Promise.resolve({ error: { message: 'File too large' } }),
      });
    await expect(
      uploadBannerPhoto({ fileUri: 'file:///tmp/x.jpg', userId: 'user-1' }),
    ).rejects.toThrow(/413.*File too large/);
  });

  it('throws when step B response omits url or pathname', async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientToken: 'tok_x' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob([])),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ pathname: 'banners/u/x.jpg' }), // no url
      });
    await expect(
      uploadBannerPhoto({ fileUri: 'file:///tmp/x.jpg', userId: 'user-1' }),
    ).rejects.toThrow(/url or pathname/);
  });

  it('rejects empty fileUri or userId before any network call', async () => {
    await expect(
      uploadBannerPhoto({ fileUri: '', userId: 'user-1' }),
    ).rejects.toThrow(/fileUri/);
    await expect(
      uploadBannerPhoto({ fileUri: 'file:///x.jpg', userId: '' }),
    ).rejects.toThrow(/userId/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('forwards the AbortSignal to step A and step B', async () => {
    setupHappyPath();
    const ctrl = new AbortController();
    await uploadBannerPhoto({
      fileUri: 'file:///tmp/x.jpg',
      userId: 'user-1',
      signal: ctrl.signal,
    });
    expect(fetchSpy.mock.calls[0][1].signal).toBe(ctrl.signal);
    // Call index 2 is step B; call index 1 is the file:// read which
    // does NOT take a signal in our implementation.
    expect(fetchSpy.mock.calls[2][1].signal).toBe(ctrl.signal);
  });
});
