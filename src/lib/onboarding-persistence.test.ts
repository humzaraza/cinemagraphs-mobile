import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('expo-secure-store', () => ({
  setItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import {
  savePendingBanner,
  readPendingBanner,
  clearPendingBanner,
} from './onboarding-persistence';
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
