import * as SecureStore from 'expo-secure-store';
import type { BannerSpec } from './onboarding-api';
import { fetchUserProfile, updateUserBanner } from './api';

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

/**
 * Reads the pendingBanner cache and applies it to the user's account
 * if the user is still on the default banner (GRADIENT/midnight).
 *
 * Returning users with a customized banner keep theirs: the cache
 * is cleared but not applied.
 *
 * Always clears the cache after running, regardless of whether the
 * banner was applied or the PATCH failed. Prevents stale state from
 * sitting in secure-store across sessions.
 *
 * Called from AuthProvider.handlePostAuth after successful sign-in/up.
 */
export async function consumePendingBanner(): Promise<void> {
  let pending: PendingBanner | null = null;
  try {
    pending = await readPendingBanner();
  } catch {
    // If the cache read fails, there's nothing to apply. Try to clear
    // anyway and exit.
    await clearPendingBanner().catch(() => {});
    return;
  }

  if (!pending) {
    return;
  }

  // Need the user's current banner state to decide whether to apply.
  // Pull a fresh profile rather than trusting the auth response shape,
  // which doesn't include banner fields.
  let profileBannerType: string | null = null;
  let profileBannerValue: string | null = null;
  try {
    const profile = await fetchUserProfile();
    if (profile?.user) {
      profileBannerType = profile.user.bannerType;
      profileBannerValue = profile.user.bannerValue;
    }
  } catch {
    // Profile fetch failed. Don't apply (we can't tell if it's safe to).
    // Cache still gets cleared below.
  }

  const isDefaultBanner =
    profileBannerType === 'GRADIENT' && profileBannerValue === 'midnight';

  if (isDefaultBanner) {
    try {
      await updateUserBanner(pending.bannerType, pending.bannerValue);
    } catch {
      // PATCH failed. Cache still cleared below; user can set banner
      // via Settings later. Don't retry; refresh storms would be worse
      // than asking the user to redo it once.
    }
  }

  // Always clear the cache. Stale pendingBanner persisting across
  // sessions is a worse UX than the rare case of a returning user
  // who genuinely wanted the new pending choice (they can set it
  // explicitly via Settings).
  await clearPendingBanner().catch(() => {});
}
