import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('react-native', () => {
  const Animated = {
    Value: class {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(_v: number) {}
      setValue() {}
    },
    View: 'Animated.View',
    timing: () => ({ start: (cb?: () => void) => cb?.() }),
    spring: () => ({ start: (cb?: () => void) => cb?.() }),
    parallel: () => ({ start: (cb?: () => void) => cb?.() }),
  };
  return {
    View: 'View',
    Text: 'Text',
    Pressable: 'Pressable',
    StyleSheet: {
      create: (s: Record<string, unknown>) => s,
      absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    },
    Animated,
  };
});

import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';
import { BlindModeTooltip } from './BlindModeTooltip';

function render(props: React.ComponentProps<typeof BlindModeTooltip>) {
  let tree: ReactTestRenderer | undefined;
  TestRenderer.act(() => {
    tree = TestRenderer.create(<BlindModeTooltip {...props} />);
  });
  if (!tree) throw new Error('renderer never assigned');
  return tree;
}

function update(
  tree: ReactTestRenderer,
  props: React.ComponentProps<typeof BlindModeTooltip>,
) {
  TestRenderer.act(() => {
    tree.update(<BlindModeTooltip {...props} />);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('BlindModeTooltip', () => {
  it('renders nothing when visible=false', () => {
    const tree = render({
      visible: false,
      onDismiss: () => {},
      topInset: 80,
      rightInset: 16,
    });
    expect(tree.toJSON()).toBeNull();
  });

  it('renders the educational copy when visible=true', () => {
    const tree = render({
      visible: true,
      onDismiss: () => {},
      topInset: 80,
      rightInset: 16,
    });
    const tooltipText = tree.root.findByProps({
      children:
        'Blind mode is on. Scores on this page are hidden. The arc still shows the shape.',
    });
    expect(tooltipText).toBeTruthy();
  });

  it('exposes an accessibility label and the alert role for VoiceOver', () => {
    const tree = render({
      visible: true,
      onDismiss: () => {},
      topInset: 80,
      rightInset: 16,
    });
    const animated = tree.root.findByType('Animated.View' as never);
    expect(animated.props.accessibilityRole).toBe('alert');
    expect(animated.props.accessibilityLabel).toContain('Blind mode is on');
  });

  it('calls onDismiss after the 4-second auto-dismiss timer', () => {
    const onDismiss = vi.fn();
    render({ visible: true, onDismiss, topInset: 80, rightInset: 16 });

    expect(onDismiss).not.toHaveBeenCalled();

    TestRenderer.act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when the overlay is tapped (tap-anywhere)', () => {
    const onDismiss = vi.fn();
    const tree = render({
      visible: true,
      onDismiss,
      topInset: 80,
      rightInset: 16,
    });

    const overlay = tree.root.findAllByType('Pressable' as never)[0];
    TestRenderer.act(() => {
      (overlay.props.onPress as () => void)();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('fires onDismiss only once when tap and timer would both fire', () => {
    const onDismiss = vi.fn();
    const tree = render({
      visible: true,
      onDismiss,
      topInset: 80,
      rightInset: 16,
    });

    const overlay = tree.root.findAllByType('Pressable' as never)[0];
    TestRenderer.act(() => {
      (overlay.props.onPress as () => void)();
    });
    // After tap dismiss has fired, the 4s timer should not produce a
    // second onDismiss call.
    TestRenderer.act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not fire onDismiss when the timer would expire after visibility flipped to false', () => {
    const onDismiss = vi.fn();
    const tree = render({
      visible: true,
      onDismiss,
      topInset: 80,
      rightInset: 16,
    });

    // Parent toggles visible off before the timer fires; the cleanup
    // should clear the pending timeout so onDismiss never fires.
    update(tree, {
      visible: false,
      onDismiss,
      topInset: 80,
      rightInset: 16,
    });

    TestRenderer.act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
