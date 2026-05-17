import { describe, it, expect, vi } from 'vitest';

const pushSpy = vi.fn();

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  Pressable: 'Pressable',
  StyleSheet: { create: (s: Record<string, unknown>) => s },
}));

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Path: 'Path',
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: pushSpy }),
}));

import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';
import { SimilarFilmCard } from './SimilarFilmCard';
import type { SimilarFilm } from '../../types/film';

const baseFilm: SimilarFilm = {
  id: 'film-1',
  title: 'The Conversation',
  year: 1974,
  posterUrl: 'https://image.tmdb.org/t/p/w342/conv.jpg',
  score: 8.3,
  userHasReviewed: false,
};

function render(film: SimilarFilm) {
  let tree: ReactTestRenderer | undefined;
  TestRenderer.act(() => {
    tree = TestRenderer.create(<SimilarFilmCard film={film} />);
  });
  if (!tree) throw new Error('renderer never assigned');
  return tree;
}

describe('SimilarFilmCard', () => {
  it('renders the title and year+score line', () => {
    const tree = render(baseFilm);
    expect(tree.root.findByProps({ children: 'The Conversation' })).toBeTruthy();
    // formatScore(8.3) → "8.3"
    expect(tree.root.findByProps({ children: '1974 · 8.3' })).toBeTruthy();
  });

  it('omits the score from the meta line when score is null but still shows the year', () => {
    const tree = render({ ...baseFilm, score: null });
    expect(tree.root.findByProps({ children: '1974' })).toBeTruthy();
  });

  it('does not render the Reviewed ribbon when userHasReviewed is false', () => {
    const tree = render(baseFilm);
    const reviewedText = tree.root.findAllByProps({ children: 'reviewed' });
    expect(reviewedText).toHaveLength(0);
  });

  it('renders the Reviewed ribbon when userHasReviewed is true', () => {
    const tree = render({ ...baseFilm, userHasReviewed: true });
    const reviewedText = tree.root.findByProps({ children: 'reviewed' });
    expect(reviewedText).toBeTruthy();
  });

  it('navigates to the film detail route when tapped', () => {
    pushSpy.mockClear();
    const tree = render(baseFilm);
    const pressable = tree.root.findByType('Pressable' as never);
    TestRenderer.act(() => {
      (pressable.props.onPress as () => void)();
    });
    expect(pushSpy).toHaveBeenCalledWith('/film/film-1');
  });

  it('exposes the spec accessibility label for an unreviewed film', () => {
    const tree = render(baseFilm);
    const pressable = tree.root.findByType('Pressable' as never);
    expect(pressable.props.accessibilityRole).toBe('button');
    expect(pressable.props.accessibilityLabel).toBe(
      'The Conversation, 1974. Score 8.3.',
    );
  });

  it('appends "Reviewed." to the accessibility label when userHasReviewed is true', () => {
    const tree = render({ ...baseFilm, userHasReviewed: true });
    const pressable = tree.root.findByType('Pressable' as never);
    expect(pressable.props.accessibilityLabel).toBe(
      'The Conversation, 1974. Score 8.3. Reviewed.',
    );
  });

  it('renders the placeholder view when posterUrl is null', () => {
    const tree = render({ ...baseFilm, posterUrl: null });
    const images = tree.root.findAllByType('Image' as never);
    expect(images).toHaveLength(0);
  });

  it('renders the Image with the provided posterUrl when present', () => {
    const tree = render(baseFilm);
    const image = tree.root.findByType('Image' as never);
    expect(image.props.source).toEqual({
      uri: 'https://image.tmdb.org/t/p/w342/conv.jpg',
    });
  });
});
