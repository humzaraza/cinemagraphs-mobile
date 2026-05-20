import { describe, it, expect, vi, beforeEach } from 'vitest';

const hapticSpy = vi.fn().mockResolvedValue(undefined);

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (s: Record<string, unknown>) => s },
}));

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Path: 'Path',
  Circle: 'Circle',
}));

vi.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => hapticSpy(...args),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
}));

import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';
import { BlindModeToggle } from './BlindModeToggle';

function render(props: React.ComponentProps<typeof BlindModeToggle>) {
  let tree: ReactTestRenderer | undefined;
  TestRenderer.act(() => {
    tree = TestRenderer.create(<BlindModeToggle {...props} />);
  });
  if (!tree) throw new Error('renderer never assigned');
  return tree;
}

function flatten(style: unknown): Record<string, unknown> {
  const arr = Array.isArray(style) ? style : [style];
  const out: Record<string, unknown> = {};
  for (const s of arr) {
    if (s && typeof s === 'object') Object.assign(out, s);
  }
  return out;
}

beforeEach(() => {
  hapticSpy.mockClear();
});

describe('BlindModeToggle', () => {
  it('renders the Eye SVG (default state) when blind=false', () => {
    const tree = render({ blind: false, onToggle: () => {} });
    // Default Eye icon: viewBox 24, single Circle (the iris).
    const circles = tree.root.findAllByType('Circle' as never);
    expect(circles).toHaveLength(1);
  });

  it('renders the EyeOff SVG (4 Paths, no Circle) when blind=true', () => {
    const tree = render({ blind: true, onToggle: () => {} });
    const circles = tree.root.findAllByType('Circle' as never);
    expect(circles).toHaveLength(0);
    const paths = tree.root.findAllByType('Path' as never);
    expect(paths).toHaveLength(4);
  });

  it('applies the active (gold fill) style when blind=true', () => {
    const tree = render({ blind: true, onToggle: () => {} });
    const pressable = tree.root.findByType('Pressable' as never);
    const flat = flatten(pressable.props.style);
    expect(flat.backgroundColor).toBe('#C8A951');
  });

  it('does not apply the active style when blind=false', () => {
    const tree = render({ blind: false, onToggle: () => {} });
    const pressable = tree.root.findByType('Pressable' as never);
    const flat = flatten(pressable.props.style);
    expect(flat.backgroundColor).toBe('rgba(200,169,81,0.15)');
  });

  it('fires a Light haptic and the onToggle callback when tapped', () => {
    const onToggle = vi.fn();
    const tree = render({ blind: false, onToggle });
    const pressable = tree.root.findByType('Pressable' as never);

    TestRenderer.act(() => {
      (pressable.props.onPress as () => void)();
    });

    expect(hapticSpy).toHaveBeenCalledTimes(1);
    expect(hapticSpy).toHaveBeenCalledWith('Light');
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('exposes the spec accessibility label for the off state', () => {
    const tree = render({ blind: false, onToggle: () => {} });
    const pressable = tree.root.findByType('Pressable' as never);
    expect(pressable.props.accessibilityRole).toBe('button');
    expect(pressable.props.accessibilityLabel).toBe(
      'Blind mode, off. Double-tap to hide score.',
    );
  });

  it('exposes the spec accessibility label for the on state', () => {
    const tree = render({ blind: true, onToggle: () => {} });
    const pressable = tree.root.findByType('Pressable' as never);
    expect(pressable.props.accessibilityLabel).toBe(
      'Blind mode, on. Double-tap to show score.',
    );
  });
});
