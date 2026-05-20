import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';

import { setBlindModeDefaults } from '../../lib/blind-mode';
import { BLIND_MODE_ERROR_MESSAGE } from '../film-detail/useBlindToggle';

type BlindDefaultKey = 'blindUnwatchedDefault';

interface UseBlindDefaultsToggleArgs {
  showError: (msg: string) => void;
}

/**
 * Returns a settings-toggle handler that wraps setBlindModeDefaults
 * with a selection haptic, optimistic flip, and revert + toast on
 * failure. Lives outside the screen so the failure path is unit-
 * testable without rendering the full Settings tree.
 */
export function useBlindDefaultsToggle({
  showError,
}: UseBlindDefaultsToggleArgs): (
  key: BlindDefaultKey,
  value: boolean,
  setter: (v: boolean) => void,
) => Promise<void> {
  return useCallback(
    async (key, value, setter) => {
      setter(value);
      Haptics.selectionAsync().catch(() => {});
      try {
        await setBlindModeDefaults({ [key]: value });
      } catch {
        setter(!value);
        showError(BLIND_MODE_ERROR_MESSAGE);
      }
    },
    [showError],
  );
}
