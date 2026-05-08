import * as SecureStore from 'expo-secure-store';
import type { BannerSpec } from './onboarding-api';

// SecureStore key for the banner spec selected during onboarding. The
// future auth handler (Prompt 9) reads this on the first authenticated
// boot to apply the user's onboarding-derived banner before clearing.
const PENDING_BANNER_KEY = 'pendingBanner';

export type PendingBanner = {
  bannerType: 'BACKDROP' | 'GRADIENT';
  bannerValue: { filmId: string; backdropPath: string } | string;
};

export async function savePendingBanner(spec: BannerSpec): Promise<void> {
  const payload: PendingBanner = {
    bannerType: spec.bannerType,
    bannerValue: spec.bannerValue,
  };
  await SecureStore.setItemAsync(PENDING_BANNER_KEY, JSON.stringify(payload));
}

export async function readPendingBanner(): Promise<PendingBanner | null> {
  const raw = await SecureStore.getItemAsync(PENDING_BANNER_KEY);
  return raw ? (JSON.parse(raw) as PendingBanner) : null;
}

export async function clearPendingBanner(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_BANNER_KEY);
}
