import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts } from '../../constants/theme';

const AVATAR_SIZE = 84;

type ProfileAvatarProps = {
  name: string | null;
  image: string | null;
};

export default function ProfileAvatar({ name, image }: ProfileAvatarProps) {
  const initial = name?.[0]?.toUpperCase() ?? '?';

  return (
    <View style={styles.outer}>
      {image ? (
        <Image
          source={{ uri: image }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={['#c8a951', '#8a6f30', '#5c4a1f']}
          start={{ x: 0.3, y: 0.3 }}
          end={{ x: 1, y: 1 }}
          style={styles.fallback}
        >
          <Text style={styles.initial}>{initial}</Text>
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    // Border colour matches page background so the avatar reads as a
    // cutout against the banner above (per mockup).
    borderColor: colors.background,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
    fontFamily: fonts.bodyBold,
    fontSize: 30,
    color: colors.background,
    letterSpacing: -0.3, // RN approx of -0.01em at 30px
  },
});
