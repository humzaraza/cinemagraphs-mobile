import React from 'react';
import {
  View,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import BannerGradient from '../BannerGradient';
import type { BannerSource } from '../../lib/banner-url';

type ProfileBannerProps = {
  // Resolved source (gradient preset or backdrop URI). Caller resolves
  // via resolveBannerSource() so this component does not need to know
  // about the persisted bannerType discriminant or do any film lookup.
  source: BannerSource;
  onMenuPress: () => void;
};

const SCRIM_COLORS = ['rgba(13,13,26,0)', 'rgba(13,13,26,0.4)', 'rgba(13,13,26,1)'] as const;
const SCRIM_LOCATIONS = [0, 0.7, 1] as const;

export default function ProfileBanner({ source, onMenuPress }: ProfileBannerProps) {
  // Banner is full-bleed; the parent should render this outside any
  // horizontal padding. The 3-dots affordance opens a profile-actions
  // bottom sheet (Edit profile / Banner style / Settings).
  //
  // Aspect ratio is locked at 16:9 (PR 1b). aspectRatio is the source of
  // truth for layout; the explicit width is also passed to BannerGradient
  // so its SVG gets concrete pixel dimensions. Backdrop renders as a
  // full-fill Image with the same scrim treatment as the gradient path
  // for consistent legibility against the avatar that overlaps below.
  const { width: screenWidth } = useWindowDimensions();
  const bannerHeight = (screenWidth * 9) / 16;

  return (
    <View style={[styles.wrap, { width: screenWidth, aspectRatio: 16 / 9 }]}>
      {source.kind === 'gradient' ? (
        <BannerGradient
          presetKey={source.presetKey}
          width={screenWidth}
          height={bannerHeight}
          showScrim
        />
      ) : (
        <>
          <Image
            source={{ uri: source.uri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <LinearGradient
            colors={SCRIM_COLORS}
            locations={SCRIM_LOCATIONS}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.scrim, { height: bannerHeight * 0.6 }]}
            pointerEvents="none"
          />
        </>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Profile menu"
        onPress={onMenuPress}
        hitSlop={8}
        style={styles.menuBtn}
      >
        <DotsIcon />
      </Pressable>
    </View>
  );
}

function DotsIcon() {
  // Three vertical dots, ivory at 0.9 alpha so they read against any preset.
  const fill = 'rgba(245,240,225,0.9)';
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Circle cx={8} cy={3.5} r={1.5} fill={fill} />
      <Circle cx={8} cy={8} r={1.5} fill={fill} />
      <Circle cx={8} cy={12.5} r={1.5} fill={fill} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    position: 'relative',
  },
  scrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  menuBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(245,240,225,0.2)',
    backgroundColor: 'rgba(13,13,26,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
