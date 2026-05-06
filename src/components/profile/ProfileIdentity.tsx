import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts } from '../../constants/theme';

type ProfileIdentityProps = {
  name: string | null;
  username: string | null;
  bio: string | null;
  onBioPlaceholderPress: () => void;
};

export default function ProfileIdentity({
  name,
  username,
  bio,
  onBioPlaceholderPress,
}: ProfileIdentityProps) {
  const displayName = name || 'Anonymous';
  const handle = '@' + (username || 'unknown');
  const hasBio = !!bio && bio.trim().length > 0;

  return (
    <View style={styles.wrap}>
      <Text style={styles.name}>{displayName}</Text>
      <Text style={styles.handle}>{handle}</Text>
      {hasBio ? (
        <Text style={styles.bio}>{bio}</Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a bio"
          onPress={onBioPlaceholderPress}
        >
          <Text style={styles.bioEmpty}>Add a bio in Edit Profile</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  name: {
    fontFamily: fonts.bodyBold,
    fontSize: 22,
    lineHeight: 25,        // 22 * 1.15 from mockup
    letterSpacing: -0.4,   // RN approx of -0.02em at 22px
    color: colors.ivory,
    marginBottom: 2,
  },
  handle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(245,240,225,0.5)',
    marginBottom: 10,
  },
  bio: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,        // 14 * 1.45 from mockup, rounded
    color: 'rgba(245,240,225,0.78)',
  },
  bioEmpty: {
    fontFamily: fonts.body,
    fontSize: 14,
    // No DM Sans italic variant is loaded in app/_layout.tsx; iOS may
    // synthesize, Android usually falls back to upright. Acceptable for
    // PR 1a; revisit in Phase 7 if visually off.
    fontStyle: 'italic',
    color: 'rgba(245,240,225,0.32)',
  },
});
