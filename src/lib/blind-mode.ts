/**
 * Blind mode state — server-backed user preferences for hiding scores
 * on the film detail screen.
 *
 * The server stores per user:
 *   - blindUnwatchedDefault: default blind state for films the user
 *     has not reviewed
 *   - perFilm[filmId]: an explicit override per film. If set, takes
 *     precedence over the default.
 *
 * Blind mode protects the user before they form an opinion. Once they
 * review a film that purpose is gone, so blind mode auto-lifts on
 * reviewed films: resolveBlindForFilm returns false for them unless a
 * per-film override says otherwise. The server response may still carry
 * a blindReviewedDefault field; mobile does not read it.
 *
 * Plus a one-shot flag:
 *   - hasSeenBlindModeTooltip: the first-encounter tooltip is shown
 *     once per user, ever, the first time blind mode becomes active
 *     on any film.
 *
 * This module fetches the full state once per session (cached in
 * memory), and exposes:
 *   - getBlindModeState(): cached fetch
 *   - resolveBlindForFilm(): combine perFilm[id] with the right default
 *   - setBlindForFilm(): optimistic PUT to the per-film endpoint
 *   - setBlindModeDefaults(): PATCH the user defaults
 *   - markTooltipSeen(): PATCH hasSeenBlindModeTooltip = true
 *   - clearBlindModeCache(): drop the cache, e.g. on sign-out
 */

import { apiFetch } from './api';

export interface BlindModeState {
  blindUnwatchedDefault: boolean;
  perFilm: Record<string, boolean>;
  hasSeenBlindModeTooltip: boolean;
}

let cachedState: BlindModeState | null = null;
let inFlight: Promise<BlindModeState | null> | null = null;

/**
 * Fetch blind-mode state for the current user. Cached for the session;
 * concurrent callers share a single in-flight request. Returns null on
 * failure (e.g. unauthenticated or network error) so callers can fall
 * back to "scores visible" without crashing.
 */
export async function getBlindModeState(): Promise<BlindModeState | null> {
  if (cachedState) return cachedState;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await apiFetch('/user/blind-mode');
      if (!res.ok) return null;
      const data = (await res.json()) as Partial<BlindModeState>;
      const normalized: BlindModeState = {
        blindUnwatchedDefault: !!data.blindUnwatchedDefault,
        perFilm:
          data.perFilm && typeof data.perFilm === 'object' ? data.perFilm : {},
        hasSeenBlindModeTooltip: !!data.hasSeenBlindModeTooltip,
      };
      cachedState = normalized;
      return normalized;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/**
 * Resolve whether blind mode should be ON for a given film, given the
 * server state. perFilm[id] wins if set. Otherwise a reviewed film is
 * never blind (the user has already formed an opinion), and an
 * unwatched film falls back to blindUnwatchedDefault.
 */
export function resolveBlindForFilm(
  state: BlindModeState | null,
  filmId: string,
  userHasReviewed: boolean,
): boolean {
  if (!state) return false;
  if (Object.prototype.hasOwnProperty.call(state.perFilm, filmId)) {
    return state.perFilm[filmId];
  }
  return userHasReviewed ? false : state.blindUnwatchedDefault;
}

/**
 * Persist a per-film blind override. Optimistically updates the in-
 * memory cache so subsequent reads see the new value. Throws on
 * non-2xx so the caller can revert.
 */
export async function setBlindForFilm(
  filmId: string,
  blind: boolean,
): Promise<void> {
  const res = await apiFetch(`/user/blind-mode/film/${filmId}`, {
    method: 'PUT',
    body: JSON.stringify({ isBlind: blind }),
  });
  if (!res.ok) {
    throw new Error(`Failed to update blind mode for film (${res.status})`);
  }
  if (cachedState) {
    cachedState = {
      ...cachedState,
      perFilm: { ...cachedState.perFilm, [filmId]: blind },
    };
  }
}

/**
 * Update the user's blind-mode defaults. Accepts a partial so callers
 * can flip a single toggle without sending the full state.
 */
export async function setBlindModeDefaults(
  patch: Partial<
    Pick<BlindModeState, 'blindUnwatchedDefault' | 'hasSeenBlindModeTooltip'>
  >,
): Promise<void> {
  const res = await apiFetch('/user/blind-mode/defaults', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error(`Failed to update blind mode defaults (${res.status})`);
  }
  if (cachedState) {
    cachedState = { ...cachedState, ...patch };
  }
}

/**
 * Convenience wrapper for the most common defaults patch: marking the
 * first-encounter tooltip as seen. Swallows errors because the worst
 * case is showing the tooltip one extra time.
 */
export async function markTooltipSeen(): Promise<void> {
  try {
    await setBlindModeDefaults({ hasSeenBlindModeTooltip: true });
  } catch {
    // Non-fatal. The tooltip might re-appear; that's fine.
  }
}

/**
 * Drop the in-memory cache. Call on sign-out so the next user starts
 * with a fresh fetch.
 */
export function clearBlindModeCache(): void {
  cachedState = null;
  inFlight = null;
}

/**
 * Test-only: synchronously seed the cache. Lets tests skip the network
 * fetch and exercise resolveBlindForFilm / setBlindForFilm against a
 * known state.
 */
export function __setCachedStateForTesting(
  state: BlindModeState | null,
): void {
  cachedState = state;
  inFlight = null;
}
