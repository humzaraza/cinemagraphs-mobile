import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { colors, fonts } from '../constants/theme';

interface UserCardUser {
  id: string;
  name?: string | null;
  username?: string | null;
  image?: string | null;
  reviewCount?: number;
  followerCount?: number;
}

interface UserCardProps {
  user: UserCardUser;
  onPress: () => void;
  showStats?: boolean;
}

function getAvatarUri(image: string | null | undefined): string | null {
  if (!image) return null;
  if (image.startsWith('http')) return image;
  if (image.startsWith('/')) return `https://image.tmdb.org/t/p/w185${image}`;
  return null;
}

function getInitial(user: UserCardUser): string {
  if (user.name) return user.name.charAt(0).toUpperCase();
  if (user.username) return user.username.charAt(0).toUpperCase();
  return '?';
}

export default function UserCard({ user, onPress, showStats = true }: UserCardProps) {
  const avatarUri = getAvatarUri(user.image);

  return (
    <Pressable onPress={onPress} style={styles.container}>
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitial}>{getInitial(user)}</Text>
        </View>
      )}

      <View style={styles.center}>
        <Text style={styles.name} numberOfLines={1}>
          {user.name || user.username || 'User'}
        </Text>
        {user.username ? (
          <Text style={styles.username} numberOfLines={1}>@{user.username}</Text>
        ) : null}
      </View>

      {showStats && (user.reviewCount != null || user.followerCount != null) && (
        <View style={styles.stats}>
          {user.reviewCount != null && (
            <Text style={styles.statText}>{user.reviewCount} reviews</Text>
          )}
          {user.followerCount != null && (
            <Text style={styles.statText}>{user.followerCount} followers</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(245,240,225,0.06)',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(200,169,81,0.3)',
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(200,169,81,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.gold,
  },
  center: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.ivory,
  },
  username: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(245,240,225,0.4)',
    marginTop: 1,
  },
  stats: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  statText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.3)',
  },
});
