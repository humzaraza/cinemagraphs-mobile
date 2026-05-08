import * as React from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  useWindowDimensions,
  type ImageStyle,
} from 'react-native';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, fonts } from '../../constants/theme';
import { getBackdropUrl, getPosterUrl } from '../../lib/tmdb-image';
import {
  isBannerPresetKey,
  BANNER_DEFAULT_KEY,
} from '../../constants/bannerPresets';
import BannerGradient from '../BannerGradient';
import type { BannerSpec } from '../../lib/onboarding-api';

export type DissolutionPoster = {
  posterPath: string;
  key: string;
};

type Props = {
  posters: DissolutionPoster[];
  bannerSpec: BannerSpec;
  onComplete: () => void;
};

const POSTER_WIDTH = 60;
const POSTER_HEIGHT = 90;
const GLOW_SIZE = 240;
const HELPER_BOTTOM = 60;

// Phase 1 (poster convergence) duration and easing.
const PHASE1_MS = 1500;

// Same scrim treatment used in reveal.tsx and ProfileBanner. Keeps the
// emerging banner's bottom legible across any preset / backdrop.
const SCRIM_COLORS = [
  'rgba(13,13,26,0)',
  'rgba(13,13,26,0.4)',
  'rgba(13,13,26,1)',
] as const;
const SCRIM_LOCATIONS = [0, 0.7, 1] as const;

type PosterPlan = {
  poster: DissolutionPoster;
  fromSide: 'left' | 'right';
  startY: number;
  arcHeight: number;
  delay: number;
};

function createPlan(
  poster: DissolutionPoster,
  i: number,
  screenHeight: number,
): PosterPlan {
  return {
    poster,
    fromSide: i % 2 === 0 ? 'left' : 'right',
    startY: 0.1 * screenHeight + Math.random() * 0.8 * screenHeight,
    arcHeight: 60 + Math.random() * 80,
    delay: i * 80,
  };
}

export function DissolutionAnimation({ posters, bannerSpec, onComplete }: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const hasPosters = posters.length > 0;

  // Emerging banner sits centered with 16pt edge inset on each side; the
  // mockup .dissolve-emerging-banner is ~67% of phone width with rounded
  // corners. RevealContent's static banner is full-bleed; the crossfade
  // accepts that visual shift in exchange for a glow + emergence at the
  // same focal point as the mockup.
  const bannerWidth = screenWidth - 32;
  const bannerHeight = (bannerWidth * 9) / 16;

  // Static per-poster animation params. Computed once at mount; useMemo
  // with empty deps so randomized startY/arcHeight do not re-roll on
  // re-render.
  const plans = React.useMemo<PosterPlan[]>(
    () => posters.map((poster, i) => createPlan(poster, i, screenHeight)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const progress = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.6);
  const bannerOpacity = useSharedValue(0);
  const bannerScale = useSharedValue(0.85);
  const helperOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (!hasPosters) {
      // Skip-everything path: 1000ms total. No convergence.
      glowOpacity.value = withSequence(
        withTiming(0.55, { duration: 300 }),
        withTiming(0, { duration: 300 }),
      );
      glowScale.value = withTiming(1.4, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      });
      bannerOpacity.value = withDelay(
        400,
        withTiming(1, { duration: 600 }),
      );
      bannerScale.value = withDelay(
        400,
        withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
      );
      const t = setTimeout(onComplete, 1000);
      return () => clearTimeout(t);
    }

    // Phase 1: posters arc in (0-1500ms)
    progress.value = withTiming(PHASE1_MS, {
      duration: PHASE1_MS,
      easing: Easing.out(Easing.cubic),
    });

    // Helper: fade in 0-300ms, fade out around glow time.
    helperOpacity.value = withSequence(
      withTiming(1, { duration: 300 }),
      withDelay(1400, withTiming(0, { duration: 400 })),
    );

    // Phase 2: gold glow grows + fades (1300-1900ms peak, then to 0)
    glowOpacity.value = withDelay(
      1300,
      withSequence(
        withTiming(0.55, { duration: 300 }),
        withTiming(0, { duration: 600 }),
      ),
    );
    glowScale.value = withDelay(
      1300,
      withTiming(1.4, { duration: 900, easing: Easing.out(Easing.cubic) }),
    );

    // Phase 3: banner emerges (1900-2500ms)
    bannerOpacity.value = withDelay(
      1900,
      withTiming(1, { duration: 600 }),
    );
    bannerScale.value = withDelay(
      1900,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );

    const t = setTimeout(onComplete, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: bannerOpacity.value,
    transform: [{ scale: bannerScale.value }],
  }));

  const helperStyle = useAnimatedStyle(() => ({
    opacity: helperOpacity.value,
  }));

  return (
    <View style={styles.overlay} pointerEvents="none">
      {plans.map((plan) => (
        <DissolutionPosterView
          key={plan.poster.key}
          plan={plan}
          progress={progress}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
        />
      ))}

      <Animated.View
        style={[
          styles.glow,
          {
            top: screenHeight / 2 - GLOW_SIZE / 2,
            left: screenWidth / 2 - GLOW_SIZE / 2,
          },
          glowStyle,
        ]}
      />

      <Animated.View
        style={[
          styles.bannerWrap,
          {
            top: screenHeight / 2 - bannerHeight / 2,
            left: screenWidth / 2 - bannerWidth / 2,
            width: bannerWidth,
            height: bannerHeight,
          },
          bannerStyle,
        ]}
      >
        <EmergingBanner
          spec={bannerSpec}
          width={bannerWidth}
          height={bannerHeight}
        />
      </Animated.View>

      {hasPosters ? (
        <Animated.View
          style={[styles.helperWrap, { bottom: HELPER_BOTTOM }, helperStyle]}
        >
          <Text style={styles.helperText}>Building your profile...</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function DissolutionPosterView({
  plan,
  progress,
  screenWidth,
  screenHeight,
}: {
  plan: PosterPlan;
  progress: SharedValue<number>;
  screenWidth: number;
  screenHeight: number;
}) {
  const fromLeft = plan.fromSide === 'left';
  const startX = fromLeft ? -POSTER_WIDTH : screenWidth + POSTER_WIDTH;
  const endX = (screenWidth - POSTER_WIDTH) / 2;
  const startY = plan.startY;
  const endY = (screenHeight - POSTER_HEIGHT) / 2;
  const arcHeight = plan.arcHeight;
  const delay = plan.delay;

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const elapsed = progress.value - delay;
    const span = Math.max(1, PHASE1_MS - delay);
    const localT = Math.max(0, Math.min(1, elapsed / span));

    const x = startX + (endX - startX) * localT;
    const linearY = startY + (endY - startY) * localT;
    const arcOffset = -4 * arcHeight * localT * (1 - localT);
    const y = linearY + arcOffset;

    const scale = 1 - 0.4 * localT;
    const opacity = localT < 0.85 ? 1 : Math.max(0, 1 - (localT - 0.85) / 0.15);

    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { scale },
      ],
      opacity,
    };
  });

  const uri = getPosterUrl({ posterPath: plan.poster.posterPath }, 'thumbnail');
  if (!uri) return null;

  return (
    <Animated.Image
      source={{ uri }}
      style={[styles.poster, animatedStyle]}
    />
  );
}

function EmergingBanner({
  spec,
  width,
  height,
}: {
  spec: BannerSpec;
  width: number;
  height: number;
}) {
  if (spec.bannerType === 'BACKDROP') {
    const path =
      typeof spec.bannerValue === 'object' && spec.bannerValue !== null
        ? spec.bannerValue.backdropPath
        : null;
    const uri = getBackdropUrl(path, 'preview');
    if (uri) {
      return (
        <View style={styles.bannerInner}>
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <LinearGradient
            colors={SCRIM_COLORS}
            locations={SCRIM_LOCATIONS}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.bannerScrim, { height: height * 0.6 }]}
            pointerEvents="none"
          />
        </View>
      );
    }
    return (
      <View style={styles.bannerInner}>
        <BannerGradient
          presetKey={BANNER_DEFAULT_KEY}
          width={width}
          height={height}
          showScrim
        />
      </View>
    );
  }

  const presetKey =
    typeof spec.bannerValue === 'string' && isBannerPresetKey(spec.bannerValue)
      ? spec.bannerValue
      : BANNER_DEFAULT_KEY;
  return (
    <View style={styles.bannerInner}>
      <BannerGradient
        presetKey={presetKey}
        width={width}
        height={height}
        showScrim
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  poster: {
    position: 'absolute',
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: 4,
    backgroundColor: colors.cardBackground,
  } as ImageStyle,
  // iOS: shadowRadius around a gold disc gives a soft halo. Android does
  // not honour shadowRadius for non-Image Views, so it falls back to a
  // solid disc with elevation. Cross-platform soft glow would need
  // react-native-skia and is out of scope for 7c.
  glow: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 80,
    elevation: 24,
  },
  bannerWrap: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 8,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
  },
  bannerInner: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 8,
  },
  bannerScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  helperWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  helperText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ivory,
    opacity: 0.45,
  },
});
