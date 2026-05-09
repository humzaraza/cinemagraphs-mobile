import * as React from 'react';
import { Pressable, View, Text, Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors, fonts } from '../../constants/theme';
import { getPosterUrl } from '../../lib/tmdb-image';
import type { OnboardingBlock } from '../../data/onboardingCuration';

type MosaicBlockProps = {
  block: OnboardingBlock;
  selected: boolean;
  atCap: boolean;
  onPress: () => void;
  onCapHit?: () => void;
};

const SPRING_CONFIG = { damping: 14, stiffness: 180 } as const;
const SHAKE_STEP_MS = 50;

export function MosaicBlock({ block, selected, atCap, onPress, onCapHit }: MosaicBlockProps) {
  const translateX = useSharedValue(0);
  const borderOpacity = useSharedValue(0);

  React.useEffect(() => {
    borderOpacity.value = withSpring(selected ? 1 : 0, SPRING_CONFIG);
  }, [selected, borderOpacity]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const borderAnimatedStyle = useAnimatedStyle(() => ({
    opacity: borderOpacity.value,
  }));

  const handlePress = () => {
    if (atCap && !selected) {
      if (onCapHit) onCapHit();
      translateX.value = withSequence(
        withTiming(4, { duration: SHAKE_STEP_MS }),
        withTiming(-4, { duration: SHAKE_STEP_MS }),
        withTiming(4, { duration: SHAKE_STEP_MS }),
        withTiming(-4, { duration: SHAKE_STEP_MS }),
        withTiming(0, { duration: SHAKE_STEP_MS }),
      );
      return;
    }
    onPress();
  };

  return (
    <Pressable testID="mosaic-block-pressable" onPress={handlePress}>
      <Animated.View style={[styles.blockContainer, containerAnimatedStyle]}>
        <View style={styles.labelContainer}>
          <Text style={[styles.label, selected ? styles.labelSelected : styles.labelUnselected]}>
            {block.label}
          </Text>
        </View>

        <View style={styles.mosaicWrapper}>
          <Animated.View
            testID="mosaic-halo"
            pointerEvents="none"
            style={[styles.halo, borderAnimatedStyle]}
          />
          <View style={styles.mosaicGrid}>
            <View style={styles.row}>
              <View style={styles.cell}>
                <Image
                  source={{ uri: getPosterUrl(block.films[0], 'thumbnail') ?? '' }}
                  style={styles.poster}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.cell}>
                <Image
                  source={{ uri: getPosterUrl(block.films[1], 'thumbnail') ?? '' }}
                  style={styles.poster}
                  resizeMode="cover"
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.cell}>
                <Image
                  source={{ uri: getPosterUrl(block.films[2], 'thumbnail') ?? '' }}
                  style={styles.poster}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.cell}>
                <Image
                  source={{ uri: getPosterUrl(block.films[3], 'thumbnail') ?? '' }}
                  style={styles.poster}
                  resizeMode="cover"
                />
              </View>
            </View>
            <Animated.View
              pointerEvents="none"
              style={[styles.selectedBorder, borderAnimatedStyle]}
            />
          </View>

          {selected ? (
            <View testID="mosaic-checkmark" style={styles.checkmarkBadge}>
              <Text style={styles.checkmarkGlyph}>{'✓'}</Text>
            </View>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const MOSAIC_RADIUS = 10;
const POSTER_RADIUS = 3;
const HALO_OFFSET = 3;

const styles = StyleSheet.create({
  blockContainer: {
    width: '100%',
  },
  labelContainer: {
    width: '100%',
    marginBottom: 6,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  labelUnselected: {
    color: colors.ivory,
  },
  labelSelected: {
    color: colors.gold,
  },
  mosaicWrapper: {
    position: 'relative',
    width: '100%',
  },
  mosaicGrid: {
    position: 'relative',
    borderRadius: MOSAIC_RADIUS,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    // 8pt gap (mockup says 4pt; overridden after device smoke
    // showed cells smearing together)
    gap: 8,
    marginBottom: 8,
  },
  cell: {
    flex: 1,
    aspectRatio: 2 / 3,
  },
  poster: {
    width: '100%',
    height: '100%',
    borderRadius: POSTER_RADIUS,
  },
  selectedBorder: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: MOSAIC_RADIUS,
  },
  halo: {
    position: 'absolute',
    top: -HALO_OFFSET,
    right: -HALO_OFFSET,
    bottom: -HALO_OFFSET,
    left: -HALO_OFFSET,
    borderRadius: MOSAIC_RADIUS + HALO_OFFSET,
    borderWidth: HALO_OFFSET,
    borderColor: colors.goldHalo,
  },
  // TODO: Mockup .checkmark-badge is 18x18 with borderRadius 9
  // (mockup line 50). This implementation uses 22x22 /
  // borderRadius 11 from an early Chunk 2 spec. Tighten to 18/9
  // if device review flags it as oversized. FilmPosterCard's
  // checkmark already follows the mockup at 16x16.
  checkmarkBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkGlyph: {
    color: colors.background,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    lineHeight: 14,
  },
});
