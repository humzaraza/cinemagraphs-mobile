import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('expo-secure-store', () => ({
  setItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

vi.mock('./api', () => ({
  fetchUserProfile: vi.fn(),
  updateUserBanner: vi.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import {
  savePendingBanner,
  readPendingBanner,
  clearPendingBanner,
  consumePendingBanner,
} from './onboarding-persistence';
import { fetchUserProfile, updateUserBanner } from './api';
import type { BannerSpec } from './onboarding-api';

describe('onboarding-persistence', () => {
  beforeEach(() => {
    vi.mocked(SecureStore.setItemAsync).mockReset();
    vi.mocked(SecureStore.getItemAsync).mockReset();
    vi.mocked(SecureStore.deleteItemAsync).mockReset();
  });

  it('saves a BACKDROP spec as JSON under the pendingBanner key', async () => {
    const spec: BannerSpec = {
      bannerType: 'BACKDROP',
      bannerValue: { filmId: 'tt0110912', backdropPath: '/abc.jpg' },
      source: 'screen3',
    };
    await savePendingBanner(spec);
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    const [key, value] = vi.mocked(SecureStore.setItemAsync).mock.calls[0];
    expect(key).toBe('pendingBanner');
    expect(JSON.parse(value as string)).toEqual({
      bannerType: 'BACKDROP',
      bannerValue: { filmId: 'tt0110912', backdropPath: '/abc.jpg' },
    });
  });

  it('saves a GRADIENT spec stripped of the source field', async () => {
    const spec: BannerSpec = {
      bannerType: 'GRADIENT',
      bannerValue: 'ember',
      source: 'gradient-fallback',
    };
    await savePendingBanner(spec);
    const [, value] = vi.mocked(SecureStore.setItemAsync).mock.calls[0];
    const parsed = JSON.parse(value as string);
    expect(parsed).toEqual({ bannerType: 'GRADIENT', bannerValue: 'ember' });
    expect(parsed.source).toBeUndefined();
  });

  it('reads and parses the persisted banner', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(
      JSON.stringify({ bannerType: 'GRADIENT', bannerValue: 'midnight' }),
    );
    const result = await readPendingBanner();
    expect(result).toEqual({ bannerType: 'GRADIENT', bannerValue: 'midnight' });
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('pendingBanner');
  });

  it('returns null when no pending banner is stored', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
    const result = await readPendingBanner();
    expect(result).toBeNull();
  });

  it('clears the persisted banner', async () => {
    await clearPendingBanner();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('pendingBanner');
  });
});

describe('consumePendingBanner', () => {
  beforeEach(() => {
    vi.mocked(SecureStore.getItemAsync).mockReset();
    vi.mocked(SecureStore.setItemAsync).mockReset();
    vi.mocked(SecureStore.deleteItemAsync).mockReset();
    vi.mocked(fetchUserProfile).mockReset();
    vi.mocked(updateUserBanner).mockReset();
  });

  const pendingBackdrop = {
    bannerType: 'BACKDROP' as const,
    bannerValue: { filmId: 'tt0110912', backdropPath: '/abc.jpg' },
  };

  function profileWithBanner(bannerType: string, bannerValue: string) {
    return {
      user: {
        id: 'u1',
        name: null,
        username: null,
        bio: null,
        image: null,
        bannerType,
        bannerValue,
      },
      stats: { reviewCount: 0, followingCount: 0, followerCount: 0 },
      recentReviews: [],
      lists: [],
    } as unknown as Awaited<ReturnType<typeof fetchUserProfile>>;
  }

  it('is a no-op when nothing is in the cache', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);

    await consumePendingBanner();

    expect(fetchUserProfile).not.toHaveBeenCalled();
    expect(updateUserBanner).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('applies the pending banner and clears the cache when the user is on the default GRADIENT/midnight', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(
      JSON.stringify(pendingBackdrop),
    );
    vi.mocked(fetchUserProfile).mockResolvedValueOnce(
      profileWithBanner('GRADIENT', 'midnight'),
    );
    vi.mocked(updateUserBanner).mockResolvedValueOnce(undefined);
    vi.mocked(SecureStore.deleteItemAsync).mockResolvedValueOnce(undefined);

    await consumePendingBanner();

    expect(updateUserBanner).toHaveBeenCalledTimes(1);
    expect(updateUserBanner).toHaveBeenCalledWith(
      pendingBackdrop.bannerType,
      pendingBackdrop.bannerValue,
    );
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('pendingBanner');
  });

  it('skips the apply but still clears the cache when the user already has a customized banner', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(
      JSON.stringify(pendingBackdrop),
    );
    vi.mocked(fetchUserProfile).mockResolvedValueOnce(
      profileWithBanner('PHOTO', 'banners/u1/123.jpg'),
    );
    vi.mocked(SecureStore.deleteItemAsync).mockResolvedValueOnce(undefined);

    await consumePendingBanner();

    expect(updateUserBanner).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('pendingBanner');
  });

  it('does not apply when the profile fetch fails, and still clears the cache', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(
      JSON.stringify(pendingBackdrop),
    );
    vi.mocked(fetchUserProfile).mockRejectedValueOnce(new Error('500'));
    vi.mocked(SecureStore.deleteItemAsync).mockResolvedValueOnce(undefined);

    await consumePendingBanner();

    expect(updateUserBanner).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('pendingBanner');
  });

  it('clears the cache and does not throw when updateUserBanner fails', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(
      JSON.stringify(pendingBackdrop),
    );
    vi.mocked(fetchUserProfile).mockResolvedValueOnce(
      profileWithBanner('GRADIENT', 'midnight'),
    );
    vi.mocked(updateUserBanner).mockRejectedValueOnce(new Error('PATCH 500'));
    vi.mocked(SecureStore.deleteItemAsync).mockResolvedValueOnce(undefined);

    await expect(consumePendingBanner()).resolves.toBeUndefined();

    expect(updateUserBanner).toHaveBeenCalledTimes(1);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('pendingBanner');
  });
});
