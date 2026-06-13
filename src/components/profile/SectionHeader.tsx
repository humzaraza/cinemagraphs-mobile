import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts } from '../../constants/theme';

type SectionHeaderProps = {
  title: string;
  allLink?: { label: string; onPress: () => void };
};

export default function SectionHeader({ title, allLink }: SectionHeaderProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {allLink && (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={allLink.label}
          onPress={allLink.onPress}
          // Baseline-aligned header: hitSlop reaches a 44pt target without a
          // min-height that would shift the row.
          hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
        >
          <Text style={styles.allLink}>{allLink.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 12,
  },
  title: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1.76,        // RN approx of 0.16em at 11px
    color: 'rgba(245,240,225,0.55)',
    textTransform: 'uppercase',
  },
  allLink: {
    fontFamily: fonts.bodyMedium, // weight 500 per spec
    fontSize: 13,
    color: colors.teal,
  },
});
