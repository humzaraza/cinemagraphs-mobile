import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { getRecentlyViewed, addRecentlyViewed, MAX_RECENTLY_VIEWED } from './recentlyViewed';

describe('Recently viewed', () => {
  beforeEach(() => {
    Object.keys(asyncStore).forEach((k) => delete asyncStore[k]);
  });

  it('returns empty array when nothing stored', async () => {
    expect(await getRecentlyViewed()).toEqual([]);
  });

  it('adds a film and retrieves it', async () => {
    await addRecentlyViewed('film-1', 'Film 1', null);
    const list = await getRecentlyViewed();
    expect(list.length).toBe(1);
    expect(list[0].filmId).toBe('film-1');
  });

  it('deduplicates and moves recent film to front', async () => {
    await addRecentlyViewed('film-1', 'Film 1', null);
    await addRecentlyViewed('film-2', 'Film 2', null);
    await addRecentlyViewed('film-1', 'Film 1', null);
    const list = await getRecentlyViewed();
    expect(list.length).toBe(2);
    expect(list[0].filmId).toBe('film-1');
    expect(list[1].filmId).toBe('film-2');
  });

  it('caps at MAX_RECENTLY_VIEWED entries', async () => {
    const total = MAX_RECENTLY_VIEWED + 5;
    for (let i = 1; i <= total; i++) {
      await addRecentlyViewed(`film-${i}`, `Film ${i}`, null);
    }
    const list = await getRecentlyViewed();
    expect(list.length).toBe(MAX_RECENTLY_VIEWED);
    expect(list[0].filmId).toBe(`film-${total}`);
  });
});
