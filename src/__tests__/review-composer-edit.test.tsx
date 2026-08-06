import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks for native modules and components must precede the import of the
// file under test so that its top-level imports resolve under Node.

const routerBackSpy = vi.hoisted(() => vi.fn());
const routerReplaceSpy = vi.hoisted(() => vi.fn());
// Mutable params so each test can choose create mode (filmId only) or edit
// mode (filmId + reviewId) before rendering.
const searchParams = vi.hoisted(() => ({
  current: { filmId: 'f1' } as { filmId: string; reviewId?: string },
}));

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  StyleSheet: { create: (s: Record<string, unknown>) => s },
  ScrollView: 'ScrollView',
  Pressable: 'Pressable',
  TextInput: 'TextInput',
  Share: { share: vi.fn() },
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Platform: { OS: 'ios', select: (o: any) => o.ios },
  Dimensions: { get: () => ({ width: 375, height: 812 }) },
}));

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Svg: 'Svg',
  Line: 'Line',
  Polyline: 'Polyline',
  Circle: 'Circle',
  Text: 'SvgText',
}));

vi.mock('@react-native-community/slider', () => ({ default: 'Slider' }));

vi.mock('expo-router', () => ({
  useRouter: () => ({
    back: routerBackSpy,
    replace: routerReplaceSpy,
  }),
  useLocalSearchParams: () => searchParams.current,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('../lib/api', () => ({
  fetchFilmDetail: vi.fn(),
  fetchReviewDetail: vi.fn(),
  submitReview: vi.fn(),
}));

vi.mock('../lib/reviewed-films', () => ({
  markReviewed: vi.fn(),
}));

import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';
import { fetchFilmDetail, fetchReviewDetail, submitReview } from '../lib/api';
import ReviewScreen from '../../app/review';

const DATA_POINTS = [
  { label: 'Opening', timeMidpoint: 10, score: 6 },
  { label: 'Midpoint', timeMidpoint: 60, score: 4 },
  { label: 'Climax', timeMidpoint: 100, score: 9 },
  { label: 'Resolution', timeMidpoint: 115, score: 7 },
];

function makeFilm(overrides: Record<string, unknown> = {}) {
  return {
    id: 'f1',
    title: 'Test Film',
    year: 2020,
    posterUrl: null,
    sentimentGraph: {
      dataPoints: DATA_POINTS,
      overallSentiment: 7.2,
    },
    filmBeats: null,
    ...overrides,
  };
}

function makeReview(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    filmId: 'f1',
    overallRating: 7.5,
    beginning: 'Strong start.',
    middle: 'Sagged a bit.',
    ending: null,
    otherThoughts: null,
    combinedText: null,
    beatRatings: { Opening: 8, Climax: 9.5 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    user: { id: 'u1', name: 'Humza', image: null },
    film: { id: 'f1', title: 'Test Film' },
    likes: { count: 0, liked: false },
    replyCount: 0,
    ...overrides,
  };
}

async function renderScreen(): Promise<ReactTestRenderer> {
  let tree: ReactTestRenderer | undefined;
  await TestRenderer.act(async () => {
    tree = TestRenderer.create(<ReviewScreen />);
  });
  if (!tree) throw new Error('renderer never assigned');
  return tree;
}

/** The slider inside the beat card whose accessible wrapper carries `label`. */
function beatSlider(tree: ReactTestRenderer, label: string) {
  const wrappers = tree.root.findAll(
    (node) =>
      node.props?.accessibilityRole === 'adjustable' &&
      node.props?.accessibilityLabel === label,
  );
  expect(wrappers).toHaveLength(1);
  return wrappers[0].findByType('Slider' as never);
}

async function moveBeat(tree: ReactTestRenderer, label: string, value: number) {
  await TestRenderer.act(async () => {
    beatSlider(tree, label).props.onValueChange(value);
  });
}

/** All Pressables whose text content is exactly `label`. */
function buttonsWithText(tree: ReactTestRenderer, label: string) {
  return tree.root.findAll((node) => {
    if (node.type !== ('Pressable' as never)) return false;
    const texts = node.findAllByType('Text' as never);
    return texts.some((t) => t.props.children === label);
  });
}

async function pressButton(tree: ReactTestRenderer, label: string) {
  const button = buttonsWithText(tree, label);
  expect(button).toHaveLength(1);
  await TestRenderer.act(async () => {
    button[0].props.onPress();
  });
}

beforeEach(() => {
  routerBackSpy.mockReset();
  routerReplaceSpy.mockReset();
  searchParams.current = { filmId: 'f1', reviewId: 'r1' };
  vi.mocked(fetchFilmDetail).mockReset().mockResolvedValue(makeFilm() as any);
  vi.mocked(fetchReviewDetail).mockReset().mockResolvedValue(makeReview() as any);
  vi.mocked(submitReview).mockReset().mockResolvedValue({});
});

describe('ReviewScreen edit mode seeding', () => {
  it('fetches the stored review and seeds rating, prose, and beat ratings', async () => {
    const tree = await renderScreen();

    expect(fetchReviewDetail).toHaveBeenCalledWith('r1');

    // Overall rating seeded from the stored review.
    const overallSlider = tree.root.findAll(
      (node) =>
        node.props?.accessibilityRole === 'adjustable' &&
        node.props?.accessibilityLabel === 'Your rating',
    );
    expect(overallSlider).toHaveLength(1);
    expect(overallSlider[0].findByType('Slider' as never).props.value).toBe(7.5);

    // Thoughts seeded from the stitched prose sections.
    const input = tree.root.findAllByType('TextInput' as never);
    expect(input).toHaveLength(1);
    expect(input[0].props.value).toBe('Strong start.\n\nSagged a bit.');

    // Stored beat ratings seeded onto their sliders.
    expect(beatSlider(tree, 'Opening').props.value).toBe(8);
    expect(beatSlider(tree, 'Climax').props.value).toBe(9.5);

    // Edit-mode copy.
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Edit your review');
    expect(json).toContain('Update review');
  });

  it('seeds only stored labels present in current beats and defaults nothing', async () => {
    // "Departed Beat" no longer exists on the film; Midpoint and Resolution
    // exist on the film but were never rated. Neither may be seeded.
    vi.mocked(fetchReviewDetail).mockResolvedValue(
      makeReview({ beatRatings: { Opening: 8, 'Departed Beat': 3 } }) as any,
    );
    const tree = await renderScreen();

    await pressButton(tree, 'Update review');

    expect(submitReview).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(submitReview).mock.calls[0][1];
    expect(payload.beatRatings).toEqual({ Opening: 8 });
  });

  it('resubmits the stored beat ratings when the edit touches no slider', async () => {
    const tree = await renderScreen();

    await pressButton(tree, 'Update review');

    expect(submitReview).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(submitReview).mock.calls[0][1];
    // Untouched edit still carries the stored assertions; omitting the field
    // would make the server write DbNull and erase them.
    expect(payload.beatRatings).toEqual({ Opening: 8, Climax: 9.5 });
    expect(payload.overallRating).toBe(7.5);
  });

  it('merges stored ratings with beats touched this session', async () => {
    const tree = await renderScreen();

    await moveBeat(tree, 'Midpoint', 3);

    await pressButton(tree, 'Update review');

    const payload = vi.mocked(submitReview).mock.calls[0][1];
    expect(payload.beatRatings).toEqual({ Opening: 8, Climax: 9.5, Midpoint: 3 });
  });

  it('shows the error state, not a blank create form, when the review fetch fails', async () => {
    vi.mocked(fetchReviewDetail).mockResolvedValue(null);
    const tree = await renderScreen();

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Could not load your review');
    // No editable form: submitting a blank form would overwrite the stored
    // review through the server's upsert.
    expect(buttonsWithText(tree, 'Update review')).toHaveLength(0);
    expect(buttonsWithText(tree, 'Submit review')).toHaveLength(0);
    expect(tree.root.findAllByType('Slider' as never)).toHaveLength(0);
  });
});

describe('ReviewScreen edit mode with stored beats but no current film beats', () => {
  beforeEach(() => {
    vi.mocked(fetchFilmDetail).mockResolvedValue(
      makeFilm({ sentimentGraph: null, filmBeats: null }) as any,
    );
  });

  it('renders read-only with the regeneration message and no submit path', async () => {
    const tree = await renderScreen();

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("This film's story beats are being regenerated");
    expect(json).toContain('7.5');
    expect(json).toContain('Strong start.');
    // No way to submit: form-b's payload has no beatRatings field, and the
    // server writes DbNull for the absent field, erasing the stored ratings.
    expect(buttonsWithText(tree, 'Preview review')).toHaveLength(0);
    expect(buttonsWithText(tree, 'Update review')).toHaveLength(0);
    expect(buttonsWithText(tree, 'Post review')).toHaveLength(0);
    expect(tree.root.findAllByType('Slider' as never)).toHaveLength(0);
    expect(tree.root.findAllByType('TextInput' as never)).toHaveLength(0);
    expect(submitReview).not.toHaveBeenCalled();
  });

  it('still allows the form-b edit when the stored review has no beat ratings', async () => {
    vi.mocked(fetchReviewDetail).mockResolvedValue(
      makeReview({ beatRatings: null }) as any,
    );
    const tree = await renderScreen();

    // Nothing stored to erase, so the no-beats edit stays editable and can
    // preview immediately (seeded content counts as content).
    await pressButton(tree, 'Preview review');
    await pressButton(tree, 'Update review');

    expect(submitReview).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(submitReview).mock.calls[0][1];
    expect('beatRatings' in payload).toBe(false);
    expect(payload.overallRating).toBe(7.5);
  });
});

describe('ReviewScreen create mode unchanged', () => {
  beforeEach(() => {
    searchParams.current = { filmId: 'f1' };
  });

  it('does not fetch a review and still omits beatRatings when nothing is touched', async () => {
    const tree = await renderScreen();

    expect(fetchReviewDetail).not.toHaveBeenCalled();

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Write your review');

    await pressButton(tree, 'Submit review');

    expect(submitReview).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(submitReview).mock.calls[0][1];
    expect('beatRatings' in payload).toBe(false);
    expect(payload.overallRating).toBe(5.5);
  });
});
