import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks for native modules and components must precede the import of the
// file under test so that its top-level imports resolve under Node.

const showErrorSpy = vi.hoisted(() => vi.fn());
const alertSpy = vi.hoisted(() => vi.fn());
const routerPushSpy = vi.hoisted(() => vi.fn());
const routerBackSpy = vi.hoisted(() => vi.fn());
const routerReplaceSpy = vi.hoisted(() => vi.fn());
const canGoBackSpy = vi.hoisted(() => vi.fn());

vi.mock('react-native', async () => {
  const React = (await import('react')).default;

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

  // The screen puts its whole header inside ListHeaderComponent, so a plain
  // string mock would never render it. Render header, rows, and empty state
  // the way FlatList does so the tests can reach the like button.
  function FlatList({
    data = [],
    renderItem,
    ListHeaderComponent,
    ListEmptyComponent,
    keyExtractor,
  }: any) {
    const resolve = (Comp: any) =>
      Comp == null
        ? null
        : typeof Comp === 'function'
          ? React.createElement(Comp)
          : Comp;
    const items = data.map((item: any, index: number) =>
      React.createElement(
        React.Fragment,
        { key: keyExtractor ? keyExtractor(item, index) : String(index) },
        renderItem ? renderItem({ item, index }) : null,
      ),
    );
    return React.createElement(
      'View',
      null,
      resolve(ListHeaderComponent),
      data.length === 0 ? resolve(ListEmptyComponent) : items,
    );
  }

  return {
    View: 'View',
    Text: 'Text',
    Image: 'Image',
    StyleSheet: { create: (s: Record<string, unknown>) => s },
    FlatList,
    Pressable: 'Pressable',
    Alert: { alert: alertSpy },
    Animated,
    TextInput: 'TextInput',
    KeyboardAvoidingView: 'KeyboardAvoidingView',
    Platform: { OS: 'ios', select: (o: any) => o.ios },
    Dimensions: { get: () => ({ width: 375, height: 812 }) },
  };
});

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Svg: 'Svg',
  Line: 'Line',
  Path: 'Path',
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: routerPushSpy,
    back: routerBackSpy,
    replace: routerReplaceSpy,
    canGoBack: canGoBackSpy,
  }),
  useLocalSearchParams: () => ({ id: 'r1' }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('../providers/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'viewer-1', name: 'Viewer', email: 'v@example.com' },
    isAuthenticated: true,
  }),
}));

vi.mock('../components/AuthGate', () => ({
  useAuthGate: () => ({ gate: (action: () => void) => action(), sheet: null }),
}));

vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({ showError: showErrorSpy, showSuccess: vi.fn() }),
}));

vi.mock('../lib/api', () => ({
  // apiFetch is not used by the screen but is imported by the real
  // blind-mode module, whose pure resolveBlindForFilm the tests keep.
  apiFetch: vi.fn(),
  fetchReviewDetail: vi.fn(),
  fetchReviewReplies: vi.fn(),
  postReply: vi.fn(),
  deleteReply: vi.fn(),
  likeReview: vi.fn(),
  unlikeReview: vi.fn(),
}));

// Keep the real resolveBlindForFilm (pure) so blind resolution semantics
// stay honest; only the network-backed state fetch is stubbed.
vi.mock('../lib/blind-mode', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/blind-mode')>();
  return { ...actual, getBlindModeState: vi.fn() };
});

import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';
import {
  fetchReviewDetail,
  fetchReviewReplies,
  deleteReply,
  likeReview,
  unlikeReview,
} from '../lib/api';
import { getBlindModeState } from '../lib/blind-mode';
import { clearPayloadCache } from '../lib/payload-cache';
import ReviewDetailScreen from '../../app/review/[id]';

function makeDetail() {
  return {
    id: 'r1',
    filmId: 'f1',
    overallRating: 8.5,
    beginning: 'A strong opening.',
    middle: null,
    ending: null,
    otherThoughts: null,
    combinedText: null,
    beatRatings: null,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    user: { id: 'author-1', name: 'Ada Author', image: null },
    film: {
      id: 'f1',
      title: 'Test Film',
      posterUrl: null,
      releaseDate: '2020-01-01T00:00:00Z',
      director: 'A Director',
      runtime: 120,
      sentimentGraph: null,
    },
    likes: { count: 3, liked: false },
    replyCount: 0,
  };
}

async function renderScreen(): Promise<ReactTestRenderer> {
  let tree: ReactTestRenderer | undefined;
  await TestRenderer.act(async () => {
    tree = TestRenderer.create(<ReviewDetailScreen />);
  });
  if (!tree) throw new Error('renderer never assigned');
  return tree;
}

function likeButton(tree: ReactTestRenderer) {
  const matches = tree.root.findAll(
    (node) =>
      node.props?.accessibilityLabel === 'Like review' ||
      node.props?.accessibilityLabel === 'Unlike review',
  );
  expect(matches).toHaveLength(1);
  return matches[0];
}

function likeCount(tree: ReactTestRenderer): string {
  const btn = likeButton(tree);
  const texts = btn.findAllByType('Text' as never);
  return String(texts[texts.length - 1].props.children);
}

beforeEach(() => {
  clearPayloadCache();
  showErrorSpy.mockReset();
  alertSpy.mockReset();
  routerPushSpy.mockReset();
  routerBackSpy.mockReset();
  routerReplaceSpy.mockReset();
  canGoBackSpy.mockReset().mockReturnValue(true);
  vi.mocked(fetchReviewDetail).mockReset().mockResolvedValue(makeDetail());
  vi.mocked(fetchReviewReplies)
    .mockReset()
    .mockResolvedValue({ comments: [], total: 0 });
  vi.mocked(deleteReply).mockReset();
  vi.mocked(likeReview).mockReset();
  vi.mocked(unlikeReview).mockReset();
  // Null state resolves to "scores visible" for every film.
  vi.mocked(getBlindModeState).mockReset().mockResolvedValue(null);
});

describe('ReviewDetailScreen like toggle', () => {
  it('applies the authoritative count from the server on success', async () => {
    vi.mocked(likeReview).mockResolvedValue({ liked: true, count: 4 });
    const tree = await renderScreen();

    expect(likeCount(tree)).toBe('3');

    await TestRenderer.act(async () => {
      likeButton(tree).props.onPress();
    });

    expect(likeReview).toHaveBeenCalledWith('r1');
    expect(likeButton(tree).props.accessibilityLabel).toBe('Unlike review');
    expect(likeCount(tree)).toBe('4');
    expect(showErrorSpy).not.toHaveBeenCalled();
  });

  it('rolls back the optimistic flip and shows a toast when the server rejects', async () => {
    vi.mocked(likeReview).mockRejectedValue(new Error('nope'));
    const tree = await renderScreen();

    expect(likeCount(tree)).toBe('3');
    expect(likeButton(tree).props.accessibilityLabel).toBe('Like review');

    await TestRenderer.act(async () => {
      likeButton(tree).props.onPress();
    });

    // Rolled back: same count and un-liked label as before the tap.
    expect(likeCount(tree)).toBe('3');
    expect(likeButton(tree).props.accessibilityLabel).toBe('Like review');
    expect(showErrorSpy).toHaveBeenCalledWith(
      'Could not update like. Please try again.',
    );
  });

  it('hides the like button entirely when the viewer authored the review', async () => {
    const detail = makeDetail();
    detail.user = { id: 'viewer-1', name: 'Viewer', image: null };
    vi.mocked(fetchReviewDetail).mockResolvedValue(detail);

    const tree = await renderScreen();

    const matches = tree.root.findAll(
      (node) =>
        node.props?.accessibilityLabel === 'Like review' ||
        node.props?.accessibilityLabel === 'Unlike review',
    );
    expect(matches).toHaveLength(0);
  });
});

describe('ReviewDetailScreen blind mode', () => {
  // The heart icon's SVG path data happens to contain the substring
  // "8.5", so these assertions target Text nodes, not the raw JSON.
  function scoreTexts(tree: ReactTestRenderer) {
    return tree.root
      .findAllByType('Text' as never)
      .filter((node) => node.props.children === '8.5');
  }

  it('hides the score number when blind resolves true for the film', async () => {
    vi.mocked(getBlindModeState).mockResolvedValue({
      blindUnwatchedDefault: true,
      perFilm: {},
      hasSeenBlindModeTooltip: true,
    });

    const tree = await renderScreen();

    expect(scoreTexts(tree)).toHaveLength(0);
  });

  it('shows the score when blind state is unavailable', async () => {
    const tree = await renderScreen();
    expect(scoreTexts(tree)).toHaveLength(1);
  });
});

describe('ReviewDetailScreen back chevron', () => {
  function backButton(tree: ReactTestRenderer) {
    const matches = tree.root.findAll(
      (node) => node.props?.accessibilityLabel === 'Go back',
    );
    expect(matches).toHaveLength(1);
    return matches[0];
  }

  it('pops the navigator when it can go back', async () => {
    const tree = await renderScreen();

    await TestRenderer.act(async () => {
      backButton(tree).props.onPress();
    });

    expect(routerBackSpy).toHaveBeenCalledTimes(1);
    expect(routerReplaceSpy).not.toHaveBeenCalled();
  });

  it('falls back to the Explore tab when there is no history (deep link)', async () => {
    canGoBackSpy.mockReturnValue(false);
    const tree = await renderScreen();

    await TestRenderer.act(async () => {
      backButton(tree).props.onPress();
    });

    expect(routerBackSpy).not.toHaveBeenCalled();
    expect(routerReplaceSpy).toHaveBeenCalledWith('/(tabs)/explore');
  });
});

describe('ReviewDetailScreen beat-arc card', () => {
  const DATA_POINTS = [
    { timeMidpoint: 10, score: 6, label: 'Opening' },
    { timeMidpoint: 90, score: 8, label: 'Resolution' },
  ];

  function beatArcCards(tree: ReactTestRenderer) {
    return tree.root.findAll((node) => node.props?.testID === 'beat-arc-card');
  }

  function makeDetailWithBeats(beatRatings: Record<string, number>) {
    const base = makeDetail();
    return {
      ...base,
      beatRatings,
      film: { ...base.film, sentimentGraph: { dataPoints: DATA_POINTS } },
    };
  }

  it('renders the card when the review has beat ratings and the film has data points', async () => {
    vi.mocked(fetchReviewDetail).mockResolvedValue(
      makeDetailWithBeats({ Opening: 7 }),
    );

    const tree = await renderScreen();

    expect(beatArcCards(tree)).toHaveLength(1);
  });

  it('renders no card when beatRatings is an empty object, same as null', async () => {
    vi.mocked(fetchReviewDetail).mockResolvedValue(makeDetailWithBeats({}));

    const tree = await renderScreen();

    expect(beatArcCards(tree)).toHaveLength(0);
  });
});

describe('ReviewDetailScreen comment delete', () => {
  function makeThread() {
    return {
      comments: [
        {
          id: 'c1',
          body: 'Own top-level comment',
          createdAt: '2026-07-02T00:00:00Z',
          parentReplyId: null,
          user: { id: 'viewer-1', name: 'Viewer', image: null },
          children: [
            {
              id: 'c2',
              body: 'Someone else replied',
              createdAt: '2026-07-03T00:00:00Z',
              parentReplyId: 'c1',
              user: { id: 'author-1', name: 'Ada Author', image: null },
            },
          ],
        },
      ],
      total: 2,
    };
  }

  it('confirms before deleting a top-level comment, then deletes on confirm', async () => {
    vi.mocked(fetchReviewReplies).mockResolvedValue(makeThread());
    vi.mocked(deleteReply).mockResolvedValue(undefined);

    const tree = await renderScreen();

    // Only the viewer's own row (c1) offers Delete.
    const deleteButtons = tree.root.findAll(
      (node) => node.props?.accessibilityLabel === 'Delete comment',
    );
    expect(deleteButtons).toHaveLength(1);

    await TestRenderer.act(async () => {
      deleteButtons[0].props.onPress();
    });

    // The cascade is gated behind a confirm; nothing deleted yet.
    expect(deleteReply).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = alertSpy.mock.calls[0];
    expect(title).toBe('Delete comment?');
    expect(message).toBe('This will also delete its 1 reply.');

    const destructive = (buttons as any[]).find((b) => b.style === 'destructive');
    await TestRenderer.act(async () => {
      destructive.onPress();
    });

    expect(deleteReply).toHaveBeenCalledWith('c1');
    expect(JSON.stringify(tree.toJSON())).not.toContain('Own top-level comment');
  });
});
