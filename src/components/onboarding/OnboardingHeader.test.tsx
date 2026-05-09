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

import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';
import { OnboardingHeader } from './OnboardingHeader';

type Props = {
  title: string;
  onSkip: () => void;
  skipLabel?: string;
  helper?: string;
  onBack?: () => void;
};

function render(props: Props) {
  let tree: ReactTestRenderer | undefined;
  TestRenderer.act(() => {
    tree = TestRenderer.create(<OnboardingHeader {...props} />);
  });
  if (!tree) throw new Error('renderer never assigned');
  return tree;
}

describe('OnboardingHeader', () => {
  it('renders the title text', () => {
    const tree = render({ title: 'Pick the eras', onSkip: () => {} });
    const titleNode = tree.root.findByProps({ children: 'Pick the eras' });
    expect(titleNode).toBeTruthy();
  });

  it('renders default Skip label when skipLabel is not provided', () => {
    const tree = render({ title: 'X', onSkip: () => {} });
    const skip = tree.root.findByProps({ children: 'Skip' });
    expect(skip).toBeTruthy();
  });

  it('renders custom skipLabel when provided', () => {
    const tree = render({ title: 'X', onSkip: () => {}, skipLabel: 'Maybe later' });
    const skip = tree.root.findByProps({ children: 'Maybe later' });
    expect(skip).toBeTruthy();
  });

  it('tapping Skip fires onSkip exactly once', () => {
    const onSkip = vi.fn();
    const tree = render({ title: 'X', onSkip });
    const pressable = tree.root.findByProps({ testID: 'onboarding-skip' });
    const fire = pressable.props.onPress as () => void;
    TestRenderer.act(() => {
      fire();
    });
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('tapping the title area does NOT fire onSkip', () => {
    const onSkip = vi.fn();
    const tree = render({ title: 'X', onSkip });
    const titleNode = tree.root.findByProps({ children: 'X' });
    expect(titleNode.props.onPress).toBeUndefined();
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('renders helper text when helper prop is provided', () => {
    const tree = render({ title: 'X', onSkip: () => {}, helper: 'helpful copy here' });
    const helperNode = tree.root.findByProps({ testID: 'onboarding-helper' });
    expect(helperNode.props.children).toBe('helpful copy here');
  });

  it('does NOT render helper text when helper prop is omitted', () => {
    const tree = render({ title: 'X', onSkip: () => {} });
    const matches = tree.root.findAllByProps({ testID: 'onboarding-helper' });
    expect(matches).toHaveLength(0);
  });

  it('renders the back chevron when onBack is provided', () => {
    const tree = render({ title: 'X', onSkip: () => {}, onBack: () => {} });
    const chevron = tree.root.findByProps({ testID: 'onboarding-back-chevron' });
    expect(chevron).toBeTruthy();
  });

  it('does NOT render the back chevron when onBack is omitted', () => {
    const tree = render({ title: 'X', onSkip: () => {} });
    const matches = tree.root.findAllByProps({ testID: 'onboarding-back-chevron' });
    expect(matches).toHaveLength(0);
  });

  it('tapping the back chevron fires onBack exactly once', () => {
    const onBack = vi.fn();
    const tree = render({ title: 'X', onSkip: () => {}, onBack });
    const chevron = tree.root.findByProps({ testID: 'onboarding-back-chevron' });
    const fire = chevron.props.onPress as () => void;
    TestRenderer.act(() => {
      fire();
    });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('tapping the back chevron does NOT fire onSkip', () => {
    const onSkip = vi.fn();
    const onBack = vi.fn();
    const tree = render({ title: 'X', onSkip, onBack });
    const chevron = tree.root.findByProps({ testID: 'onboarding-back-chevron' });
    const fire = chevron.props.onPress as () => void;
    TestRenderer.act(() => {
      fire();
    });
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });
});
