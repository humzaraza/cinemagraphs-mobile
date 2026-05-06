import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts } from '../../constants/theme';

type ProfileStatsProps = {
  reviewed: number;
  following: number;
  followers: number;
  onPressFollowing: () => void;
  onPressFollowers: () => void;
};

export default function ProfileStats({
  reviewed,
  following,
  followers,
  onPressFollowing,
  onPressFollowers,
}: ProfileStatsProps) {
  return (
    <View style={styles.row}>
      <View style={styles.col}>
        <Text style={styles.num}>{reviewed}</Text>
        <Text style={styles.label}>Reviewed</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${following} following`}
        onPress={onPressFollowing}
        style={styles.col}
      >
        <Text style={styles.num}>{following}</Text>
        <Text style={styles.label}>Following</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${followers} followers`}
        onPress={onPressFollowers}
        style={styles.col}
      >
        <Text style={styles.num}>{followers}</Text>
        <Text style={styles.label}>Followers</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(245,240,225,0.06)',
  },
  col: {
    // Each block is its own column; no extra layout needed.
  },
  num: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    lineHeight: 18,
    letterSpacing: -0.18,         // RN approx of -0.01em at 18px
    color: colors.ivory,
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontFamily: fonts.bodyMedium, // weight 500 per mockup
    fontSize: 11,
    color: 'rgba(245,240,225,0.5)',
    letterSpacing: 0.22,          // RN approx of 0.02em at 11px
  },
});
