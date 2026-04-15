import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../constants/theme';
import { useAuth } from '../providers/AuthProvider';
import { fetchFollowers, fetchFollowing, followUser, unfollowUser } from '../lib/api';

interface FollowUser {
  id: string;
  name?: string | null;
  username?: string | null;
  image?: string | null;
  isFollowing?: boolean;
}

interface FollowersModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  initialTab: 'followers' | 'following';
}

function getAvatarUri(image: string | null | undefined): string | null {
  if (!image) return null;
  if (image.startsWith('http')) return image;
  if (image.startsWith('/')) return `https://image.tmdb.org/t/p/w185${image}`;
  return null;
}

function getInitial(user: FollowUser): string {
  if (user.name) return user.name.charAt(0).toUpperCase();
  if (user.username) return user.username.charAt(0).toUpperCase();
  return '?';
}

export default function FollowersModal({ visible, onClose, userId, initialTab }: FollowersModalProps) {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async (tab: 'followers' | 'following') => {
    setLoading(true);
    try {
      const data = tab === 'followers'
        ? await fetchFollowers(userId)
        : await fetchFollowing(userId);
      setUsers(data.users ?? []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
      loadData(initialTab);
    }
  }, [visible, initialTab, loadData]);

  const handleTabSwitch = (tab: 'followers' | 'following') => {
    setActiveTab(tab);
    loadData(tab);
  };

  const handleToggleFollow = async (targetUser: FollowUser) => {
    const wasFollowing = targetUser.isFollowing;
    setUsers((prev) =>
      prev.map((u) => u.id === targetUser.id ? { ...u, isFollowing: !wasFollowing } : u)
    );
    try {
      if (wasFollowing) {
        await unfollowUser(targetUser.id);
      } else {
        await followUser(targetUser.id);
      }
    } catch {
      setUsers((prev) =>
        prev.map((u) => u.id === targetUser.id ? { ...u, isFollowing: wasFollowing } : u)
      );
    }
  };

  const handleUserPress = (user: FollowUser) => {
    onClose();
    router.push(`/user/${user.id}` as any);
  };

  const renderUser = ({ item }: { item: FollowUser }) => {
    const avatarUri = getAvatarUri(item.image);
    const isMe = authUser?.id === item.id;

    return (
      <Pressable onPress={() => handleUserPress(item)} style={styles.userRow}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{getInitial(item)}</Text>
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.name || item.username || 'User'}
          </Text>
          {item.username ? (
            <Text style={styles.userHandle} numberOfLines={1}>@{item.username}</Text>
          ) : null}
        </View>
        {!isMe && (
          <Pressable
            onPress={() => handleToggleFollow(item)}
            style={[
              styles.followBtn,
              item.isFollowing ? styles.followBtnActive : styles.followBtnInactive,
            ]}
          >
            <Text
              style={[
                styles.followBtnText,
                item.isFollowing ? styles.followBtnTextActive : styles.followBtnTextInactive,
              ]}
            >
              {item.isFollowing ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
        )}
      </Pressable>
    );
  };

  const emptyText = activeTab === 'followers' ? 'No followers yet' : 'Not following anyone yet';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.modal} onPress={() => {}}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {activeTab === 'followers' ? 'Followers' : 'Following'}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.closeBtn}>X</Text>
            </Pressable>
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            <Pressable onPress={() => handleTabSwitch('followers')} style={styles.tab}>
              <Text style={[styles.tabText, activeTab === 'followers' && styles.tabTextActive]}>
                Followers
              </Text>
              {activeTab === 'followers' && <View style={styles.tabUnderline} />}
            </Pressable>
            <Pressable onPress={() => handleTabSwitch('following')} style={styles.tab}>
              <Text style={[styles.tabText, activeTab === 'following' && styles.tabTextActive]}>
                Following
              </Text>
              {activeTab === 'following' && <View style={styles.tabUnderline} />}
            </Pressable>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.gold} />
            </View>
          ) : (
            <FlatList
              data={users}
              renderItem={renderUser}
              keyExtractor={(item) => item.id}
              contentContainerStyle={users.length === 0 ? styles.centered : styles.listContent}
              ListEmptyComponent={
                <Text style={styles.emptyText}>{emptyText}</Text>
              }
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '85%',
    maxHeight: '70%',
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.15)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.ivory,
  },
  closeBtn: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: 'rgba(245,240,225,0.4)',
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
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
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: colors.gold,
    borderRadius: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(245,240,225,0.3)',
    textAlign: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,240,225,0.06)',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(200,169,81,0.3)',
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(200,169,81,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.gold,
  },
  userInfo: {
    flex: 1,
    marginLeft: 10,
  },
  userName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ivory,
  },
  userHandle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.4)',
    marginTop: 1,
  },
  followBtn: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 6,
    marginLeft: 8,
  },
  followBtnInactive: {
    borderWidth: 1,
    borderColor: colors.teal,
  },
  followBtnActive: {
    backgroundColor: colors.gold,
  },
  followBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
  },
  followBtnTextInactive: {
    color: colors.teal,
  },
  followBtnTextActive: {
    color: colors.background,
  },
});
