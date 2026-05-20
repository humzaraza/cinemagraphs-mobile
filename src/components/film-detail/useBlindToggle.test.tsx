import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/blind-mode', () => ({
  setBlindForFilm: vi.fn(),
}));

import TestRenderer from 'react-test-renderer';
import {
  useBlindToggle,
  BLIND_MODE_ERROR_MESSAGE,
} from './useBlindToggle';
import { setBlindForFilm, type BlindModeState } from '../../lib/blind-mode';

const fullyDefaultedState: BlindModeState = {
  blindUnwatchedDefault: false,
  perFilm: {},
  hasSeenBlindModeTooltip: false,
};

// Render a tiny harness that captures the toggle function so tests can
// invoke it directly. The hook is a useCallback, so we need a component
// to host it.
function setup(args: Parameters<typeof useBlindToggle>[0]) {
  let toggle: (() => Promise<void>) | undefined;
  function Harness() {
    toggle = useBlindToggle(args);
    return null;
  }
  TestRenderer.act(() => {
    TestRenderer.create(<Harness />);
  });
  if (!toggle) throw new Error('toggle never assigned');
  return toggle;
}

beforeEach(() => {
  vi.mocked(setBlindForFilm).mockReset();
});

describe('useBlindToggle', () => {
  it('flips local state optimistically before the PUT resolves', async () => {
    vi.mocked(setBlindForFilm).mockResolvedValue(undefined);
    const setBlindOverride = vi.fn();
    const toggle = setup({
      filmId: 'film-1',
      currentBlind: false,
      blindState: { ...fullyDefaultedState, hasSeenBlindModeTooltip: true },
      setBlindOverride,
      setBlindState: vi.fn(),
      setTooltipVisible: vi.fn(),
      showError: vi.fn(),
    });

    await TestRenderer.act(async () => {
      await toggle();
    });

    // First call is the optimistic flip (to true). Revert path is never
    // hit on success, so there should be no second call.
    expect(setBlindOverride).toHaveBeenCalledTimes(1);
    expect(setBlindOverride).toHaveBeenNthCalledWith(1, true);
  });

  it('on PUT failure reverts setBlindOverride AND shows the error toast', async () => {
    vi.mocked(setBlindForFilm).mockRejectedValue(new Error('server down'));
    const setBlindOverride = vi.fn();
    const showError = vi.fn();
    const toggle = setup({
      filmId: 'film-1',
      currentBlind: false,
      blindState: { ...fullyDefaultedState, hasSeenBlindModeTooltip: true },
      setBlindOverride,
      setBlindState: vi.fn(),
      setTooltipVisible: vi.fn(),
      showError,
    });

    await TestRenderer.act(async () => {
      await toggle();
    });

    expect(setBlindOverride).toHaveBeenCalledTimes(2);
    expect(setBlindOverride).toHaveBeenNthCalledWith(1, true);
    expect(setBlindOverride).toHaveBeenNthCalledWith(2, false);
    expect(showError).toHaveBeenCalledTimes(1);
    expect(showError).toHaveBeenCalledWith(BLIND_MODE_ERROR_MESSAGE);
  });

  it('on successful first-encounter activation shows the tooltip AND flips the local hasSeenBlindModeTooltip flag', async () => {
    vi.mocked(setBlindForFilm).mockResolvedValue(undefined);
    const setBlindState = vi.fn();
    const setTooltipVisible = vi.fn();
    const toggle = setup({
      filmId: 'film-1',
      currentBlind: false,
      blindState: fullyDefaultedState,
      setBlindOverride: vi.fn(),
      setBlindState,
      setTooltipVisible,
      showError: vi.fn(),
    });

    await TestRenderer.act(async () => {
      await toggle();
    });

    expect(setTooltipVisible).toHaveBeenCalledWith(true);
    expect(setBlindState).toHaveBeenCalledTimes(1);
    const newState = setBlindState.mock.calls[0][0];
    expect(newState).toEqual({
      ...fullyDefaultedState,
      hasSeenBlindModeTooltip: true,
    });
  });

  it('does NOT flip hasSeenBlindModeTooltip when the PUT fails — a subsequent successful activation can still surface the tooltip', async () => {
    // First attempt fails. Tooltip must NOT appear AND the local flag
    // must stay false so the next attempt can trigger it.
    vi.mocked(setBlindForFilm).mockRejectedValueOnce(new Error('server down'));
    const setBlindState = vi.fn();
    const setTooltipVisible = vi.fn();
    const showError = vi.fn();
    const toggle1 = setup({
      filmId: 'film-1',
      currentBlind: false,
      blindState: fullyDefaultedState,
      setBlindOverride: vi.fn(),
      setBlindState,
      setTooltipVisible,
      showError,
    });

    await TestRenderer.act(async () => {
      await toggle1();
    });

    // Critical: tooltip suppressed and flag NOT flipped on failure.
    expect(setTooltipVisible).not.toHaveBeenCalled();
    expect(setBlindState).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith(BLIND_MODE_ERROR_MESSAGE);

    // Second attempt succeeds. Because blindState still carries
    // hasSeenBlindModeTooltip=false, the tooltip should now surface.
    vi.mocked(setBlindForFilm).mockResolvedValueOnce(undefined);
    const setBlindState2 = vi.fn();
    const setTooltipVisible2 = vi.fn();
    const toggle2 = setup({
      filmId: 'film-1',
      currentBlind: false, // user is retrying from the off state
      blindState: fullyDefaultedState, // server state unchanged
      setBlindOverride: vi.fn(),
      setBlindState: setBlindState2,
      setTooltipVisible: setTooltipVisible2,
      showError: vi.fn(),
    });

    await TestRenderer.act(async () => {
      await toggle2();
    });

    expect(setTooltipVisible2).toHaveBeenCalledWith(true);
    expect(setBlindState2).toHaveBeenCalledTimes(1);
    expect(setBlindState2.mock.calls[0][0]).toEqual({
      ...fullyDefaultedState,
      hasSeenBlindModeTooltip: true,
    });
  });

  it('is a no-op when filmId is undefined (defensive: pre-load state)', async () => {
    const setBlindOverride = vi.fn();
    const showError = vi.fn();
    const toggle = setup({
      filmId: undefined,
      currentBlind: false,
      blindState: null,
      setBlindOverride,
      setBlindState: vi.fn(),
      setTooltipVisible: vi.fn(),
      showError,
    });

    await TestRenderer.act(async () => {
      await toggle();
    });

    expect(setBlindOverride).not.toHaveBeenCalled();
    expect(setBlindForFilm).not.toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
  });

  it('does not show the tooltip when blindState reports hasSeenBlindModeTooltip is already true', async () => {
    vi.mocked(setBlindForFilm).mockResolvedValue(undefined);
    const setTooltipVisible = vi.fn();
    const setBlindState = vi.fn();
    const toggle = setup({
      filmId: 'film-1',
      currentBlind: false,
      blindState: { ...fullyDefaultedState, hasSeenBlindModeTooltip: true },
      setBlindOverride: vi.fn(),
      setBlindState,
      setTooltipVisible,
      showError: vi.fn(),
    });

    await TestRenderer.act(async () => {
      await toggle();
    });

    expect(setTooltipVisible).not.toHaveBeenCalled();
    expect(setBlindState).not.toHaveBeenCalled();
  });

  it('does not show the tooltip when turning blind mode OFF (next=false), even on first encounter', async () => {
    vi.mocked(setBlindForFilm).mockResolvedValue(undefined);
    const setTooltipVisible = vi.fn();
    const toggle = setup({
      filmId: 'film-1',
      currentBlind: true, // already on
      blindState: fullyDefaultedState, // never seen tooltip
      setBlindOverride: vi.fn(),
      setBlindState: vi.fn(),
      setTooltipVisible,
      showError: vi.fn(),
    });

    await TestRenderer.act(async () => {
      await toggle();
    });

    expect(setTooltipVisible).not.toHaveBeenCalled();
  });
});
