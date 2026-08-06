import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks for native modules and components must precede the import of the
// file under test so that its top-level imports resolve under Node.

const pushSpy = vi.hoisted(() => vi.fn());

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
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));
vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: pushSpy,
    back: vi.fn(),
    replace: vi.fn(),
    canGoBack: () => true,
  }),
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
vi.mock('../components/AuthGate', () => ({
  useAuthGate: () => ({ gate: (action: () => void) => action(), sheet: null }),
}));
vi.mock('../lib/recentlyViewed', () => ({ addRecentlyViewed: vi.fn() }));
vi.mock('../lib/reviewed-films', () => ({ useIsReviewed: () => false }));
vi.mock('../lib/tmdb-image', () => ({ getPosterUrl: () => null }));
vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));
vi.mock('../components/BlindModeTooltip', () => ({ BlindModeTooltip: () => null }));
vi.mock('../components/film-detail/BlindModeToggle', () => ({ BlindModeToggle: () => null }));
vi.mock('../components/film-detail/SimilarFilmCard', () => ({ SimilarFilmCard: () => null }));
vi.mock('../components/film-detail/useBlindToggle', () => ({
  useBlindToggle: () => vi.fn(),
}));
vi.mock('../components/icons/EyeIcons', () => ({
  EyeIcon: () => null,
  EyeOffIcon: () => null,
}));
vi.mock('../lib/blind-mode', () => ({
  getBlindModeState: vi.fn().mockResolvedValue(null),
  resolveBlindForFilm: () => false,
  markTooltipSeen: vi.fn(),
}));

import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';
import {
  fetchFilmDetail,
  fetchFilmReviews,
  fetchUserLists,
  fetchUserWatchlist,
  fetchAudienceData,
} from '../lib/api';
import { clearPayloadCache } from '../lib/payload-cache';
import FilmDetailScreen from '../../app/film/[id]';
import type { FilmDetail, FilmReview } from '../types/film';

function makeFilm(overrides: Partial<FilmDetail> = {}): FilmDetail {
  return {
    id: 'test-film',
    title: 'Test Film',
    year: 2020,
    posterPath: null,
    posterUrl: null,
    backdropPath: null,
    backdropUrl: '',
    runtime: 120,
    genres: ['Drama'],
    director: 'A Director',
    userHasReviewed: false,
    sentimentGraph: {
      overallScore: 7.5,
      overallSentiment: 7.4,
      summary: 'A film.',
      peakMoment: { time: 30, label: 'Climax', score: 9 },
      lowestMoment: { time: 90, label: 'Lull', score: 4 },
      biggestSwing: null,
      dataPoints: [
        { timeMidpoint: 10, score: 6, label: 'Opening' },
        { timeMidpoint: 60, score: 9, label: 'Climax' },
        { timeMidpoint: 90, score: 7, label: 'Resolution' },
      ],
    },
    ...overrides,
  };
}

// Both fixtures follow the wire shape of GET /api/films/[id]/reviews:
// overallRating plus section fields and the denormalized combinedText.
// The other user's review stitches from its sections; the viewer's own
// review has no surviving section so its prose falls back to combinedText.
const OTHER_REVIEW: FilmReview = {
  id: 'r1',
  user: { id: 'u1', name: 'Other User' },
  overallRating: 8.5,
  beginning: 'A gripping open.',
  middle: null,
  ending: 'Sticks the landing.',
  otherThoughts: null,
  combinedText: 'A gripping open.\n\nSticks the landing.',
  createdAt: '2026-01-01T00:00:00Z',
};

const MY_REVIEW: FilmReview = {
  id: 'r-mine',
  user: { id: 'me', name: 'Me' },
  overallRating: 9.2,
  beginning: null,
  middle: null,
  ending: null,
  otherThoughts: null,
  combinedText: 'Only the combined text survives.',
  createdAt: '2026-02-01T00:00:00Z',
};

async function renderScreen(): Promise<ReactTestRenderer> {
  let tree: ReactTestRenderer | undefined;
  await TestRenderer.act(async () => {
    tree = TestRenderer.create(<FilmDetailScreen />);
  });
  if (!tree) throw new Error('renderer never assigned');
  return tree;
}

function textNodes(tree: ReactTestRenderer, value: string) {
  return tree.root
    .findAllByType('Text' as never)
    .filter((node) => node.props.children === value);
}

function byLabel(tree: ReactTestRenderer, label: string) {
  const matches = tree.root.findAll(
    (node) => node.props?.accessibilityLabel === label,
  );
  expect(matches).toHaveLength(1);
  return matches[0];
}

beforeEach(() => {
  clearPayloadCache();
  pushSpy.mockReset();
  vi.mocked(fetchFilmDetail).mockReset().mockResolvedValue(makeFilm());
  vi.mocked(fetchFilmReviews)
    .mockReset()
    .mockResolvedValue({ reviews: [OTHER_REVIEW], total: 1, myReview: null });
  vi.mocked(fetchUserLists).mockReset().mockResolvedValue([]);
  vi.mocked(fetchUserWatchlist).mockReset().mockResolvedValue([]);
  vi.mocked(fetchAudienceData).mockReset().mockResolvedValue(null);
});

describe("FilmDetailScreen ReviewCard (other users' reviews)", () => {
  it('renders the score from overallRating and the prose stitched from the section fields', async () => {
    const tree = await renderScreen();

    expect(textNodes(tree, '8.5')).toHaveLength(1);
    expect(
      textNodes(tree, 'A gripping open.\n\nSticks the landing.'),
    ).toHaveLength(1);
  });

  it('renders Anonymous for a null author name instead of crashing', async () => {
    vi.mocked(fetchFilmReviews).mockResolvedValue({
      reviews: [{ ...OTHER_REVIEW, user: { id: 'u1', name: null } }],
      total: 1,
      myReview: null,
    });

    const tree = await renderScreen();

    expect(textNodes(tree, 'Anonymous')).toHaveLength(1);
  });
});

describe('FilmDetailScreen YourReview', () => {
  beforeEach(() => {
    vi.mocked(fetchFilmDetail).mockResolvedValue(
      makeFilm({ userHasReviewed: true }),
    );
    vi.mocked(fetchFilmReviews).mockResolvedValue({
      reviews: [],
      total: 0,
      myReview: MY_REVIEW,
    });
  });

  it('renders the score from overallRating and falls back to combinedText for the prose', async () => {
    const tree = await renderScreen();

    expect(textNodes(tree, '9.2')).toHaveLength(1);
    expect(
      textNodes(tree, 'Only the combined text survives.'),
    ).toHaveLength(1);
  });

  it('navigates to the review detail when the card is tapped', async () => {
    const tree = await renderScreen();

    await TestRenderer.act(async () => {
      byLabel(tree, 'View your review').props.onPress();
    });

    expect(pushSpy).toHaveBeenCalledWith('/review/r-mine');
  });

  it('keeps the edit link routing to the composer, not the review detail', async () => {
    const tree = await renderScreen();

    await TestRenderer.act(async () => {
      byLabel(tree, 'Edit your review').props.onPress();
    });

    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledWith({
      pathname: '/review',
      params: { filmId: 'test-film' },
    });
  });

  it('renders Anonymous for a null author name instead of crashing', async () => {
    vi.mocked(fetchFilmReviews).mockResolvedValue({
      reviews: [],
      total: 0,
      myReview: { ...MY_REVIEW, user: { id: 'me', name: null } },
    });

    const tree = await renderScreen();

    expect(textNodes(tree, 'Anonymous')).toHaveLength(1);
  });
});
