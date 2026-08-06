import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  Animated,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, borderRadius } from '../../src/constants/theme';
import {
  fetchActivityFeed,
  markActivitySeen,
  type ActivityTab,
  type FeedActor,
  type FeedItem,
} from '../../src/lib/api';
import { getUnreadActivity, setUnreadActivity } from '../../src/lib/unread-activity';
import { timeAgo } from '../../src/lib/time-ago';
import { getInitials } from '../../src/lib/initials';
import { getPosterUrl } from '../../src/lib/tmdb-image';

// ---------------------------------------------------------------------------
// Per-tab feed state. Same paginated machine as app/section.tsx (flags,
// abort ref, loading-more ref); differences are forced by the endpoint:
// fetchActivityFeed returns null on failure instead of throwing, and
// appended pages are deduped by item.id because the server over-fetches
// to backfill dropped referents, so consecutive pages can overlap.
// ---------------------------------------------------------------------------

function useActivityFeed(tab: ActivityTab, enabled: boolean) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const loadingMoreRef = useRef(false);
  const startedRef = useRef(false);

  const loadPage = useCallback(
    async (pageToLoad: number, mode: 'initial' | 'append' | 'refresh') => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        if (mode === 'initial') setInitialLoading(true);
        if (mode === 'append') {
          loadingMoreRef.current = true;
          setLoadingMore(true);
        }
        const result = await fetchActivityFeed(tab, pageToLoad, ctrl.signal);
        if (ctrl.signal.aborted) return;
        if (!result) {
          if (mode !== 'append') setError(true);
          return;
        }
        setError(false);
        if (mode === 'append') {
          setItems((prev) => {
            const seen = new Set(prev.map((item) => item.id));
            return [...prev, ...result.items.filter((item) => !seen.has(item.id))];
          });
        } else {
          setItems(result.items);
        }
        setHasMore(result.hasMore);
        setPage(pageToLoad);
      } finally {
        if (!ctrl.signal.aborted) {
          if (mode === 'initial') setInitialLoading(false);
          if (mode === 'append') {
            loadingMoreRef.current = false;
            setLoadingMore(false);
          }
          if (mode === 'refresh') setRefreshing(false);
        }
      }
    },
    [tab],
  );

  // Each tab loads lazily, on its first activation, then keeps its state
  // across switches so returning to a tab does not refetch.
  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;
    loadPage(1, 'initial');
  }, [enabled, loadPage]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const onEndReached = useCallback(() => {
    if (loadingMoreRef.current) return;
    if (initialLoading || refreshing) return;
    if (!hasMore) return;
    loadPage(page + 1, 'append');
  }, [initialLoading, refreshing, hasMore, page, loadPage]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPage(1, 'refresh');
  }, [loadPage]);

  return { items, initialLoading, loadingMore, refreshing, error, onEndReached, onRefresh };
}

// ---------------------------------------------------------------------------
// Skeleton row (same opacity-pulse pattern used elsewhere)
// ---------------------------------------------------------------------------

function SkeletonRow() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);
  return (
    <View style={styles.row}>
      <Animated.View style={[styles.skeletonBlock, styles.avatar, { opacity }]} />
      <View style={styles.rowBody}>
        <Animated.View style={[styles.skeletonBlock, styles.skeletonLineWide, { opacity }]} />
        <Animated.View style={[styles.skeletonBlock, styles.skeletonLineNarrow, { opacity }]} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Row: avatar, sentence with tappable segments, time, poster thumb.
// Sentences mirror the web ActivityFeed exactly, including the guards:
// a row whose required referent is missing renders nothing at all.
// ---------------------------------------------------------------------------

function ActivityRow({ item, incoming }: { item: FeedItem; incoming: boolean }) {
  const router = useRouter();
  const actorName = item.actor.name ?? 'Someone';

  const actorLink = (user: FeedActor, key?: string) => (
    <Text
      key={key}
      style={styles.actorLink}
      accessibilityRole="link"
      onPress={() => router.push(`/user/${user.id}` as any)}
    >
      {user.name ?? 'Someone'}
    </Text>
  );
  const reviewLink = () => (
    <Text
      style={styles.goldLink}
      accessibilityRole="link"
      onPress={() => router.push(`/review/${item.review!.id}` as any)}
    >
      {item.film!.title}
    </Text>
  );
  const filmLink = () => (
    <Text
      style={styles.goldLink}
      accessibilityRole="link"
      onPress={() => router.push(`/film/${item.film!.id}` as any)}
    >
      {item.film!.title}
    </Text>
  );

  let sentence: ReactNode = null;
  switch (item.type) {
    case 'review':
      if (!item.review || !item.film) break;
      sentence = (
        <>
          {actorLink(item.actor)} reviewed {reviewLink()}
        </>
      );
      break;
    case 'follow':
      // Incoming follow rows target the viewer, so there is no targetUser
      // to name; the sentence addresses them directly.
      if (incoming) {
        sentence = <>{actorLink(item.actor)} followed you</>;
      } else if (item.targetUser) {
        sentence = (
          <>
            {actorLink(item.actor)} followed {actorLink(item.targetUser, 'target')}
          </>
        );
      }
      break;
    case 'like':
      if (!item.review || !item.film) break;
      sentence = (
        <>
          {actorLink(item.actor)} liked your review of {reviewLink()}
        </>
      );
      break;
    case 'reply':
      if (!item.review || !item.film) break;
      sentence = (
        <>
          {actorLink(item.actor)} replied to your review of {reviewLink()}
        </>
      );
      break;
    case 'reply_to_comment':
      if (!item.review || !item.film) break;
      sentence = (
        <>
          {actorLink(item.actor)} replied to your comment on {reviewLink()}
        </>
      );
      break;
    case 'watchlist':
      if (!item.film) break;
      sentence = (
        <>
          {actorLink(item.actor)} added {filmLink()} to their watchlist
        </>
      );
      break;
    case 'list_add':
      if (!item.film || !item.list) break;
      sentence = (
        <>
          {actorLink(item.actor)} added {filmLink()} to{' '}
          <Text
            style={styles.goldLink}
            accessibilityRole="link"
            onPress={() => router.push(`/list/${item.list!.id}` as any)}
          >
            {item.list.name}
          </Text>
        </>
      );
      break;
  }
  if (!sentence) return null;

  const posterUri =
    item.film && item.type !== 'follow'
      ? getPosterUrl({ posterUrl: item.film.posterUrl }, 'thumbnail')
      : null;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.push(`/user/${item.actor.id}` as any)}
        accessibilityRole="button"
        accessibilityLabel={`View ${actorName}'s profile`}
      >
        {item.actor.image ? (
          <Image source={{ uri: item.actor.image }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>{getInitials(actorName)}</Text>
          </View>
        )}
      </Pressable>
      <View style={styles.rowBody}>
        <Text style={styles.sentence}>{sentence}</Text>
        {(item.type === 'reply' || item.type === 'reply_to_comment') && item.reply && (
          <Text style={styles.replyBody} numberOfLines={2}>
            {item.reply.body}
          </Text>
        )}
        <Text style={styles.rowTime}>{timeAgo(item.createdAt)}</Text>
      </View>
      {item.film && item.type !== 'follow' && (
        posterUri ? (
          <Image source={{ uri: posterUri }} style={styles.posterThumb} resizeMode="cover" />
        ) : (
          <View style={styles.posterThumb} />
        )
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-tab bar (same underline pattern as the Profile sub-tabs)
// ---------------------------------------------------------------------------

const TABS: { key: ActivityTab; label: string }[] = [
  { key: 'friends', label: 'Friends' },
  { key: 'incoming', label: 'Incoming' },
];

function TabBar({
  active,
  onSelect,
}: {
  active: ActivityTab;
  onSelect: (t: ActivityTab) => void;
}) {
  return (
    <View style={styles.subTabBar}>
      {TABS.map((t) => (
        <Pressable
          key={t.key}
          onPress={() => onSelect(t.key)}
          style={[styles.subTab, active === t.key && styles.subTabActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: active === t.key }}
        >
          <Text
            style={[styles.subTabText, active === t.key && styles.subTabTextActive]}
          >
            {t.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Captured once at mount: an unread dot means something new is waiting
  // on Incoming, so open there instead of Friends.
  const [activeTab, setActiveTab] = useState<ActivityTab>(() =>
    getUnreadActivity() ? 'incoming' : 'friends',
  );

  const friends = useActivityFeed('friends', activeTab === 'friends');
  const incoming = useActivityFeed('incoming', activeTab === 'incoming');
  const feed = activeTab === 'friends' ? friends : incoming;

  // Visiting the screen is what marks activity seen. Fire-and-forget: a
  // failure just leaves the dot until a later visit.
  useEffect(() => {
    markActivitySeen()
      .then(() => setUnreadActivity(false))
      .catch(() => {});
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => (
      <ActivityRow item={item} incoming={activeTab === 'incoming'} />
    ),
    [activeTab],
  );

  const keyExtractor = useCallback((item: FeedItem) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
      </View>
      <TabBar active={activeTab} onSelect={setActiveTab} />

      {feed.initialLoading ? (
        <View>
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          // Keyed by tab so switching resets scroll position; feed state
          // itself lives in the hooks above and survives the switch.
          key={activeTab}
          data={feed.items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.listContent,
            feed.items.length === 0 && styles.listEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          onEndReached={feed.onEndReached}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={feed.refreshing}
              onRefresh={feed.onRefresh}
              tintColor={colors.gold}
            />
          }
          ListEmptyComponent={
            feed.error ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {"Couldn't load activity. Pull down to retry."}
                </Text>
              </View>
            ) : activeTab === 'friends' ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Your feed starts with people</Text>
                <Text style={styles.emptyText}>
                  Follow members to see their reviews, watchlist adds, and lists here.
                </Text>
                <Pressable
                  style={styles.emptyCta}
                  onPress={() => router.push('/(tabs)/search' as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Find members"
                >
                  <Text style={styles.emptyCtaText}>Find members</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  When someone follows you, likes a review, or replies, it shows up here.
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            feed.loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.gold} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  headerTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: colors.ivory,
    letterSpacing: -0.2,
  },

  subTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
  },
  subTab: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  subTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.gold,
  },
  subTabText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
  },
  subTabTextActive: {
    fontFamily: fonts.bodyMedium,
    color: colors.gold,
  },

  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 80,
  },
  listEmpty: {
    flexGrow: 1,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  rowBody: {
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    backgroundColor: 'rgba(200,169,81,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    color: colors.gold,
    fontFamily: fonts.bodyMedium,
  },
  sentence: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ivory,
  },
  actorLink: {
    fontFamily: fonts.bodyMedium,
    color: colors.ivory,
  },
  goldLink: {
    fontFamily: fonts.bodyMedium,
    color: colors.gold,
  },
  replyBody: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowTime: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  posterThumb: {
    width: 40,
    height: 60,
    borderRadius: borderRadius.sm,
    backgroundColor: '#1a1a2e',
  },

  // Skeleton
  skeletonBlock: {
    backgroundColor: 'rgba(245,240,225,0.06)',
    borderRadius: borderRadius.sm,
  },
  skeletonLineWide: {
    height: 12,
    width: '80%',
  },
  skeletonLineNarrow: {
    height: 10,
    width: '35%',
    marginTop: 6,
  },

  // States
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: colors.ivory,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(245,240,225,0.5)',
    textAlign: 'center',
  },
  emptyCta: {
    marginTop: 20,
    backgroundColor: colors.gold,
    borderRadius: borderRadius.lg,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  emptyCtaText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.background,
  },
});
