import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { colors, fonts } from '../../src/constants/theme';
import { useOnboarding } from '../../src/contexts/onboarding-context';
import { fetchSelectBanner, type BannerSpec } from '../../src/lib/onboarding-api';
import { savePendingBanner } from '../../src/lib/onboarding-persistence';
import { getBackdropUrl } from '../../src/lib/tmdb-image';
import {
  isBannerPresetKey,
  BANNER_DEFAULT_KEY,
} from '../../src/constants/bannerPresets';
import BannerGradient from '../../src/components/BannerGradient';
import {
  DissolutionAnimation,
  type DissolutionPoster,
} from '../../src/components/onboarding/DissolutionAnimation';
import { ERA_BLOCKS, GENRE_BLOCKS } from '../../src/data/onboardingCuration';

// Matches ProfileBanner.tsx: scrim fades the bottom of the banner so the
// avatar that overlaps below stays legible against any preset / backdrop.
const SCRIM_COLORS = [
  'rgba(13,13,26,0)',
  'rgba(13,13,26,0.4)',
  'rgba(13,13,26,1)',
] as const;
const SCRIM_LOCATIONS = [0, 0.7, 1] as const;

export default function RevealScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const { eras, genres, filmIds, filmDetails } = useOnboarding();

  const [bannerSpec, setBannerSpec] = useState<BannerSpec | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [animationDone, setAnimationDone] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const spec = await fetchSelectBanner(filmIds, genres, eras);
      if (cancelled || !isMountedRef.current) return;
      setBannerSpec(spec);
      setIsLoading(false);
      try {
        await savePendingBanner(spec);
      } catch {
        // Persistence failure shouldn't block reveal; future auth handler
        // will simply not find a pending banner and apply nothing.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eras, genres, filmIds]);

  // Posters streamed in by the dissolution: era + genre block films
  // (already curated, embedded in the bundle) plus the user's Screen 3
  // picks from filmDetails. Deduped by posterPath, capped at 12, computed
  // once at mount so the animation has a stable input.
  const posters = useMemo<DissolutionPoster[]>(() => {
    const eraFilms = ERA_BLOCKS
      .filter((b) => eras.includes(b.id))
      .flatMap((b) => b.films);
    const genreFilms = GENRE_BLOCKS
      .filter((b) => genres.includes(b.id))
      .flatMap((b) => b.films);

    const all: DissolutionPoster[] = [
      ...eraFilms.map((f) => ({
        posterPath: f.posterPath,
        key: `era-${f.posterPath}`,
      })),
      ...genreFilms.map((f) => ({
        posterPath: f.posterPath,
        key: `genre-${f.posterPath}`,
      })),
      ...filmDetails
        .filter((f): f is typeof f & { posterPath: string } => !!f.posterPath)
        .map((f) => ({
          posterPath: f.posterPath as string,
          key: `s3-${f.id}`,
        })),
    ];

    const seen = new Set<string>();
    const unique = all.filter((p) => {
      if (seen.has(p.posterPath)) return false;
      seen.add(p.posterPath);
      return true;
    });
    return unique.slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const noSelections =
    eras.length === 0 && genres.length === 0 && filmIds.length === 0;
  const heading = noSelections ? 'Welcome to Cinemagraphs' : 'Your profile is ready';
  const subheading = noSelections
    ? 'You can set this up later in Settings.'
    : 'Customize anything later in Settings.';

  const handleGetStarted = () => {
    router.replace('/(tabs)/explore' as any);
  };

  const showAnimation = !isLoading && bannerSpec && !animationDone;
  const showRevealContent = !isLoading && bannerSpec && animationDone;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']}>
        <View style={styles.headingWrap}>
          <Text style={styles.heading}>{heading}</Text>
          <Text style={styles.sub}>{subheading}</Text>
        </View>
      </SafeAreaView>

      {isLoading || !bannerSpec ? <LoadingState screenWidth={screenWidth} /> : null}

      {showRevealContent && bannerSpec ? (
        <Animated.View entering={FadeIn.duration(300)}>
          <RevealContent spec={bannerSpec} screenWidth={screenWidth} />
        </Animated.View>
      ) : null}

      {showAnimation && bannerSpec ? (
        <DissolutionAnimation
          posters={posters}
          bannerSpec={bannerSpec}
          onComplete={() => setAnimationDone(true)}
        />
      ) : null}

      <View pointerEvents="box-none" style={styles.ctaBar}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(13,13,26,0)', 'rgba(13,13,26,0.95)', colors.background]}
          locations={[0, 0.4, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView edges={['bottom']}>
          <View style={styles.ctaInner}>
            <Pressable
              testID="reveal-get-started"
              onPress={handleGetStarted}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaLabel}>Get started</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

function RevealContent({
  spec,
  screenWidth,
}: {
  spec: BannerSpec;
  screenWidth: number;
}) {
  const bannerHeight = (screenWidth * 9) / 16;

  return (
    <View style={styles.preview}>
      <View style={[styles.bannerWrap, { width: screenWidth, height: bannerHeight }]}>
        <View style={styles.bannerClip}>
          <BannerLayer spec={spec} width={screenWidth} height={bannerHeight} />
        </View>
        <View style={styles.avatar} testID="reveal-avatar">
          <Text style={styles.avatarLetter}>C</Text>
        </View>
      </View>
      <View style={styles.meta}>
        <Text style={styles.name}>You</Text>
        <Text style={styles.handle}>@you</Text>
        <View style={styles.stats}>
          <Text style={styles.statText}>
            <Text style={styles.statValue}>0</Text> films
          </Text>
          <Text style={styles.statText}>
            <Text style={styles.statValue}>0</Text> following
          </Text>
          <Text style={styles.statText}>
            <Text style={styles.statValue}>0</Text> followers
          </Text>
        </View>
      </View>
    </View>
  );
}

function BannerLayer({
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
        <>
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
        </>
      );
    }
    // Backdrop spec without a usable path: fall back to default gradient.
    return (
      <BannerGradient
        presetKey={BANNER_DEFAULT_KEY}
        width={width}
        height={height}
        showScrim
      />
    );
  }

  const presetKey =
    typeof spec.bannerValue === 'string' && isBannerPresetKey(spec.bannerValue)
      ? spec.bannerValue
      : BANNER_DEFAULT_KEY;
  return (
    <BannerGradient
      presetKey={presetKey}
      width={width}
      height={height}
      showScrim
    />
  );
}

function LoadingState({ screenWidth }: { screenWidth: number }) {
  const bannerHeight = (screenWidth * 9) / 16;
  return (
    <View style={styles.preview}>
      <View style={[styles.bannerWrap, { width: screenWidth, height: bannerHeight }]}>
        <View style={[styles.bannerClip, styles.bannerSkeletonFill]} />
        <View style={styles.avatar} />
      </View>
      <View style={styles.meta}>
        <View style={styles.nameSkeleton} />
        <View style={styles.handleSkeleton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headingWrap: {
    paddingTop: 30,
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  heading: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: colors.ivory,
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 6,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.ivory,
    opacity: 0.4,
    textAlign: 'center',
  },
  preview: {
    backgroundColor: colors.background,
  },
  // Outer wrapper sized to the banner. No overflow:hidden so the avatar
  // can extend below the bottom edge into the meta block. Clipping happens
  // on the inner bannerClip View.
  bannerWrap: {
    position: 'relative',
  },
  bannerClip: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  bannerScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  avatar: {
    position: 'absolute',
    left: 18,
    bottom: -26,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(245,240,225,0.1)',
    borderWidth: 2.5,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: colors.gold,
  },
  meta: {
    paddingTop: 34,
    paddingHorizontal: 18,
  },
  name: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.ivory,
    marginBottom: 2,
  },
  handle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.ivory,
    opacity: 0.45,
    marginBottom: 8,
  },
  stats: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 8,
  },
  statText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.ivory,
    opacity: 0.35,
  },
  statValue: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.ivory,
    opacity: 1,
  },
  bannerSkeletonFill: {
    backgroundColor: colors.cardBackground,
  },
  nameSkeleton: {
    width: 80,
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.cardBackground,
    marginBottom: 6,
  },
  handleSkeleton: {
    width: 60,
    height: 10,
    borderRadius: 4,
    backgroundColor: colors.cardBackground,
  },
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  ctaInner: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  ctaButton: {
    width: '100%',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.background,
  },
});
