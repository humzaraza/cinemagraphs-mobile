import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: { create: (s: Record<string, unknown>) => s },
  AccessibilityInfo: {
    announceForAccessibility: vi.fn(),
    isReduceMotionEnabled: vi.fn(async () => false),
    addEventListener: vi.fn(() => ({ remove: () => {} })),
  },
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Inline reanimated mock that invokes withTiming's completion callback
// synchronously. The shared src/test/reanimated-mock.ts does not, which
// would leave handleExitComplete unfired and stall the queue under tests.
vi.mock('react-native-reanimated', () => ({
  default: { View: 'AnimatedView' },
  useSharedValue: (initial: number) => ({ value: initial }),
  useAnimatedStyle: (cb: () => Record<string, unknown>) => cb(),
  withTiming: (
    target: number,
    _config?: unknown,
    callback?: (finished: boolean) => void,
  ) => {
    if (callback) callback(true);
    return target;
  },
  Easing: {
    in: (fn?: unknown) => fn,
    out: (fn?: unknown) => fn,
    cubic: undefined,
  },
  runOnJS: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';
import { AccessibilityInfo } from 'react-native';
import { ToastProvider, useToast } from './Toast';
import { colors } from '../../constants/theme';

const announceSpy = vi.mocked(AccessibilityInfo.announceForAccessibility);
const DEFAULT_DURATION = 4000;
const GAP_MS = 100;

type ToastApi = ReturnType<typeof useToast>;

function setup() {
  let captured: ToastApi | undefined;
  function Consumer() {
    captured = useToast();
    return null;
  }
  let tree: ReactTestRenderer | undefined;
  TestRenderer.act(() => {
    tree = TestRenderer.create(
      <ToastProvider>
        <Consumer />
      </ToastProvider>,
    );
  });
  if (!tree || !captured) throw new Error('renderer never assigned');
  return { tree, api: () => captured as ToastApi };
}

function hasMessage(tree: ReactTestRenderer, message: string): boolean {
  try {
    tree.root.findByProps({ children: message });
    return true;
  } catch {
    return false;
  }
}

function getBackgroundColor(tree: ReactTestRenderer): string | undefined {
  let view;
  try {
    view = tree.root.findByType('AnimatedView' as never);
  } catch {
    return undefined;
  }
  const style = view.props.style;
  const arr = Array.isArray(style) ? style : [style];
  for (const s of arr) {
    if (s && typeof s === 'object' && 'backgroundColor' in s) {
      return (s as { backgroundColor: string }).backgroundColor;
    }
  }
  return undefined;
}

beforeEach(() => {
  vi.useFakeTimers();
  announceSpy.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ToastProvider show + dismiss basics', () => {
  it('showError displays the toast with the message', () => {
    const { tree, api } = setup();
    TestRenderer.act(() => {
      api().showError('Network error');
    });
    expect(hasMessage(tree, 'Network error')).toBe(true);
    expect(getBackgroundColor(tree)).toBe(colors.negativeRed);
  });

  it('showSuccess displays the toast with the success variant', () => {
    const { tree, api } = setup();
    TestRenderer.act(() => {
      api().showSuccess('Saved');
    });
    expect(hasMessage(tree, 'Saved')).toBe(true);
    expect(getBackgroundColor(tree)).toBe(colors.teal);
  });

  it('show returns a unique numeric id', () => {
    const { api } = setup();
    let id1 = 0;
    let id2 = 0;
    TestRenderer.act(() => {
      id1 = api().showError('a');
      id2 = api().showError('b');
    });
    expect(typeof id1).toBe('number');
    expect(typeof id2).toBe('number');
    expect(id1).not.toBe(id2);
  });

  it('AccessibilityInfo.announceForAccessibility is called with the message on show', () => {
    const { api } = setup();
    TestRenderer.act(() => {
      api().showError('Something failed');
    });
    expect(announceSpy).toHaveBeenCalledWith('Something failed');
    expect(announceSpy).toHaveBeenCalledTimes(1);
  });
});

describe('ToastProvider queue model', () => {
  it('second show queues behind the first; only the first is visible', () => {
    const { tree, api } = setup();
    TestRenderer.act(() => {
      api().showError('first');
      api().showError('second');
    });
    expect(hasMessage(tree, 'first')).toBe(true);
    expect(hasMessage(tree, 'second')).toBe(false);
  });

  it('a 4th show on a full queue drops the oldest queued (index 1), preserving the visible', () => {
    const { tree, api } = setup();
    let visibleId = 0;
    TestRenderer.act(() => {
      visibleId = api().showError('visible');
      api().showError('queued-A');
      api().showError('queued-B');
      api().showError('newest');
    });
    expect(hasMessage(tree, 'visible')).toBe(true);

    // Dismiss the visible to advance. With overflow handling, the next
    // visible should be queued-B; queued-A was dropped at index 1.
    TestRenderer.act(() => {
      api().dismiss(visibleId);
    });
    TestRenderer.act(() => {
      vi.advanceTimersByTime(GAP_MS);
    });
    expect(hasMessage(tree, 'queued-A')).toBe(false);
    expect(hasMessage(tree, 'queued-B')).toBe(true);
  });

  it('when the visible toast auto-dismisses, the next queued toast becomes visible after a 100ms gap', () => {
    const { tree, api } = setup();
    TestRenderer.act(() => {
      api().showError('first');
      api().showError('second');
    });
    expect(hasMessage(tree, 'first')).toBe(true);
    expect(hasMessage(tree, 'second')).toBe(false);

    TestRenderer.act(() => {
      vi.advanceTimersByTime(DEFAULT_DURATION);
    });
    // Auto-dismiss fired, exit completed synchronously via the reanimated
    // mock, provider is mid-gap. First is gone, second not yet visible.
    expect(hasMessage(tree, 'first')).toBe(false);
    expect(hasMessage(tree, 'second')).toBe(false);

    TestRenderer.act(() => {
      vi.advanceTimersByTime(GAP_MS);
    });
    expect(hasMessage(tree, 'second')).toBe(true);
  });
});

describe('ToastProvider dismiss API', () => {
  it('dismiss(id) of the visible toast triggers exit and removes it', () => {
    const { tree, api } = setup();
    let id = 0;
    TestRenderer.act(() => {
      id = api().showError('hello');
    });
    expect(hasMessage(tree, 'hello')).toBe(true);

    TestRenderer.act(() => {
      api().dismiss(id);
    });
    expect(hasMessage(tree, 'hello')).toBe(false);

    TestRenderer.act(() => {
      vi.advanceTimersByTime(GAP_MS);
    });
    expect(hasMessage(tree, 'hello')).toBe(false);
  });

  it('dismiss(id) of a queued toast removes it silently without affecting the visible', () => {
    const { tree, api } = setup();
    let visibleId = 0;
    let queuedId = 0;
    TestRenderer.act(() => {
      visibleId = api().showError('visible');
      queuedId = api().showError('queued');
    });
    expect(hasMessage(tree, 'visible')).toBe(true);

    TestRenderer.act(() => {
      api().dismiss(queuedId);
    });
    expect(hasMessage(tree, 'visible')).toBe(true);

    TestRenderer.act(() => {
      api().dismiss(visibleId);
    });
    TestRenderer.act(() => {
      vi.advanceTimersByTime(GAP_MS);
    });
    expect(hasMessage(tree, 'visible')).toBe(false);
    expect(hasMessage(tree, 'queued')).toBe(false);
  });

  it('dismissAll clears the queue and dismisses the visible toast', () => {
    const { tree, api } = setup();
    TestRenderer.act(() => {
      api().showError('first');
      api().showError('second');
      api().showError('third');
    });
    expect(hasMessage(tree, 'first')).toBe(true);

    TestRenderer.act(() => {
      api().dismissAll();
    });
    TestRenderer.act(() => {
      vi.advanceTimersByTime(GAP_MS);
    });
    expect(hasMessage(tree, 'first')).toBe(false);
    expect(hasMessage(tree, 'second')).toBe(false);
    expect(hasMessage(tree, 'third')).toBe(false);
  });
});

describe('ToastProvider duration override', () => {
  it('default duration of 4000ms auto-dismisses the toast', () => {
    const { tree, api } = setup();
    TestRenderer.act(() => {
      api().showError('temporary');
    });
    expect(hasMessage(tree, 'temporary')).toBe(true);

    TestRenderer.act(() => {
      vi.advanceTimersByTime(DEFAULT_DURATION - 1);
    });
    expect(hasMessage(tree, 'temporary')).toBe(true);

    TestRenderer.act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(hasMessage(tree, 'temporary')).toBe(false);
  });

  it('custom duration auto-dismisses after the specified ms', () => {
    const { tree, api } = setup();
    TestRenderer.act(() => {
      api().showError('short', { duration: 1000 });
    });
    expect(hasMessage(tree, 'short')).toBe(true);

    TestRenderer.act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(hasMessage(tree, 'short')).toBe(true);

    TestRenderer.act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(hasMessage(tree, 'short')).toBe(false);
  });

  it('duration of 0 disables auto-dismiss (toast stays until dismiss is called)', () => {
    const { tree, api } = setup();
    let id = 0;
    TestRenderer.act(() => {
      id = api().showError('persistent', { duration: 0 });
    });
    expect(hasMessage(tree, 'persistent')).toBe(true);

    TestRenderer.act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(hasMessage(tree, 'persistent')).toBe(true);

    TestRenderer.act(() => {
      api().dismiss(id);
    });
    TestRenderer.act(() => {
      vi.advanceTimersByTime(GAP_MS);
    });
    expect(hasMessage(tree, 'persistent')).toBe(false);
  });
});
