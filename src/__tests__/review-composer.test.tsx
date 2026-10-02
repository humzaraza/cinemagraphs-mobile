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

/** The overall rating slider, found through its accessible wrapper. */
async function moveOverall(tree: ReactTestRenderer, value: number) {
  const wrappers = tree.root.findAll(
    (node) =>
      node.props?.accessibilityRole === 'adjustable' &&
      node.props?.accessibilityLabel === 'Your rating',
  );
  expect(wrappers).toHaveLength(1);
  const slider = wrappers[0].findByType('Slider' as never);
  await TestRenderer.act(async () => {
    slider.props.onValueChange(value);
  });
}

/** The numeral rendered directly above the "Your score" label. */
function yourScoreText(tree: ReactTestRenderer): string | undefined {
  const labels = tree.root.findAll(
    (node) => node.type === ('Text' as never) && node.props.children === 'Your score',
  );
  expect(labels).toHaveLength(1);
  const card = labels[0].parent;
  if (!card) throw new Error('Your score label has no parent');
  const texts = card.findAllByType('Text' as never);
  return texts[0]?.props.children;
}

/**
 * Document-order index of the first Text node whose children equal `value`.
 * Used to pin the vertical order of the form sections.
 */
function orderOf(tree: ReactTestRenderer, value: string): number {
  const texts = tree.root.findAllByType('Text' as never);
  const index = texts.findIndex((node) => node.props.children === value);
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

/** The accessible slider wrapper for the beat card carrying `label`. */
function beatWrapper(tree: ReactTestRenderer, label: string) {
  const wrappers = tree.root.findAll(
    (node) =>
      node.props?.accessibilityRole === 'adjustable' &&
      node.props?.accessibilityLabel === label,
  );
  expect(wrappers).toHaveLength(1);
  return wrappers[0];
}

/**
 * Every string rendered inside the beat card for `label`. The slider wrapper's
 * parent is the card View, so its header (numeral / "Not rated") is in scope.
 */
function beatCardTexts(tree: ReactTestRenderer, label: string): string[] {
  const card = beatWrapper(tree, label).parent;
  if (!card) throw new Error(`beat card for ${label} has no parent`);
  return card
    .findAllByType('Text' as never)
    .flatMap((node) => {
      const children = node.props.children;
      return Array.isArray(children) ? children : [children];
    })
    .filter((child): child is string => typeof child === 'string');
}

const NUMERAL = /^\d+\.\d$/;

async function pressClear(tree: ReactTestRenderer, label: string) {
  const buttons = tree.root.findAll(
    (node) => node.props?.accessibilityLabel === `Clear your rating for ${label}`,
  );
  expect(buttons).toHaveLength(1);
  await TestRenderer.act(async () => {
    buttons[0].props.onPress();
  });
}

function counterText(tree: ReactTestRenderer): string | undefined {
  const nodes = tree.root.findAll(
    (node) =>
      node.type === ('Text' as never) &&
      typeof node.props.children === 'string' &&
      /^\d+ of \d+ rated$/.test(node.props.children),
  );
  expect(nodes.length).toBeLessThanOrEqual(1);
  return nodes[0]?.props.children;
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

describe('ReviewScreen unrated beat display', () => {
  it('renders an untouched beat as "Not rated" with no numeral', async () => {
    const tree = await renderScreen();

    const texts = beatCardTexts(tree, 'Opening');
    expect(texts).toContain('Not rated');
    expect(texts.some((t) => NUMERAL.test(t))).toBe(false);
  });

  it('renders the numeral once the user moves a beat, and drops "Not rated"', async () => {
    const tree = await renderScreen();

    await moveBeat(tree, 'Opening', 8);

    const texts = beatCardTexts(tree, 'Opening');
    expect(texts).toContain('8.0');
    expect(texts).not.toContain('Not rated');
    // A sibling beat that was not moved is unaffected.
    expect(beatCardTexts(tree, 'Midpoint')).toContain('Not rated');
  });

  it('clearing a rated beat removes it from the submitted payload', async () => {
    const tree = await renderScreen();

    await moveBeat(tree, 'Opening', 8);
    await moveBeat(tree, 'Climax', 9.5);
    await pressClear(tree, 'Climax');
    await pressSubmit(tree);

    expect(submitReview).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(submitReview).mock.calls[0][1];
    expect(payload.beatRatings).toEqual({ Opening: 8 });
  });

  it('clearing the only rated beat omits the beatRatings key entirely', async () => {
    const tree = await renderScreen();

    await moveBeat(tree, 'Opening', 8);
    await pressClear(tree, 'Opening');

    expect(beatCardTexts(tree, 'Opening')).toContain('Not rated');
    await pressSubmit(tree);

    expect(submitReview).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(submitReview).mock.calls[0][1];
    expect('beatRatings' in payload).toBe(false);
  });

  it('counts rated beats against the rendered beat total', async () => {
    const tree = await renderScreen();

    expect(counterText(tree)).toBe(`0 of ${DATA_POINTS.length} rated`);

    await moveBeat(tree, 'Midpoint', 3);

    expect(counterText(tree)).toBe(`1 of ${DATA_POINTS.length} rated`);
  });

  it('exposes an untouched beat to screen readers as "Not rated"', async () => {
    const tree = await renderScreen();

    expect(beatWrapper(tree, 'Resolution').props.accessibilityValue).toEqual({ text: 'Not rated' });

    await moveBeat(tree, 'Resolution', 7);

    expect(beatWrapper(tree, 'Resolution').props.accessibilityValue).toEqual({ text: '7.0 out of 10' });
  });
});

describe('ReviewScreen form order', () => {
  it('renders the overall rating below the story beats and above your thoughts', async () => {
    const tree = await renderScreen();

    const beats = orderOf(tree, 'STORY BEATS');
    const overall = orderOf(tree, 'Overall rating');
    const thoughts = orderOf(tree, 'YOUR THOUGHTS');

    expect(beats).toBeLessThan(overall);
    expect(overall).toBeLessThan(thoughts);
  });
});

describe('ReviewScreen blended score', () => {
  it('shows the overall rating alone when no beat was rated', async () => {
    const tree = await renderScreen();

    await moveOverall(tree, 8);
    await pressSubmit(tree);

    expect(yourScoreText(tree)).toBe('8.0');
  });

  it('shows an even blend of the rated beats and the overall rating, rounded up at .5', async () => {
    const tree = await renderScreen();

    // (0.5 * 7) + (0.5 * 7.5) = 7.25 -> 7.3
    await moveOverall(tree, 7.5);
    await moveBeat(tree, 'Opening', 7);
    await pressSubmit(tree);

    expect(yourScoreText(tree)).toBe('7.3');
    // The blend is display-only: the payload still carries both inputs.
    const payload = vi.mocked(submitReview).mock.calls[0][1];
    expect(payload.overallRating).toBe(7.5);
    expect(payload.beatRatings).toEqual({ Opening: 7 });
  });

  it('averages several rated beats before blending', async () => {
    const tree = await renderScreen();

    // mean(8, 7, 9) = 8; (0.5 * 8) + (0.5 * 6) = 7.0
    await moveOverall(tree, 6);
    await moveBeat(tree, 'Opening', 8);
    await moveBeat(tree, 'Midpoint', 7);
    await moveBeat(tree, 'Climax', 9);
    await pressSubmit(tree);

    expect(yourScoreText(tree)).toBe('7.0');
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
