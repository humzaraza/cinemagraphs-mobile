import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, borderRadius } from '../../src/constants/theme';
import {
  fetchReviewDetail,
  fetchReviewReplies,
  postReply,
  deleteReply,
  likeReview,
  unlikeReview,
} from '../../src/lib/api';
import type {
  ReviewDetail,
  ReviewReply,
  ReviewComment,
} from '../../src/lib/api';
import * as payloadCache from '../../src/lib/payload-cache';
import { useAuth } from '../../src/providers/AuthProvider';
import { useAuthGate } from '../../src/components/AuthGate';
import { useToast } from '../../src/components/ui/Toast';
import ReviewBeatArc from '../../src/components/ReviewBeatArc';
import { formatScore } from '../../src/lib/score-format';
import { stitchReviewProse } from '../../src/lib/review-prose';
import { getPosterUrl } from '../../src/lib/tmdb-image';
import { timeAgo } from '../../src/lib/time-ago';
import { EyeOffIcon } from '../../src/components/icons/EyeIcons';
import { useIsReviewed } from '../../src/lib/reviewed-films';
import {
  getBlindModeState,
  resolveBlindForFilm,
  type BlindModeState,
} from '../../src/lib/blind-mode';

const MAX_REPLY_LENGTH = 2000;
// The counter is noise while there is plenty of room; it only appears once
// the draft is within 200 characters of the server's 2000 limit.
const COUNTER_THRESHOLD = 1800;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// One FlatList row per rendered comment. Children carry their top-level
// comment's id so delete can prune the right branch; top-level rows carry
// null and prune themselves (children go with them, matching the server's
// cascade).
interface CommentRow {
  reply: ReviewReply;
  isChild: boolean;
  parentId: string | null;
}

function flattenComments(comments: ReviewComment[]): CommentRow[] {
  const rows: CommentRow[] = [];
  for (const comment of comments) {
    rows.push({ reply: comment, isChild: false, parentId: null });
    for (const child of comment.children) {
      rows.push({ reply: child, isChild: true, parentId: comment.id });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Skeleton placeholder (same pulse pattern as the film screen)
// ---------------------------------------------------------------------------

function SkeletonBox({ width, height, style }: { width: number | string; height: number; style?: object }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: 'rgba(245,240,225,0.06)',
          borderRadius: borderRadius.md,
          opacity,
        },
        style,
      ]}
    />
  );
}

function ReviewDetailSkeleton() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { padding: 14, paddingTop: insets.top + 8 }]}>
      <SkeletonBox width={44} height={44} />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 14 }}>
        <SkeletonBox width={44} height={64} />
        <View style={{ flex: 1, gap: 6, paddingTop: 8 }}>
          <SkeletonBox width={180} height={16} />
          <SkeletonBox width={120} height={11} />
        </View>
      </View>
      <SkeletonBox width={'100%' as any} height={140} style={{ marginBottom: 14 }} />
      <SkeletonBox width={'100%' as any} height={150} style={{ marginBottom: 14 }} />
      <SkeletonBox width={'100%' as any} height={56} style={{ marginBottom: 10 }} />
      <SkeletonBox width={'100%' as any} height={56} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Comment row
// ---------------------------------------------------------------------------

function CommentRowView({
  row,
  viewerId,
  onReply,
  onDelete,
}: {
  row: CommentRow;
  viewerId: string | undefined;
  onReply: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const { reply, isChild } = row;
  const name = reply.user.name ?? 'Anonymous';

  return (
    <View style={[styles.commentRow, isChild && styles.commentChild]}>
      <View style={styles.commentHeader}>
        <Pressable
          style={styles.commentAuthor}
          onPress={() => router.push(`/user/${reply.user.id}` as any)}
          accessibilityRole="button"
          accessibilityLabel={`View ${name}'s profile`}
        >
          {reply.user.image ? (
            <Image source={{ uri: reply.user.image }} style={styles.commentAvatar} />
          ) : (
            <View style={[styles.commentAvatar, styles.commentAvatarFallback]}>
              <Text style={styles.commentAvatarText}>{getInitials(name)}</Text>
            </View>
          )}
          <Text style={styles.commentName}>{name}</Text>
        </Pressable>
        <Text style={styles.commentTime}>{timeAgo(reply.createdAt)}</Text>
      </View>
      <Text style={styles.commentBody}>{reply.body}</Text>
      <View style={styles.commentActions}>
        {/* Replies cannot themselves be replied to (the server rejects
            two-level nesting), so the Reply action only appears on
            top-level comments, matching the web thread. */}
        {!isChild && (
          <Pressable
            onPress={onReply}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Reply to ${name}`}
          >
            <Text style={styles.commentActionText}>Reply</Text>
          </Pressable>
        )}
        {viewerId != null && viewerId === reply.user.id && (
          <Pressable
            onPress={onDelete}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Delete comment"
          >
            <Text style={styles.commentDeleteText}>Delete</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ReviewDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: authUser } = useAuth();
  const { gate, sheet: authSheet } = useAuthGate();
  const { showError } = useToast();

  // Session cache key for this review's detail payload. Seed from the cache
  // so a re-open paints instantly; a true cold open shows the skeleton.
  const cacheKey = id ? `review:${id}` : null;
  const [review, setReview] = useState<ReviewDetail | null>(() =>
    cacheKey ? payloadCache.get<ReviewDetail>(cacheKey) ?? null : null,
  );
  const [loading, setLoading] = useState(() =>
    cacheKey ? payloadCache.get<ReviewDetail>(cacheKey) === undefined : true,
  );
  const [error, setError] = useState(false);

  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [threadState, setThreadState] = useState<'loading' | 'error' | 'loaded'>('loading');

  // Blind mode: same session-cached state the film screen reads. This
  // screen has no userHasReviewed field for the film, so blind resolves
  // from authorship (viewing your own review means you reviewed the film)
  // plus the optimistic reviewed flag, falling back to the unwatched
  // default. Only the score number is gated; arc shape stays visible.
  const [blindState, setBlindState] = useState<BlindModeState | null>(null);
  const optimisticReviewed = useIsReviewed(review?.filmId ?? '');

  useEffect(() => {
    getBlindModeState().then(setBlindState).catch(() => {});
  }, []);

  // Composer state. replyTarget names the top-level comment being replied
  // to; null posts a new top-level comment.
  const [draft, setDraft] = useState('');
  const [replyTarget, setReplyTarget] = useState<{ id: string; name: string } | null>(null);
  const [posting, setPosting] = useState(false);
  const [composerError, setComposerError] = useState('');

  const load = useCallback(() => {
    if (!id) return;
    const key = `review:${id}`;
    // Only show the skeleton when there is nothing cached to paint. With a
    // cached payload the screen is already rendered; we revalidate quietly.
    if (payloadCache.get<ReviewDetail>(key) === undefined) {
      setLoading(true);
    }
    setError(false);
    payloadCache
      .getWithRevalidate<ReviewDetail>(
        key,
        () =>
          // Treat a null detail as an error so it is never cached and a
          // cold open with no data falls through to the error state.
          fetchReviewDetail(id).then((data) => {
            if (!data) throw new Error('Review not found');
            return data;
          }),
        payloadCache.PAYLOAD_TTL_MS,
      )
      .then(setReview)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // The thread loads independently of the review payload, with its own
  // loading and error states so a failed or in-flight fetch never reads
  // as "No comments yet". Retry re-runs only this fetch.
  const loadReplies = useCallback(() => {
    if (!id) return;
    setThreadState('loading');
    fetchReviewReplies(id)
      .then((res) => {
        if (res) {
          setComments(res.comments);
          setThreadState('loaded');
        } else {
          setThreadState('error');
        }
      })
      .catch(() => setThreadState('error'));
  }, [id]);

  useEffect(() => {
    loadReplies();
  }, [loadReplies]);

  // Apply an authoritative update to the review payload and write it back
  // to the session cache (rather than invalidating), so the next open of
  // this screen paints the post-mutation state.
  const patchReview = useCallback(
    (patch: (cur: ReviewDetail) => ReviewDetail) => {
      setReview((cur) => {
        if (!cur) return cur;
        const updated = patch(cur);
        if (cacheKey) payloadCache.set(cacheKey, updated);
        return updated;
      });
    },
    [cacheKey],
  );

  // Optimistic like toggle, following the follow-toggle pattern in
  // app/user/[id].tsx but with an error toast on rollback. Only the
  // server's authoritative { liked, count } response is written to the
  // cache; the optimistic flip and the rollback stay in local state.
  const handleToggleLike = useCallback(async () => {
    if (!review) return;
    const prev = review.likes;
    setReview((cur) =>
      cur
        ? { ...cur, likes: { liked: !prev.liked, count: prev.count + (prev.liked ? -1 : 1) } }
        : cur,
    );
    try {
      const likes = prev.liked ? await unlikeReview(review.id) : await likeReview(review.id);
      patchReview((cur) => ({ ...cur, likes }));
    } catch {
      setReview((cur) => (cur ? { ...cur, likes: prev } : cur));
      showError('Could not update like. Please try again.');
    }
  }, [review, patchReview, showError]);

  // Non-optimistic post: the new entry renders only from the server
  // response, the draft clears only on success, and a failure keeps the
  // typed text next to the server's error string.
  const handlePostReply = useCallback(async () => {
    const body = draft.trim();
    if (!body || posting || !id) return;
    setPosting(true);
    setComposerError('');
    try {
      const reply = await postReply(id, body, replyTarget?.id);
      if (replyTarget) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === replyTarget.id ? { ...c, children: [...c.children, reply] } : c,
          ),
        );
      } else {
        setComments((prev) => [...prev, { ...reply, children: [] }]);
      }
      patchReview((cur) => ({ ...cur, replyCount: cur.replyCount + 1 }));
      setDraft('');
      setReplyTarget(null);
    } catch (e: any) {
      setComposerError(e.message || 'Could not post comment. Please try again.');
    } finally {
      setPosting(false);
    }
  }, [draft, posting, id, replyTarget, patchReview]);

  const performDeleteReply = useCallback(
    async (row: CommentRow) => {
      // A top-level delete cascades to its children server-side; mirror
      // that in the count so it stays consistent with a refetch.
      const target =
        row.parentId === null ? comments.find((c) => c.id === row.reply.id) : null;
      const removed = row.parentId === null ? 1 + (target?.children.length ?? 0) : 1;
      try {
        await deleteReply(row.reply.id);
        setComments((prev) =>
          row.parentId === null
            ? prev.filter((c) => c.id !== row.reply.id)
            : prev.map((c) =>
                c.id === row.parentId
                  ? { ...c, children: c.children.filter((ch) => ch.id !== row.reply.id) }
                  : c,
              ),
        );
        patchReview((cur) => ({ ...cur, replyCount: Math.max(0, cur.replyCount - removed) }));
      } catch {
        showError('Could not delete comment. Please try again.');
      }
    },
    [comments, patchReview, showError],
  );

  // Top-level deletes cascade to every reply beneath them, so they get a
  // confirmation first, mirroring the web thread's ConfirmDialog. Child
  // replies keep the direct, no-confirm delete.
  const handleDeleteReply = useCallback(
    (row: CommentRow) => {
      if (row.parentId !== null) {
        performDeleteReply(row);
        return;
      }
      const childCount =
        comments.find((c) => c.id === row.reply.id)?.children.length ?? 0;
      Alert.alert(
        'Delete comment?',
        childCount > 0
          ? `This will also delete its ${childCount} ${childCount === 1 ? 'reply' : 'replies'}.`
          : 'This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => performDeleteReply(row) },
        ],
      );
    },
    [comments, performDeleteReply],
  );

  if (loading) return <ReviewDetailSkeleton />;

  if (error || !review) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Could not load review</Text>
        <Pressable onPress={load} style={styles.retryButton}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const { film, user } = review;
  const authorName = user.name ?? 'Anonymous';
  const year = film.releaseDate ? new Date(film.releaseDate).getFullYear() : null;
  const prose = stitchReviewProse(review);
  const dataPoints = film.sentimentGraph?.dataPoints ?? [];
  const isAuthor = authUser?.id != null && authUser.id === user.id;
  const blind = resolveBlindForFilm(
    blindState,
    review.filmId,
    isAuthor || optimisticReviewed,
  );
  const posterUri = getPosterUrl(film, 'thumbnail');
  const rows = flattenComments(comments);

  const header = (
    <View>
      {/* Back chevron (same inline SVG and 44x44 target as the film screen) */}
      <Pressable
        onPress={() => {
          // Deep links land here with no history; falling back to Explore
          // keeps the chevron from being a dead control.
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)/explore');
          }
        }}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
          <Path d="M15 18l-6-6 6-6" stroke={colors.ivory} strokeWidth={2} />
        </Svg>
      </Pressable>

      {/* Film context, tappable through to the film screen */}
      <Pressable
        onPress={() => router.push(`/film/${review.filmId}` as any)}
        style={styles.filmRow}
        accessibilityRole="button"
        accessibilityLabel={`View ${film.title}`}
      >
        {posterUri ? (
          <Image source={{ uri: posterUri }} style={styles.filmPoster} resizeMode="cover" />
        ) : (
          <View style={[styles.filmPoster, { backgroundColor: 'rgba(30,30,60,0.8)' }]} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.filmTitle} numberOfLines={2}>{film.title}</Text>
          <Text style={styles.filmMeta}>
            {[year, film.director].filter(Boolean).join(' \u00B7 ')}
          </Text>
        </View>
      </Pressable>

      {/* The review itself */}
      <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <Pressable
            style={styles.reviewAuthor}
            onPress={() => router.push(`/user/${user.id}` as any)}
            accessibilityRole="button"
            accessibilityLabel={`View ${authorName}'s profile`}
          >
            {user.image ? (
              <Image source={{ uri: user.image }} style={styles.reviewAvatar} />
            ) : (
              <View style={[styles.reviewAvatar, styles.reviewAvatarFallback]}>
                <Text style={styles.reviewAvatarText}>{getInitials(authorName)}</Text>
              </View>
            )}
            <View>
              <Text style={styles.reviewName}>{authorName}</Text>
              <Text style={styles.reviewTime}>{timeAgo(review.createdAt)}</Text>
            </View>
          </Pressable>
          {/* Blind mode hides score numbers until the viewer has reviewed
              the film; the arc below stays visible (shape is not gated). */}
          {blind ? (
            <EyeOffIcon color="rgba(245,240,225,0.3)" size={18} />
          ) : (
            <Text style={styles.reviewScore}>{formatScore(review.overallRating)}</Text>
          )}
        </View>

        {prose ? <Text style={styles.proseText}>{prose}</Text> : null}

        {/* An empty beatRatings object has no beats to overlay, same as
            null; skip the card so it never renders as an empty box. */}
        {review.beatRatings !== null &&
          Object.keys(review.beatRatings).length > 0 &&
          dataPoints.length > 1 && (
          <View style={styles.graphCard} testID="beat-arc-card">
            <ReviewBeatArc dataPoints={dataPoints} beatRatings={review.beatRatings} />
          </View>
        )}

        {/* The server 403s a self-like, so the button is hidden entirely
            for the review's author rather than rendered to fail. */}
        {!isAuthor && (
          <Pressable
            onPress={() => gate(handleToggleLike)}
            style={styles.likeButton}
            accessibilityRole="button"
            accessibilityLabel={review.likes.liked ? 'Unlike review' : 'Like review'}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 21l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.18L12 21z"
                stroke={colors.gold}
                strokeWidth={1.8}
                fill={review.likes.liked ? colors.gold : 'none'}
              />
            </Svg>
            <Text style={styles.likeCount}>{review.likes.count}</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.commentsTitle}>Comments</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={rows}
          keyExtractor={(row) => row.reply.id}
          renderItem={({ item }) => (
            <CommentRowView
              row={item}
              viewerId={authUser?.id}
              onReply={() =>
                setReplyTarget({ id: item.reply.id, name: item.reply.user.name ?? 'Anonymous' })
              }
              onDelete={() => handleDeleteReply(item)}
            />
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={
            threadState === 'loading' ? (
              <Text style={styles.emptyThread}>Loading comments...</Text>
            ) : threadState === 'error' ? (
              <View style={styles.threadErrorRow}>
                <Text style={styles.emptyThread}>Could not load comments.</Text>
                <Pressable
                  onPress={loadReplies}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading comments"
                >
                  <Text style={styles.threadRetryText}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.emptyThread}>No comments yet. Be the first.</Text>
            )
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        {/* Composer, pinned below the list */}
        <View style={[styles.composerWrap, { paddingBottom: insets.bottom + 8 }]}>
          {replyTarget && (
            <View style={styles.replyingRow}>
              <Text style={styles.replyingText} numberOfLines={1}>
                Replying to {replyTarget.name}
              </Text>
              <Pressable
                onPress={() => setReplyTarget(null)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Cancel reply"
              >
                <Text style={styles.replyingCancel}>{'\u2715'}</Text>
              </Pressable>
            </View>
          )}
          {composerError ? <Text style={styles.composerError}>{composerError}</Text> : null}
          {draft.length > COUNTER_THRESHOLD && (
            <Text style={styles.charCounter}>
              {draft.length}/{MAX_REPLY_LENGTH}
            </Text>
          )}
          <View style={styles.composerRow}>
            <TextInput
              style={styles.composerInput}
              placeholder="Add a comment"
              placeholderTextColor="rgba(245,240,225,0.2)"
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={MAX_REPLY_LENGTH}
              editable={!posting}
            />
            <Pressable
              onPress={() => gate(handlePostReply)}
              disabled={posting || !draft.trim()}
              style={[styles.postButton, (posting || !draft.trim()) && { opacity: 0.4 }]}
              accessibilityRole="button"
              accessibilityLabel="Post comment"
            >
              <Text style={styles.postButtonText}>Post</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {authSheet}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: 14,
    paddingTop: 0,
  },

  // Back button
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },

  // Film context row
  filmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  filmPoster: {
    width: 44,
    height: 64,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.15)',
  },
  filmTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    color: colors.ivory,
    lineHeight: 21,
    letterSpacing: -0.3,
  },
  filmMeta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.4)',
    marginTop: 2,
  },

  // Review card
  reviewCard: {
    backgroundColor: 'rgba(245,240,225,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.08)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  reviewAvatarFallback: {
    backgroundColor: 'rgba(200,169,81,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: {
    fontSize: 11,
    color: colors.gold,
    fontFamily: fonts.bodyMedium,
  },
  reviewName: {
    fontSize: 12,
    color: colors.ivory,
    fontFamily: fonts.bodyMedium,
  },
  reviewTime: {
    fontSize: 9,
    color: 'rgba(245,240,225,0.3)',
    fontFamily: fonts.body,
    marginTop: 1,
  },
  reviewScore: {
    fontSize: 16,
    color: colors.gold,
    fontFamily: fonts.bodySemiBold,
  },
  proseText: {
    fontSize: 12,
    color: 'rgba(245,240,225,0.7)',
    fontFamily: fonts.body,
    lineHeight: 18,
    marginBottom: 10,
  },

  // Dual arc card
  graphCard: {
    backgroundColor: 'rgba(245,240,225,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.10)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },

  // Like button
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.3)',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  likeCount: {
    fontSize: 12,
    color: colors.gold,
    fontFamily: fonts.bodyMedium,
  },

  // Comments
  commentsTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.ivory,
    letterSpacing: -0.1,
    marginBottom: 8,
  },
  emptyThread: {
    fontSize: 11,
    color: 'rgba(245,240,225,0.3)',
    fontFamily: fonts.body,
  },
  threadErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  threadRetryText: {
    fontSize: 11,
    color: colors.gold,
    fontFamily: fonts.bodyMedium,
  },
  commentRow: {
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,240,225,0.06)',
  },
  commentChild: {
    marginLeft: 32,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  commentAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  commentAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  commentAvatarFallback: {
    backgroundColor: 'rgba(200,169,81,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    fontSize: 9,
    color: colors.gold,
    fontFamily: fonts.bodyMedium,
  },
  commentName: {
    fontSize: 11,
    color: colors.ivory,
    fontFamily: fonts.bodyMedium,
  },
  commentTime: {
    fontSize: 9,
    color: 'rgba(245,240,225,0.3)',
    fontFamily: fonts.body,
  },
  commentBody: {
    fontSize: 11,
    color: 'rgba(245,240,225,0.6)',
    fontFamily: fonts.body,
    lineHeight: 16,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 6,
  },
  commentActionText: {
    fontSize: 10,
    color: 'rgba(200,169,81,0.7)',
    fontFamily: fonts.bodyMedium,
  },
  commentDeleteText: {
    fontSize: 10,
    color: colors.negativeRed,
    fontFamily: fonts.bodyMedium,
  },

  // Composer
  composerWrap: {
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(200,169,81,0.12)',
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  replyingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  replyingText: {
    flex: 1,
    fontSize: 10,
    color: 'rgba(245,240,225,0.4)',
    fontFamily: fonts.body,
  },
  replyingCancel: {
    fontSize: 12,
    color: 'rgba(245,240,225,0.4)',
    fontFamily: fonts.body,
    paddingHorizontal: 4,
  },
  composerError: {
    fontSize: 10,
    color: colors.negativeRed,
    fontFamily: fonts.body,
    marginBottom: 6,
  },
  charCounter: {
    fontSize: 9,
    color: 'rgba(245,240,225,0.35)',
    fontFamily: fonts.body,
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  composerInput: {
    flex: 1,
    backgroundColor: 'rgba(245,240,225,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 38,
    maxHeight: 110,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.ivory,
  },
  postButton: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  postButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.background,
  },

  // Error state
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: 'rgba(245,240,225,0.5)',
    fontFamily: fonts.body,
    marginBottom: 12,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(200,169,81,0.3)',
    borderRadius: 8,
  },
  retryText: {
    fontSize: 13,
    color: colors.gold,
    fontFamily: fonts.bodyMedium,
  },
});
