import { useCallback } from 'react';

import { setBlindForFilm, type BlindModeState } from '../../lib/blind-mode';

export const BLIND_MODE_ERROR_MESSAGE =
  "Couldn't update blind mode. Please try again.";

interface UseBlindToggleArgs {
  filmId: string | undefined;
  currentBlind: boolean;
  blindState: BlindModeState | null;
  setBlindOverride: (next: boolean | null) => void;
  setBlindState: (state: BlindModeState | null) => void;
  setTooltipVisible: (v: boolean) => void;
  showError: (msg: string) => void;
}

/**
 * Owns the per-film blind-mode toggle behavior: optimistic flip, server
 * PUT, revert + toast on failure, and the first-encounter tooltip
 * gating.
 *
 * The tooltip flag is deliberately NOT flipped until the PUT resolves
 * successfully. A failed activation that pre-flipped the local flag
 * would burn the user's one-shot chance to see the tooltip on a future
 * successful activation.
 *
 * Returned handler is stable across re-renders only when its inputs are
 * stable; the screen wires it to the BlindModeToggle's onToggle prop.
 */
export function useBlindToggle({
  filmId,
  currentBlind,
  blindState,
  setBlindOverride,
  setBlindState,
  setTooltipVisible,
  showError,
}: UseBlindToggleArgs): () => Promise<void> {
  return useCallback(async () => {
    if (!filmId) return;
    const next = !currentBlind;

    // Optimistic flip so the toggle feels instant.
    setBlindOverride(next);

    const eligibleForTooltip =
      next && blindState !== null && !blindState.hasSeenBlindModeTooltip;

    try {
      await setBlindForFilm(filmId, next);
      // Success path: only now is it safe to flip the tooltip-seen
      // flag and surface the tooltip. A failed PUT must leave the flag
      // false so the next successful activation can still trigger it.
      if (eligibleForTooltip && blindState) {
        setTooltipVisible(true);
        setBlindState({
          ...blindState,
          hasSeenBlindModeTooltip: true,
        });
      }
    } catch {
      setBlindOverride(!next);
      showError(BLIND_MODE_ERROR_MESSAGE);
    }
  }, [
    filmId,
    currentBlind,
    blindState,
    setBlindOverride,
    setBlindState,
    setTooltipVisible,
    showError,
  ]);
}
