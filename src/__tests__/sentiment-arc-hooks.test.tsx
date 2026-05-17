import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks for native modules and components must precede the import of the file
// under test so that its top-level imports resolve under Node.

vi.mock('react-native', () => {
  class AnimatedValue {
    private value: number;
    constructor(value: number) {
      this.value = value;
    }
    setValue(v: number) {
      this.value = v;
    }
    interpolate() {
      return this;
    }
  }
  const noopAnim = { start: (cb?: () => void) => cb?.() };
  const Animated = {
    Value: AnimatedValue,
    View: 'AnimatedView',
    timing: () => noopAnim,
    spring: () => noopAnim,
    parallel: () => noopAnim,
    sequence: () => noopAnim,
    loop: () => ({ start: () => {}, stop: () => {} }),
  };
  return {
    View: 'View',
    Text: 'Text',
    Image: 'Image',
    StyleSheet: {
      create: (s: Record<string, unknown>) => s,
      hairlineWidth: 1,
      absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    },
    ScrollView: 'ScrollView',
    FlatList: 'FlatList',
    Pressable: 'Pressable',
    Animated,
    Dimensions: { get: () => ({ width: 375, height: 812 }) },
    TextInput: 'TextInput',
    PanResponder: { create: () => ({ panHandlers: {} }) },
  };
});

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Svg: 'Svg',
  Circle: 'Circle',
  Line: 'Line',
  Text: 'SvgText',
  Path: 'Path',
}));

vi.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
vi.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));
vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useLocalSearchParams: () => ({ id: 'test-film' }),
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('../lib/api', () => ({
  fetchFilmDetail: vi.fn(),
  fetchFilmReviews: vi.fn(),
  fetchUserLists: vi.fn(),
  fetchUserWatchlist: vi.fn(),
  addToWatchlist: vi.fn(),
  removeFromWatchlist: vi.fn(),
  addFilmToListAPI: vi.fn(),
  createUserList: vi.fn(),
  fetchAudienceData: vi.fn(),
}));
vi.mock('../components/FilmPicker', () => ({ default: () => null }));
vi.mock('../components/GraphToggle', () => ({ default: () => null }));
vi.mock('../components/BottomSheet', () => ({ default: () => null }));
vi.mock('../components/AuthGate', () => ({ useAuthGate: () => ({}) }));
vi.mock('../lib/recentlyViewed', () => ({ addRecentlyViewed: vi.fn() }));
vi.mock('../lib/tmdb-image', () => ({ getPosterUrl: () => null }));
// PR 4b adds these. Stub them out so the file's top-level imports resolve
// under Node without dragging in reanimated/worklets via the Toast chain.
vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({ show: vi.fn(), hide: vi.fn() }),
}));
vi.mock('../components/BlindModeTooltip', () => ({ BlindModeTooltip: () => null }));
vi.mock('../components/film-detail/BlindModeToggle', () => ({ BlindModeToggle: () => null }));
vi.mock('../components/film-detail/SimilarFilmCard', () => ({ SimilarFilmCard: () => null }));
vi.mock('../components/film-detail/useBlindToggle', () => ({ useBlindToggle: () => ({}) }));
vi.mock('../components/icons/EyeIcons', () => ({
  EyeIcon: () => null,
  EyeOffIcon: () => null,
}));
vi.mock('../lib/score-format', () => ({ formatScore: (n: number) => n.toFixed(1) }));
vi.mock('../lib/blind-mode', () => ({
  resolveBlindForFilm: () => false,
  setBlindForFilm: vi.fn(),
  fetchBlindModeState: vi.fn(),
}));

import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';
import { SentimentArc } from '../../app/film/[id]';
import type { FilmDetail, DetailedSentimentGraph } from '../types/film';

function makeGraph(populated: boolean): DetailedSentimentGraph {
  return {
    overallScore: 7.5,
    overallSentiment: 7.4,
    summary: 'A film.',
    peakMoment: { time: 30, label: 'Climax', score: 9 },
    lowestMoment: { time: 90, label: 'Lull', score: 4 },
    biggestSwing: null,
    dataPoints: populated
      ? [
          { timeMidpoint: 10, score: 6, label: 'Opening' },
          { timeMidpoint: 30, score: 8, label: 'Rising' },
          { timeMidpoint: 60, score: 9, label: 'Climax' },
          { timeMidpoint: 90, score: 7, label: 'Resolution' },
        ]
      : [],
  };
}

function makeFilm(populated: boolean): FilmDetail {
  return {
    id: 'tt0000001',
    title: 'Test Film',
    year: 2020,
    posterPath: null,
    posterUrl: null,
    backdropPath: null,
    backdropUrl: '',
    runtime: 120,
    genres: ['Drama'],
    director: 'A Director',
    sentimentGraph: makeGraph(populated),
    reviews: [],
  };
}

function props(film: FilmDetail) {
  return {
    film,
    activeBeatIndex: null,
    setActiveBeatIndex: () => {},
    setIsGraphTouched: () => {},
    audienceData: null,
    graphMode: 'critics' as const,
    setGraphMode: () => {},
    blind: false,
  };
}

describe('SentimentArc hook stability', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('does not warn when sentimentGraph toggles between empty and populated', () => {
    let tree: ReactTestRenderer | undefined;

    TestRenderer.act(() => {
      tree = TestRenderer.create(<SentimentArc {...props(makeFilm(true))} />);
    });
    TestRenderer.act(() => {
      tree!.update(<SentimentArc {...props(makeFilm(false))} />);
    });
    TestRenderer.act(() => {
      tree!.update(<SentimentArc {...props(makeFilm(true))} />);
    });

    const hookErrors = errorSpy.mock.calls.filter((args: unknown[]) =>
      args.some(
        (arg: unknown) =>
          typeof arg === 'string' &&
          (arg.includes('Rules of Hooks') ||
            arg.includes('rendered more hooks') ||
            arg.includes('rendered fewer hooks') ||
            arg.includes('change in the order of Hooks')),
      ),
    );
    expect(hookErrors).toEqual([]);
  });

  it('renders empty-state card first, then the graph, without hook-order errors', () => {
    let tree: ReactTestRenderer | undefined;

    TestRenderer.act(() => {
      tree = TestRenderer.create(<SentimentArc {...props(makeFilm(false))} />);
    });
    const emptyJson = tree!.toJSON();
    expect(emptyJson).not.toBeNull();
    expect(JSON.stringify(emptyJson)).toContain('Not enough critic data yet');

    TestRenderer.act(() => {
      tree!.update(<SentimentArc {...props(makeFilm(true))} />);
    });
    expect(JSON.stringify(tree!.toJSON())).not.toContain('Not enough critic data yet');

    const hookErrors = errorSpy.mock.calls.filter((args: unknown[]) =>
      args.some(
        (arg: unknown) =>
          typeof arg === 'string' &&
          (arg.includes('Rules of Hooks') ||
            arg.includes('rendered more hooks') ||
            arg.includes('rendered fewer hooks') ||
            arg.includes('change in the order of Hooks')),
      ),
    );
    expect(hookErrors).toEqual([]);
  });
});
