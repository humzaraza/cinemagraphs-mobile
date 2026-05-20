import { describe, it, expect, vi } from 'vitest';

// Native modules and hooks must be mocked before importing the screen so
// its top-level imports resolve under Node (vitest runs on Node, not RN).

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  ScrollView: 'ScrollView',
  Pressable: 'Pressable',
  Switch: 'Switch',
  StyleSheet: { create: (s: Record<string, unknown>) => s },
}));

vi.mock('react-native-svg', () => ({ default: 'Svg', Path: 'Path' }));

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('../providers/AuthProvider', () => ({
  useAuth: () => ({
    signOut: vi.fn(),
    user: { name: 'Test User', email: 'test@example.com', image: null },
  }),
}));

vi.mock('../lib/api', () => ({
  fetchUserSettings: vi.fn().mockResolvedValue(null),
  updateUserSettings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/blind-mode', () => ({
  getBlindModeState: vi.fn().mockResolvedValue(null),
}));

vi.mock('../components/settings/useBlindDefaultsToggle', () => ({
  useBlindDefaultsToggle: () => () => Promise.resolve(),
}));

vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({ showError: vi.fn() }),
}));

import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';
import SettingsScreen from '../../app/settings/index';

function render(): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  TestRenderer.act(() => {
    tree = TestRenderer.create(<SettingsScreen />);
  });
  if (!tree) throw new Error('renderer never assigned');
  return tree;
}

function textLabels(tree: ReactTestRenderer): string[] {
  return tree.root
    .findAllByType('Text' as never)
    .map((node) => node.props.children)
    .filter((child): child is string => typeof child === 'string');
}

describe('SettingsScreen blind-mode toggle', () => {
  it('renders exactly one blind-mode toggle, labeled "Hide scores until I review"', () => {
    const tree = render();

    const blindLabels = textLabels(tree).filter(
      (label) => label === 'Hide scores until I review',
    );
    expect(blindLabels).toHaveLength(1);

    // The label sits inside a ToggleRow, so its row must hold a Switch.
    const labelNode = tree.root
      .findAllByType('Text' as never)
      .find((node) => node.props.children === 'Hide scores until I review');
    expect(labelNode).toBeDefined();
    expect(labelNode!.parent!.findAllByType('Switch' as never)).toHaveLength(1);
  });

  it('no longer renders the reviewed-films blind toggle', () => {
    const tree = render();

    // Both pre-redesign blind toggles were labeled "Always blind ...".
    // Blind mode now auto-lifts on review, so neither label should exist.
    const staleLabels = textLabels(tree).filter((label) =>
      label.includes('Always blind'),
    );
    expect(staleLabels).toEqual([]);
  });
});
