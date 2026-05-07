import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
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
import { ContinueButton } from './ContinueButton';

type Props = { visible: boolean; onPress: () => void; label?: string };

function render(props: Props) {
  let tree: ReactTestRenderer | undefined;
  TestRenderer.act(() => {
    tree = TestRenderer.create(<ContinueButton {...props} />);
  });
  if (!tree) throw new Error('renderer never assigned');
  return tree;
}

describe('ContinueButton', () => {
  it('renders default Continue label', () => {
    const tree = render({ visible: true, onPress: () => {} });
    const node = tree.root.findByProps({ children: 'Continue' });
    expect(node).toBeTruthy();
  });

  it('renders custom label when provided', () => {
    const tree = render({ visible: true, onPress: () => {}, label: 'Next step' });
    const node = tree.root.findByProps({ children: 'Next step' });
    expect(node).toBeTruthy();
  });

  it('onPress fires when visible=true and tapped', () => {
    const onPress = vi.fn();
    const tree = render({ visible: true, onPress });
    const button = tree.root.findByProps({ testID: 'continue-button' });
    const fire = button.props.onPress as () => void;
    TestRenderer.act(() => {
      fire();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('onPress does NOT fire when visible=false and tapped', () => {
    const onPress = vi.fn();
    const tree = render({ visible: false, onPress });
    const button = tree.root.findByProps({ testID: 'continue-button' });
    const fire = button.props.onPress as () => void;
    TestRenderer.act(() => {
      fire();
    });
    expect(onPress).not.toHaveBeenCalled();
  });
});
