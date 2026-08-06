import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks for native modules must precede the import of the file under test
// so that its top-level imports resolve under Node.

const routerPushSpy = vi.hoisted(() => vi.fn());

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
    sequence: () => noopAnim,
    loop: () => ({ start: () => {}, stop: () => {} }),
  };

  // Render rows, empty state, and footer the way FlatList does, and expose
  // onEndReached on the rendered View so tests can drive pagination.
  function FlatList({
    data = [],
    renderItem,
    ListEmptyComponent,
    ListFooterComponent,
    keyExtractor,
    onEndReached,
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
      { onEndReached },
      data.length === 0 ? resolve(ListEmptyComponent) : items,
      resolve(ListFooterComponent),
    );
  }

  return {
    View: 'View',
    Text: 'Text',
    Image: 'Image',
    StyleSheet: { create: (s: Record<string, unknown>) => s },
    FlatList,
    Pressable: 'Pressable',
    ActivityIndicator: 'ActivityIndicator',
    RefreshControl: 'RefreshControl',
    Animated,
  };
});

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: routerPushSpy }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('../lib/api', () => ({
  fetchActivityFeed: vi.fn(),
  markActivitySeen: vi.fn(),
}));

import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';
import { fetchActivityFeed, markActivitySeen } from '../lib/api';
import type { FeedItem } from '../lib/api';
import { setUnreadActivity, getUnreadActivity } from '../lib/unread-activity';
import ActivityScreen from '../../app/(tabs)/activity';

const CREATED_AT = '2026-08-01T00:00:00Z';

const base = {
  createdAt: CREATED_AT,
  targetUser: null,
  film: null,
  review: null,
  list: null,
  reply: null,
};

function actor(id: string, name: string | null) {
  return { id, name, image: null };
}

const FRIENDS_ITEMS: FeedItem[] = [
  {
    ...base,
    id: 'fr-review',
    type: 'review',
    actor: actor('u-alice', 'Alice'),
    review: { id: 'rev-1' },
    film: { id: 'f1', title: 'Dune', posterUrl: null },
  },
  {
    ...base,
    id: 'fr-follow',
    type: 'follow',
    actor: actor('u-alice', 'Alice'),
    targetUser: actor('u-target', 'Tara Target'),
  },
  {
    ...base,
    id: 'fr-watchlist',
    type: 'watchlist',
    actor: actor('u-bob', 'Bob'),
    film: { id: 'f2', title: 'Heat', posterUrl: null },
  },
  {
    ...base,
    id: 'fr-list',
    type: 'list_add',
    actor: actor('u-bob', 'Bob'),
    film: { id: 'f3', title: 'Alien', posterUrl: null },
    list: { id: 'l1', name: 'Space Horror' },
  },
];

const INCOMING_ITEMS: FeedItem[] = [
  {
    ...base,
    id: 'in-follow',
    type: 'follow',
    actor: actor('u-cara', 'Cara'),
  },
  {
    ...base,
    id: 'in-like',
    type: 'like',
    actor: actor('u-cara', 'Cara'),
    review: { id: 'rev-2' },
    film: { id: 'f4', title: 'Arrival', posterUrl: null },
  },
  {
    ...base,
    id: 'in-reply',
    type: 'reply',
    actor: actor('u-dan', 'Dan'),
    review: { id: 'rev-3' },
    film: { id: 'f5', title: 'Sicario', posterUrl: null },
    reply: { id: 'rp-1', body: 'Great point about the score.' },
  },
  {
    ...base,
    id: 'in-reply-comment',
    type: 'reply_to_comment',
    actor: actor('u-dan', 'Dan'),
    review: { id: 'rev-4' },
    film: { id: 'f6', title: 'Blade Runner', posterUrl: null },
    reply: { id: 'rp-2', body: 'Agreed, the ending lands.' },
  },
];

function page(items: FeedItem[], pageNum = 1, hasMore = false) {
  return { items, page: pageNum, hasMore };
}

async function renderScreen(): Promise<ReactTestRenderer> {
  let tree: ReactTestRenderer | undefined;
  await TestRenderer.act(async () => {
    tree = TestRenderer.create(<ActivityScreen />);
  });
  if (!tree) throw new Error('renderer never assigned');
  return tree;
}

// Every raw string rendered anywhere in the tree, including sentence
// fragments like ' reviewed ' that sit between nested Text links.
function textStrings(tree: ReactTestRenderer): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === 'object' && 'children' in node) {
      walk((node as { children: unknown }).children);
    }
  };
  walk(tree.toJSON());
  return out;
}

// The pressable inline link whose entire content is `label`.
function link(tree: ReactTestRenderer, label: string) {
  const matches = tree.root.findAll(
    (node) => node.props?.children === label && typeof node.props?.onPress === 'function',
  );
  expect(matches.length).toBeGreaterThan(0);
  return matches[0];
}

function pressLink(tree: ReactTestRenderer, label: string, expectedPath: string) {
  routerPushSpy.mockClear();
  link(tree, label).props.onPress();
  expect(routerPushSpy).toHaveBeenCalledWith(expectedPath);
}

beforeEach(() => {
  routerPushSpy.mockReset();
  setUnreadActivity(false);
  vi.mocked(markActivitySeen).mockReset().mockResolvedValue(undefined);
  vi.mocked(fetchActivityFeed)
    .mockReset()
    .mockImplementation(async (tab) =>
      tab === 'friends' ? page(FRIENDS_ITEMS) : page(INCOMING_ITEMS),
    );
});

describe('ActivityScreen friends rows', () => {
  it('renders every friends row type with its sentence and link targets', async () => {
    const tree = await renderScreen();
    const text = textStrings(tree);

    // review: "{actor} reviewed {film}" -> /review/{review.id}
    expect(text).toContain(' reviewed ');
    pressLink(tree, 'Dune', '/review/rev-1');

    // follow (friends): "{actor} followed {target}", both users tappable
    expect(text).toContain(' followed ');
    pressLink(tree, 'Tara Target', '/user/u-target');
    pressLink(tree, 'Alice', '/user/u-alice');

    // watchlist: "{actor} added {film} to their watchlist" -> /film/{id}
    expect(text).toContain(' to their watchlist');
    pressLink(tree, 'Heat', '/film/f2');

    // list_add: film -> /film/{id}, list name -> /list/{id}
    pressLink(tree, 'Alien', '/film/f3');
    pressLink(tree, 'Space Horror', '/list/l1');
  });

  it('renders nothing for rows missing a required field', async () => {
    const broken: FeedItem[] = [
      {
        ...base,
        id: 'no-film',
        type: 'review',
        actor: actor('u-ghost', 'Ghost'),
        review: { id: 'rev-x' },
      },
      {
        ...base,
        id: 'no-list',
        type: 'list_add',
        actor: actor('u-ghost2', 'Ghost Two'),
        film: { id: 'f9', title: 'Orphan Film', posterUrl: null },
      },
      {
        ...base,
        id: 'no-target',
        type: 'follow',
        actor: actor('u-ghost3', 'Ghost Three'),
      },
    ];
    vi.mocked(fetchActivityFeed).mockResolvedValue(page(broken));

    const tree = await renderScreen();
    const text = textStrings(tree);

    expect(text).not.toContain('Ghost');
    expect(text).not.toContain('Ghost Two');
    expect(text).not.toContain('Ghost Three');
    expect(text).not.toContain('Orphan Film');
  });

  it('uses Someone for a null actor name', async () => {
    vi.mocked(fetchActivityFeed).mockResolvedValue(
      page([
        {
          ...base,
          id: 'anon',
          type: 'watchlist',
          actor: actor('u-anon', null),
          film: { id: 'f7', title: 'Stalker', posterUrl: null },
        },
      ]),
    );

    const tree = await renderScreen();
    pressLink(tree, 'Someone', '/user/u-anon');
  });
});

describe('ActivityScreen incoming rows', () => {
  it('renders every incoming row type with its sentence and link targets', async () => {
    setUnreadActivity(true); // opens on Incoming
    const tree = await renderScreen();
    const text = textStrings(tree);

    // follow (incoming): addresses the viewer directly
    expect(text).toContain(' followed you');

    // like -> /review/{id}
    expect(text).toContain(' liked your review of ');
    pressLink(tree, 'Arrival', '/review/rev-2');

    // reply -> /review/{id}, body shown
    expect(text).toContain(' replied to your review of ');
    pressLink(tree, 'Sicario', '/review/rev-3');
    expect(text).toContain('Great point about the score.');

    // reply_to_comment -> /review/{id}, body shown
    expect(text).toContain(' replied to your comment on ');
    pressLink(tree, 'Blade Runner', '/review/rev-4');
    expect(text).toContain('Agreed, the ending lands.');
  });
});

describe('ActivityScreen pagination', () => {
  it('dedupes appended pages by item id', async () => {
    const pageOne: FeedItem[] = [
      {
        ...base,
        id: 'a',
        type: 'review',
        actor: actor('u-a', 'Alice'),
        review: { id: 'rev-a' },
        film: { id: 'fa', title: 'Film One', posterUrl: null },
      },
      {
        ...base,
        id: 'b',
        type: 'review',
        actor: actor('u-b', 'Bob'),
        review: { id: 'rev-b' },
        film: { id: 'fb', title: 'Film Two', posterUrl: null },
      },
    ];
    const pageTwo: FeedItem[] = [
      pageOne[1], // overlap: the server over-fetch repeats item b
      {
        ...base,
        id: 'c',
        type: 'review',
        actor: actor('u-c', 'Cara'),
        review: { id: 'rev-c' },
        film: { id: 'fc', title: 'Film Three', posterUrl: null },
      },
    ];
    vi.mocked(fetchActivityFeed).mockImplementation(async (_tab, pageNum) =>
      pageNum === 1 ? page(pageOne, 1, true) : page(pageTwo, 2, false),
    );

    const tree = await renderScreen();

    const list = tree.root.findAll(
      (node) => typeof node.props?.onEndReached === 'function',
    )[0];
    await TestRenderer.act(async () => {
      list.props.onEndReached();
    });

    const rowFor = (name: string) =>
      tree.root.findAll((node) => node.props?.children === name);
    expect(rowFor('Alice')).toHaveLength(1);
    expect(rowFor('Bob')).toHaveLength(1);
    expect(rowFor('Cara')).toHaveLength(1);
  });
});

describe('ActivityScreen tab selection and seen', () => {
  it('opens on Friends when there is no unread activity', async () => {
    await renderScreen();
    expect(fetchActivityFeed).toHaveBeenCalledWith('friends', 1, expect.anything());
    expect(fetchActivityFeed).not.toHaveBeenCalledWith(
      'incoming',
      expect.anything(),
      expect.anything(),
    );
  });

  it('opens on Incoming when the unread dot is showing', async () => {
    setUnreadActivity(true);
    await renderScreen();
    expect(fetchActivityFeed).toHaveBeenCalledWith('incoming', 1, expect.anything());
    expect(fetchActivityFeed).not.toHaveBeenCalledWith(
      'friends',
      expect.anything(),
      expect.anything(),
    );
  });

  it('marks activity seen on mount and clears the unread flag on success', async () => {
    setUnreadActivity(true);
    await renderScreen();
    expect(markActivitySeen).toHaveBeenCalledTimes(1);
    expect(getUnreadActivity()).toBe(false);
  });
});
