import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const store: Record<string, string> = {};
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn((key: string) => Promise.resolve(store[key] ?? null)),
  setItemAsync: vi.fn((key: string, val: string) => {
    store[key] = val;
    return Promise.resolve();
  }),
  deleteItemAsync: vi.fn((key: string) => {
    delete store[key];
    return Promise.resolve();
  }),
}));

// We import the helpers under test AFTER the mock is registered so they
// pick up the mocked SecureStore.
import { getToken, setToken, removeToken } from './api';
import { getRecentlyViewed, addRecentlyViewed } from './recentlyViewed';

const asyncStore: Record<string, string> = {};
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(asyncStore[key] ?? null)),
    setItem: vi.fn((key: string, val: string) => {
      asyncStore[key] = val;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete asyncStore[key];
      return Promise.resolve();
    }),
  },
}));

// ---------------------------------------------------------------------------
// Token storage (SecureStore)
// ---------------------------------------------------------------------------

describe('Token storage', () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
  });

  it('returns null when no token stored', async () => {
    expect(await getToken()).toBeNull();
  });

  it('stores and retrieves a token', async () => {
    await setToken('abc123');
    expect(await getToken()).toBe('abc123');
  });

  it('removes a token', async () => {
    await setToken('abc123');
    await removeToken();
    expect(await getToken()).toBeNull();
  });

  it('overwrites a previous token', async () => {
    await setToken('first');
    await setToken('second');
    expect(await getToken()).toBe('second');
  });
});

// ---------------------------------------------------------------------------
// Input validation helpers
// ---------------------------------------------------------------------------

describe('Auth input validation', () => {
  const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  it('accepts valid emails', () => {
    expect(validEmail('user@example.com')).toBe(true);
    expect(validEmail('a+b@sub.domain.co')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(validEmail('')).toBe(false);
    expect(validEmail('noatsign')).toBe(false);
    expect(validEmail('@missing-local.com')).toBe(false);
    expect(validEmail('spaces in@this.com')).toBe(false);
  });

  it('enforces minimum password length', () => {
    const validPw = (p: string) => p.length >= 8;
    expect(validPw('short')).toBe(false);
    expect(validPw('12345678')).toBe(true);
    expect(validPw('a strong password')).toBe(true);
  });

  it('validates OTP is 6 digits', () => {
    const validOtp = (c: string) => /^\d{6}$/.test(c);
    expect(validOtp('123456')).toBe(true);
    expect(validOtp('12345')).toBe(false);
    expect(validOtp('abcdef')).toBe(false);
    expect(validOtp('1234567')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Recently viewed (AsyncStorage)
// ---------------------------------------------------------------------------

describe('Recently viewed', () => {
  beforeEach(() => {
    Object.keys(asyncStore).forEach((k) => delete asyncStore[k]);
  });

  it('returns empty array when nothing stored', async () => {
    expect(await getRecentlyViewed()).toEqual([]);
  });

  it('adds a film and retrieves it', async () => {
    await addRecentlyViewed('film-1');
    const list = await getRecentlyViewed();
    expect(list.length).toBe(1);
    expect(list[0].filmId).toBe('film-1');
  });

  it('deduplicates and moves recent film to front', async () => {
    await addRecentlyViewed('film-1');
    await addRecentlyViewed('film-2');
    await addRecentlyViewed('film-1');
    const list = await getRecentlyViewed();
    expect(list.length).toBe(2);
    expect(list[0].filmId).toBe('film-1');
    expect(list[1].filmId).toBe('film-2');
  });

  it('caps at 20 entries', async () => {
    for (let i = 1; i <= 25; i++) {
      await addRecentlyViewed(`film-${i}`);
    }
    const list = await getRecentlyViewed();
    expect(list.length).toBe(20);
    expect(list[0].filmId).toBe('film-25');
  });
});
