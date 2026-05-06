import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts } from '../../constants/theme';

type EmptyStateCardProps = {
  icon: string;
  title: string;
  body: string;
  ctaLabel: string;
  onCtaPress: () => void;
};

export default function EmptyStateCard({
  icon,
  title,
  body,
  ctaLabel,
  onCtaPress,
}: EmptyStateCardProps) {
  return (
    <View style={styles.card}>
      {/* TODO Phase 7: confirm icon glyphs (◐, ◫) render cleanly on
          both platforms; if not, swap for an SVG. */}
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
        onPress={onCtaPress}
        hitSlop={8}
        style={styles.cta}
      >
        <Text style={styles.ctaText}>{ctaLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(245,240,225,0.03)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(245,240,225,0.1)',
    borderRadius: 14,
    alignItems: 'center',
  },
  icon: {
    fontSize: 28,
    marginBottom: 10,
    opacity: 0.4,
    color: colors.ivory,
  },
  title: {
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    color: 'rgba(245,240,225,0.65)',
    marginBottom: 4,
  },
  body: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
    color: 'rgba(245,240,225,0.42)',
    textAlign: 'center',
  },
  cta: {
    marginTop: 14,
    paddingVertical: 9,
    paddingHorizontal: 18,
    backgroundColor: colors.gold,
    borderRadius: 99,
  },
  ctaText: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: colors.background,
    letterSpacing: 0.13,
  },
});
