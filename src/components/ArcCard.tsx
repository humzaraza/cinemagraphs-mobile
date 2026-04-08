import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, borderRadius } from '../constants/theme';
import Sparkline from './Sparkline';
import type { MockFilm } from '../data/mockProfile';

const SCREEN_WIDTH = Dimensions.get('window').width;

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function ArcCard({
  film,
  cardWidth,
}: {
  film: MockFilm;
  cardWidth?: number;
}) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const cw = cardWidth ?? SCREEN_WIDTH - 32;
  // card padding (10) + poster (50) + gaps (10+10) + score (~40) + card padding (10)
  const sparklineWidth = cw - 130;

  return (
    <Pressable
      onPress={() => router.push(`/film/${film.id}` as any)}
      style={[
        styles.arcCard,
        { borderLeftWidth: 3, borderLeftColor: hexToRgba(film.dominantColor, 0.5) },
      ]}
    >
      {/* Dominant color gradient accent */}
      <LinearGradient
        colors={[hexToRgba(film.dominantColor, 0.5), 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.arcColorAccent}
      />

      {/* Poster thumbnail */}
      {imgError ? (
        <View style={[styles.arcPoster, styles.arcPosterPlaceholder]} />
      ) : (
        <Image
          source={{ uri: film.posterUrl }}
          style={styles.arcPoster}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      )}

      {/* Title + graph */}
      <View style={styles.arcMiddle}>
        <Text style={styles.arcTitle} numberOfLines={1}>
          {film.title}
        </Text>
        <Sparkline
          dataPoints={film.sparklineData.map((s) => ({ score: s }))}
          width={sparklineWidth}
          height={50}
          strokeColor={colors.gold}
          strokeWidth={2}
          showAxes
          showMidline
          runtimeMinutes={film.runtime}
          peakDotColor={colors.teal}
          peakDotRadius={3.5}
          lowDotColor="#E24B4A"
          lowDotRadius={3.5}
        />
      </View>

      {/* Score */}
      <Text style={styles.arcScore}>{film.personalScore.toFixed(1)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  arcCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: borderRadius.lg,
    padding: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.08)',
    overflow: 'hidden',
  },
  arcColorAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  arcPoster: {
    width: 50,
    height: 75,
    minWidth: 50,
    maxWidth: 50,
    borderRadius: 6,
    backgroundColor: '#1a1a2e',
  },
  arcPosterPlaceholder: {
    backgroundColor: 'rgba(30,30,60,0.8)',
  },
  arcMiddle: {
    flex: 1,
  },
  arcTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 14,
    color: colors.ivory,
    marginBottom: 4,
  },
  arcScore: {
    fontFamily: fonts.headingBold,
    fontSize: 20,
    color: colors.gold,
    alignSelf: 'center',
  },
});
