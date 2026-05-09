import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  Pressable: 'Pressable',
  StyleSheet: {
    create: (s: Record<string, unknown>) => s,
    hairlineWidth: 1,
    absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  },
}));

vi.mock('react-native-reanimated', async () => {
  const { createReanimatedMock } = await import('../../test/reanimated-mock');
  return createReanimatedMock();
});

import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';
import { MosaicBlock } from './MosaicBlock';
import { ERA_BLOCKS } from '../../data/onboardingCuration';
import { colors } from '../../constants/theme';

const block = ERA_BLOCKS[0];
const noop = () => {};

function flatten(style: unknown): Record<string, unknown> {
  if (!style) return {};
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean).map(flatten));
  }
  return style as Record<string, unknown>;
}

type Props = {
  block: typeof block;
  selected: boolean;
  atCap: boolean;
  onPress: () => void;
  onCapHit?: () => void;
};

function render(props: Props) {
  let tree: ReactTestRenderer | undefined;
  TestRenderer.act(() => {
    tree = TestRenderer.create(<MosaicBlock {...props} />);
  });
  if (!tree) throw new Error('renderer never assigned');
  return tree;
}

describe('MosaicBlock', () => {
  it('renders the block label text', () => {
    const tree = render({ block, selected: false, atCap: false, onPress: noop });
    const label = tree.root.findByProps({ children: block.label });
    expect(label).toBeTruthy();
  });

  it('label color is gold when selected', () => {
    const tree = render({ block, selected: true, atCap: false, onPress: noop });
    const label = tree.root.findByProps({ children: block.label });
    expect(flatten(label.props.style).color).toBe(colors.gold);
  });

  it('label color is ivory when unselected', () => {
    const tree = render({ block, selected: false, atCap: false, onPress: noop });
    const label = tree.root.findByProps({ children: block.label });
    expect(flatten(label.props.style).color).toBe(colors.ivory);
  });

  it('atCap=true && !selected: tap fires onCapHit and not onPress', () => {
    const onPress = vi.fn();
    const onCapHit = vi.fn();
    const tree = render({ block, selected: false, atCap: true, onPress, onCapHit });
    const pressable = tree.root.findByProps({ testID: 'mosaic-block-pressable' });
    const fire = pressable.props.onPress as () => void;
    TestRenderer.act(() => {
      fire();
    });
    expect(onCapHit).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('atCap=true && selected=true: tap fires onPress (deselect path)', () => {
    const onPress = vi.fn();
    const onCapHit = vi.fn();
    const tree = render({ block, selected: true, atCap: true, onPress, onCapHit });
    const pressable = tree.root.findByProps({ testID: 'mosaic-block-pressable' });
    const fire = pressable.props.onPress as () => void;
    TestRenderer.act(() => {
      fire();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onCapHit).not.toHaveBeenCalled();
  });

  it('halo View renders when selected=true', () => {
    const tree = render({ block, selected: true, atCap: false, onPress: noop });
    const halo = tree.root.findByProps({ testID: 'mosaic-halo' });
    expect(halo).toBeTruthy();
  });

  it('halo View renders when selected=false (always rendered, opacity-driven)', () => {
    const tree = render({ block, selected: false, atCap: false, onPress: noop });
    const halo = tree.root.findByProps({ testID: 'mosaic-halo' });
    expect(halo).toBeTruthy();
  });

  it('atCap=false: tap fires onPress regardless of selected state', () => {
    const onPressUnselected = vi.fn();
    const tree1 = render({ block, selected: false, atCap: false, onPress: onPressUnselected });
    const fire1 = tree1.root.findByProps({ testID: 'mosaic-block-pressable' }).props
      .onPress as () => void;
    TestRenderer.act(() => {
      fire1();
    });
    expect(onPressUnselected).toHaveBeenCalledTimes(1);

    const onPressSelected = vi.fn();
    const tree2 = render({ block, selected: true, atCap: false, onPress: onPressSelected });
    const fire2 = tree2.root.findByProps({ testID: 'mosaic-block-pressable' }).props
      .onPress as () => void;
    TestRenderer.act(() => {
      fire2();
    });
    expect(onPressSelected).toHaveBeenCalledTimes(1);
  });
});
