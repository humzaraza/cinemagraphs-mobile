import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, borderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/providers/AuthProvider';
import {
  fetchPublicProfile,
  followUser,
  unfollowUser,
  fetchFollowers,
} from '../../src/lib/api';
import FollowersModal from '../../src/components/FollowersModal';
import { getPosterUrl } from '../../src/lib/tmdb-image';

// TODO: Remove when getAvatarUrl helper ships. Avatar URL handling
// is parked as a followup to refactor/tmdb-image-helper.
const TMDB_POSTER = 'https://image.tmdb.org/t/p/w500';

function getPosterUri(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  if (path.startsWith('/')) return `${TMDB_POSTER}${path}`;
  return null;
}

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M15 6l-6 6 6 6" stroke={colors.ivory} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

type ProfileTab = 'reviews' | 'lists';

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: authUser, isAuthenticated } = useAuth();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [activeTab, setActiveTab] = useState<ProfileTab>('reviews');

  // Followers modal
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersInitialTab, setFollowersInitialTab] = useState<'followers' | 'following'>('followers');

  const isOwnProfile = authUser?.id === id;

  const loadProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchPublicProfile(id);
      if (!data) {
        setNotFound(true);
        return;
      }
      setProfile(data);
      setFollowerCount(data.stats?.followerCount ?? data.user?.followerCount ?? 0);

      // Check if current user follows this user
      if (isAuthenticated && authUser?.id && authUser.id !== id) {
        try {
          const followersData = await fetchFollowers(id);
          const followers = followersData.users ?? [];
          setIsFollowing(followers.some((f: any) => f.id === authUser.id));
        } catch {
          // Ignore errors checking follow status
        }
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id, isAuthenticated, authUser?.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleFollowToggle = async () => {
    if (!isAuthenticated) {
      Alert.alert('Sign in to follow users');
      return;
    }
    if (!id) return;

    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowerCount((c) => c + (wasFollowing ? -1 : 1));

    try {
      if (wasFollowing) {
        await unfollowUser(id);
      } else {
        await followUser(id);
      }
    } catch {
      setIsFollowing(wasFollowing);
      setFollowerCount((c) => c + (wasFollowing ? 1 : -1));
    }
  };

  const openFollowersModal = (tab: 'followers' | 'following') => {
    setFollowersInitialTab(tab);
    setShowFollowersModal(true);
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      </View>
    );
  }

  if (notFound || !profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <BackIcon />
        </Pressable>
        <View style={styles.centered}>
          <Text style={styles.notFoundText}>User not found</Text>
        </View>
      </View>
    );
  }

  const user = profile.user ?? profile;
  const stats = profile.stats ?? {};
  const reviews = profile.reviews ?? [];
  const lists = profile.lists ?? [];
  const displayName = user.name || user.username || 'User';
  const initial = displayName.charAt(0).toUpperCase();
  const avatarUri = getPosterUri(user.image);
  const followingCount = stats.followingCount ?? user.followingCount ?? 0;
  const filmsCount = stats.totalReviews ?? 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <BackIcon />
        </Pressable>

        {/* Avatar */}
        <View style={styles.headerSection}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}
          <Text style={styles.displayName}>{displayName}</Text>
          {user.username && (
            <Text style={styles.username}>@{user.username}</Text>
          )}
          {user.bio ? (
            <Text style={styles.bio} numberOfLines={3}>{user.bio}</Text>
          ) : null}
        </View>

        {/* Stats row */}
        <View style={styles.statsCard}>
          <View style={styles.statCol}>
            <Text style={styles.statNumber}>{filmsCount}</Text>
            <Text style={styles.statLabel}>Films</Text>
          </View>
          <View style={styles.statDivider} />
          <Pressable style={styles.statCol} onPress={() => openFollowersModal('following')}>
            <Text style={styles.statNumber}>{followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </Pressable>
          <View style={styles.statDivider} />
          <Pressable style={styles.statCol} onPress={() => openFollowersModal('followers')}>
            <Text style={styles.statNumber}>{followerCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </Pressable>
        </View>

        {/* Follow / Unfollow button */}
        {!isOwnProfile && (
          <Pressable
            onPress={handleFollowToggle}
            style={[styles.followButton, isFollowing ? styles.followButtonActive : styles.followButtonInactive]}
          >
            <Text style={[styles.followButtonText, isFollowing ? styles.followButtonTextActive : styles.followButtonTextInactive]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
        )}

        {/* Sub-tabs */}
        <View style={styles.tabRow}>
          <Pressable onPress={() => setActiveTab('reviews')} style={styles.tab}>
            <Text style={[styles.tabText, activeTab === 'reviews' && styles.tabTextActive]}>
              Reviews
            </Text>
            {activeTab === 'reviews' && <View style={styles.tabUnderline} />}
          </Pressable>
          <Pressable onPress={() => setActiveTab('lists')} style={styles.tab}>
            <Text style={[styles.tabText, activeTab === 'lists' && styles.tabTextActive]}>
              Lists
            </Text>
            {activeTab === 'lists' && <View style={styles.tabUnderline} />}
          </Pressable>
        </View>

        {/* Tab content */}
        {activeTab === 'reviews' ? (
          reviews.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No reviews yet</Text>
            </View>
          ) : (
            reviews.map((review: any) => {
              const posterUri = getPosterUrl(review.film, 'thumbnail');
              const snippet = review.combinedText
                ? review.combinedText.slice(0, 100) + (review.combinedText.length > 100 ? '...' : '')
                : null;
              return (
                <Pressable
                  key={review.id}
                  onPress={() => router.push(`/film/${review.filmId}` as any)}
                  style={styles.reviewCard}
                >
                  {posterUri ? (
                    <Image source={{ uri: posterUri }} style={styles.reviewPoster} resizeMode="cover" />
                  ) : (
                    <View style={[styles.reviewPoster, { backgroundColor: '#1a1a2e' }]} />
                  )}
                  <View style={styles.reviewInfo}>
                    <Text style={styles.reviewTitle} numberOfLines={1}>
                      {review.film?.title ?? 'Film'}
                    </Text>
                    {review.overallRating != null && (
                      <Text style={styles.reviewRating}>{review.overallRating}/10</Text>
                    )}
                    {snippet ? (
                      <Text style={styles.reviewSnippet} numberOfLines={2}>{snippet}</Text>
                    ) : review.beatRatings ? (
                      <Text style={styles.reviewSnippet}>
                        Rated {Object.keys(review.beatRatings).length} story beats
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })
          )
        ) : (
          lists.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No public lists</Text>
            </View>
          ) : (
            lists.map((list: any) => (
              <Pressable
                key={list.id}
                onPress={() => router.push(`/list/${list.id}` as any)}
                style={styles.listCard}
              >
                <View style={styles.listInfo}>
                  <Text style={styles.listName} numberOfLines={1}>{list.name}</Text>
                  <View style={styles.listMetaRow}>
                    {list.genreTag && (
                      <View style={styles.genrePill}>
                        <Text style={styles.genrePillText}>{list.genreTag}</Text>
                      </View>
                    )}
                    <Text style={styles.listMeta}>
                      {list.filmCount ?? 0} film{(list.filmCount ?? 0) !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                {(list.previewPosters ?? []).length > 0 && (
                  <View style={styles.listPosters}>
                    {list.previewPosters.slice(0, 4).map((p: string, i: number) => (
                      <Image
                        key={i}
                        source={{ uri: getPosterUrl({ posterPath: p }, 'thumbnail') ?? undefined }}
                        style={[styles.listThumb, i > 0 && { marginLeft: -6 }]}
                        resizeMode="cover"
                      />
                    ))}
                  </View>
                )}
              </Pressable>
            ))
          )
        )}
      </ScrollView>

      <FollowersModal
        visible={showFollowersModal}
        onClose={() => setShowFollowersModal(false)}
        userId={id!}
        initialTab={followersInitialTab}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: 'rgba(245,240,225,0.4)',
  },
  backBtn: {
    paddingVertical: 12,
    paddingRight: 16,
    alignSelf: 'flex-start',
  },

  // Header
  headerSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(200,169,81,0.3)',
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: 'rgba(200,169,81,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontFamily: fonts.bodyMedium,
    fontSize: 22,
    color: colors.gold,
  },
  displayName: {
    fontFamily: fonts.bodyBold,
    fontSize: 20,
    color: colors.ivory,
    marginTop: 10,
    letterSpacing: -0.4,
  },
  username: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: 'rgba(245,240,225,0.4)',
    marginTop: 2,
  },
  bio: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(245,240,225,0.4)',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 16,
  },

  // Stats
  statsCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.08)',
    borderRadius: borderRadius.lg,
    paddingVertical: 12,
    marginBottom: 16,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: fonts.bodyMedium,
    fontSize: 18,
    color: colors.ivory,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
  },
  statDivider: {
    width: 0.5,
    backgroundColor: 'rgba(200,169,81,0.12)',
    marginVertical: 4,
  },

  // Follow button
  followButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 20,
  },
  followButtonInactive: {
    borderWidth: 1,
    borderColor: colors.teal,
  },
  followButtonActive: {
    backgroundColor: colors.gold,
  },
  followButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  followButtonTextInactive: {
    color: colors.teal,
  },
  followButtonTextActive: {
    color: colors.background,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  tab: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  tabText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
  },
  tabTextActive: {
    fontFamily: fonts.bodyMedium,
    color: colors.gold,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.gold,
    borderRadius: 1,
  },

  // Empty
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(245,240,225,0.3)',
  },

  // Review cards
  reviewCard: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,240,225,0.06)',
    gap: 12,
  },
  reviewPoster: {
    width: 50,
    height: 70,
    borderRadius: 4,
  },
  reviewInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  reviewTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ivory,
  },
  reviewRating: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.gold,
    marginTop: 2,
  },
  reviewSnippet: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(245,240,225,0.4)',
    marginTop: 3,
  },

  // List cards
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,240,225,0.06)',
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ivory,
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  genrePill: {
    borderWidth: 0.5,
    borderColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 1,
    paddingHorizontal: 6,
  },
  genrePillText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.gold,
  },
  listMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(245,240,225,0.4)',
  },
  listPosters: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  listThumb: {
    width: 32,
    height: 48,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.1)',
    backgroundColor: 'rgba(30,30,60,0.6)',
  },
});
