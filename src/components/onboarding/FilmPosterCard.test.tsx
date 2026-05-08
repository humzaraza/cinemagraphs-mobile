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
import { FilmPosterCard } from './FilmPosterCard';
import type { Screen3Film } from '../../lib/onboarding-api';

const film: Screen3Film = {
  id: 'tt0110912',
  tmdbId: 680,
  title: 'Pulp Fiction',
  year: 1994,
  posterPath: '/test-poster.jpg',
};

type Props = { film: Screen3Film; selected: boolean; onPress: () => void };

function render(props: Props) {
  let tree: ReactTestRenderer | undefined;
  TestRenderer.act(() => {
    tree = TestRenderer.create(<FilmPosterCard {...props} />);
  });
  if (!tree) throw new Error('renderer never assigned');
  return tree;
}

describe('FilmPosterCard', () => {
  it('renders the film title and year', () => {
    const tree = render({ film, selected: false, onPress: () => {} });
    expect(tree.root.findByProps({ children: 'Pulp Fiction' })).toBeTruthy();
    expect(tree.root.findByProps({ children: 1994 })).toBeTruthy();
  });

  it('renders the halo View regardless of selected state', () => {
    const sel = render({ film, selected: true, onPress: () => {} });
    expect(sel.root.findByProps({ testID: 'film-poster-halo' })).toBeTruthy();

    const unsel = render({ film, selected: false, onPress: () => {} });
    expect(unsel.root.findByProps({ testID: 'film-poster-halo' })).toBeTruthy();
  });

  it('renders the checkmark only when selected', () => {
    const sel = render({ film, selected: true, onPress: () => {} });
    expect(sel.root.findAllByProps({ testID: 'film-checkmark' })).toHaveLength(1);

    const unsel = render({ film, selected: false, onPress: () => {} });
    expect(unsel.root.findAllByProps({ testID: 'film-checkmark' })).toHaveLength(0);
  });

  it('tapping fires onPress', () => {
    const onPress = vi.fn();
    const tree = render({ film, selected: false, onPress });
    const pressable = tree.root.findByProps({ testID: 'film-poster-pressable' });
    const fire = pressable.props.onPress as () => void;
    TestRenderer.act(() => {
      fire();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('two consecutive renders with different selected values do not throw', () => {
    let tree: ReactTestRenderer | undefined;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <FilmPosterCard film={film} selected={false} onPress={() => {}} />,
      );
    });
    expect(() => {
      TestRenderer.act(() => {
        tree!.update(<FilmPosterCard film={film} selected={true} onPress={() => {}} />);
      });
    }).not.toThrow();
  });
});
