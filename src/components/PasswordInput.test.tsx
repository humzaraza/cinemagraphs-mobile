import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  Pressable: 'Pressable',
  StyleSheet: { create: (s: Record<string, unknown>) => s },
}));

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Path: 'Path',
  Circle: 'Circle',
  Line: 'Line',
}));

import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';
import { PasswordInput } from './PasswordInput';

function render(props: React.ComponentProps<typeof PasswordInput>) {
  let tree: ReactTestRenderer | undefined;
  TestRenderer.act(() => {
    tree = TestRenderer.create(<PasswordInput {...props} />);
  });
  if (!tree) throw new Error('renderer never assigned');
  return tree;
}

function findTextInput(tree: ReactTestRenderer) {
  return tree.root.findByType('TextInput' as never);
}

function findEyeButton(tree: ReactTestRenderer) {
  return tree.root.findByType('Pressable' as never);
}

function findRowView(tree: ReactTestRenderer) {
  return tree.root.findAllByType('View' as never)[1];
}

function flattenStyle(style: unknown): Record<string, unknown> {
  const arr = Array.isArray(style) ? style : [style];
  const out: Record<string, unknown> = {};
  for (const s of arr) {
    if (s && typeof s === 'object') Object.assign(out, s);
  }
  return out;
}

describe('PasswordInput', () => {
  it('renders the TextInput with the provided placeholder', () => {
    const tree = render({ placeholder: 'Enter your password' });
    const input = findTextInput(tree);
    expect(input.props.placeholder).toBe('Enter your password');
  });

  it('starts hidden and reveals the password on eye tap', () => {
    const tree = render({ placeholder: 'pw' });

    expect(findTextInput(tree).props.secureTextEntry).toBe(true);

    const eye = findEyeButton(tree);
    TestRenderer.act(() => {
      (eye.props.onPress as () => void)();
    });

    expect(findTextInput(tree).props.secureTextEntry).toBe(false);
  });

  it('renders the error text and applies the error border when error is set', () => {
    const tree = render({ placeholder: 'pw', error: 'Wrong password' });

    const errorNode = tree.root.findByProps({ children: 'Wrong password' });
    expect(errorNode).toBeTruthy();

    const row = findRowView(tree);
    const flat = flattenStyle(row.props.style);
    expect(flat.borderColor).toBe('rgba(224,85,85,0.6)');
  });
});
