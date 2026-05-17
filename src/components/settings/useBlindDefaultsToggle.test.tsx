import { describe, it, expect, vi, beforeEach } from 'vitest';

const hapticSpy = vi.fn().mockResolvedValue(undefined);

vi.mock('expo-haptics', () => ({
  selectionAsync: (...args: unknown[]) => hapticSpy(...args),
}));

vi.mock('../../lib/blind-mode', () => ({
  setBlindModeDefaults: vi.fn(),
}));

import TestRenderer from 'react-test-renderer';
import { useBlindDefaultsToggle } from './useBlindDefaultsToggle';
import { setBlindModeDefaults } from '../../lib/blind-mode';
import { BLIND_MODE_ERROR_MESSAGE } from '../film-detail/useBlindToggle';

function setup(args: Parameters<typeof useBlindDefaultsToggle>[0]) {
  let handler:
    | ((
        key: 'blindUnwatchedDefault' | 'blindReviewedDefault',
        value: boolean,
        setter: (v: boolean) => void,
      ) => Promise<void>)
    | undefined;
  function Harness() {
    handler = useBlindDefaultsToggle(args);
    return null;
  }
  TestRenderer.act(() => {
    TestRenderer.create(<Harness />);
  });
  if (!handler) throw new Error('handler never assigned');
  return handler;
}

beforeEach(() => {
  vi.mocked(setBlindModeDefaults).mockReset();
  hapticSpy.mockClear();
});

describe('useBlindDefaultsToggle', () => {
  it('flips the setter optimistically, fires a selection haptic, and PATCHes the new value', async () => {
    vi.mocked(setBlindModeDefaults).mockResolvedValue(undefined);
    const setter = vi.fn();
    const handler = setup({ showError: vi.fn() });

    await TestRenderer.act(async () => {
      await handler('blindUnwatchedDefault', true, setter);
    });

    expect(setter).toHaveBeenCalledTimes(1);
    expect(setter).toHaveBeenNthCalledWith(1, true);
    expect(hapticSpy).toHaveBeenCalledTimes(1);
    expect(vi.mocked(setBlindModeDefaults)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(setBlindModeDefaults)).toHaveBeenCalledWith({
      blindUnwatchedDefault: true,
    });
  });

  it('on PATCH failure reverts the setter AND shows the error toast', async () => {
    vi.mocked(setBlindModeDefaults).mockRejectedValue(
      new Error('server down'),
    );
    const setter = vi.fn();
    const showError = vi.fn();
    const handler = setup({ showError });

    await TestRenderer.act(async () => {
      await handler('blindReviewedDefault', true, setter);
    });

    // First call is the optimistic flip; second call reverts.
    expect(setter).toHaveBeenCalledTimes(2);
    expect(setter).toHaveBeenNthCalledWith(1, true);
    expect(setter).toHaveBeenNthCalledWith(2, false);
    expect(showError).toHaveBeenCalledTimes(1);
    expect(showError).toHaveBeenCalledWith(BLIND_MODE_ERROR_MESSAGE);
  });

  it('reverts to true when the setter was being flipped to false and PATCH fails', async () => {
    vi.mocked(setBlindModeDefaults).mockRejectedValue(
      new Error('server down'),
    );
    const setter = vi.fn();
    const showError = vi.fn();
    const handler = setup({ showError });

    await TestRenderer.act(async () => {
      await handler('blindUnwatchedDefault', false, setter);
    });

    expect(setter).toHaveBeenNthCalledWith(1, false);
    expect(setter).toHaveBeenNthCalledWith(2, true);
    expect(showError).toHaveBeenCalledWith(BLIND_MODE_ERROR_MESSAGE);
  });

  it('does not call showError when the PATCH succeeds', async () => {
    vi.mocked(setBlindModeDefaults).mockResolvedValue(undefined);
    const setter = vi.fn();
    const showError = vi.fn();
    const handler = setup({ showError });

    await TestRenderer.act(async () => {
      await handler('blindUnwatchedDefault', true, setter);
    });

    expect(showError).not.toHaveBeenCalled();
    // Setter called once (optimistic flip), not twice (no revert).
    expect(setter).toHaveBeenCalledTimes(1);
  });

  it('swallows haptic errors silently (no platform support is non-fatal)', async () => {
    vi.mocked(setBlindModeDefaults).mockResolvedValue(undefined);
    hapticSpy.mockRejectedValueOnce(new Error('no haptics'));
    const setter = vi.fn();
    const showError = vi.fn();
    const handler = setup({ showError });

    await expect(
      TestRenderer.act(async () => {
        await handler('blindUnwatchedDefault', true, setter);
      }),
    ).resolves.toBeUndefined();
    // PATCH still happens; the toggle still flips.
    expect(setter).toHaveBeenCalledWith(true);
    expect(showError).not.toHaveBeenCalled();
  });
});
