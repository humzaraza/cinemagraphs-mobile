import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks for native modules and components must precede the import of the
// file under test so that its top-level imports resolve under Node.

const routerBackSpy = vi.hoisted(() => vi.fn());
const routerReplaceSpy = vi.hoisted(() => vi.fn());

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
  useLocalSearchParams: () => ({ filmId: 'f1' }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('../lib/api', () => ({
  fetchFilmDetail: vi.fn(),
  submitReview: vi.fn(),
}));

vi.mock('../lib/reviewed-films', () => ({
  markReviewed: vi.fn(),
}));

import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';
import { fetchFilmDetail, submitReview } from '../lib/api';
import ReviewScreen from '../../app/review';

const DATA_POINTS = [
  { label: 'Opening', timeMidpoint: 10, score: 6 },
  { label: 'Midpoint', timeMidpoint: 60, score: 4 },
  { label: 'Climax', timeMidpoint: 100, score: 9 },
  { label: 'Resolution', timeMidpoint: 115, score: 7 },
];

function makeFilm() {
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

async function pressSubmit(tree: ReactTestRenderer) {
  const button = tree.root.findAll((node) => {
    if (node.type !== ('Pressable' as never)) return false;
    const texts = node.findAllByType('Text' as never);
    return texts.some((t) => t.props.children === 'Submit review');
  });
  expect(button).toHaveLength(1);
  await TestRenderer.act(async () => {
    button[0].props.onPress();
  });
}

function arcGraphCards(tree: ReactTestRenderer) {
  return tree.root.findAll((node) => node.props?.testID === 'arc-graph-card');
}

/** Timestamp labels along the arc's x-axis, one per rendered beat. */
function arcTimestampLabels(card: ReturnType<typeof arcGraphCards>[number]) {
  return card
    .findAllByType('SvgText' as never)
    .filter((node) => node.props.textAnchor === 'middle')
    .map((node) => node.props.children);
}

beforeEach(() => {
  routerBackSpy.mockReset();
  routerReplaceSpy.mockReset();
  vi.mocked(fetchFilmDetail).mockReset().mockResolvedValue(makeFilm() as any);
  vi.mocked(submitReview).mockReset().mockResolvedValue({});
});

describe('ReviewScreen touched-only beat submission', () => {
  it('omits the beatRatings field entirely when no slider was moved', async () => {
    const tree = await renderScreen();

    await pressSubmit(tree);

    expect(submitReview).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(submitReview).mock.calls[0][1];
    expect('beatRatings' in payload).toBe(false);
  });

  it('submits only the beats the user actually moved', async () => {
    const tree = await renderScreen();

    await moveBeat(tree, 'Opening', 8);
    await moveBeat(tree, 'Climax', 9.5);

    await pressSubmit(tree);

    expect(submitReview).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(submitReview).mock.calls[0][1];
    expect(payload.beatRatings).toEqual({ Opening: 8, Climax: 9.5 });
  });
});

describe('ReviewScreen arc reveal', () => {
  it('renders no arc when fewer than two beats were rated', async () => {
    const tree = await renderScreen();

    await moveBeat(tree, 'Midpoint', 3);
    await pressSubmit(tree);

    expect(arcGraphCards(tree)).toHaveLength(0);
    // The score still shows; only the graph is withheld.
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Your score');
    expect(json).not.toContain('Your peak');
  });

  it('renders an arc containing only the rated beats when two or more were rated', async () => {
    const tree = await renderScreen();

    await moveBeat(tree, 'Opening', 8);
    await moveBeat(tree, 'Climax', 2);
    await pressSubmit(tree);

    const cards = arcGraphCards(tree);
    expect(cards).toHaveLength(1);
    // One x-axis timestamp per rendered beat: Opening (10m), Climax (1h 40m).
    // Midpoint and Resolution were never touched and must not appear.
    expect(arcTimestampLabels(cards[0])).toEqual(['10m', '1h 40m']);
  });
});
