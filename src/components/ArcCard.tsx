import React, { useState, useEffect } from 'react';
import { View, Text, Image, Pressable, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, borderRadius } from '../constants/theme';
import Sparkline from './Sparkline';
import type { MockFilm } from '../data/mockProfile';

const SCREEN_WIDTH = Dimensions.get('window').width;

const PALETTE = ['#8B4513','#2E4057','#6B2737','#1B4332','#4A1942','#2C3E50','#5D4E37','#3D1F00','#1A3A5C','#4B2840'];

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

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
  const fallback = hashColor(film.title ?? film.id ?? 'film');
  const [bgColor, setBgColor] = useState(fallback);
  const cw = cardWidth ?? SCREEN_WIDTH - 32;
  const sparklineWidth = cw - 90;

  const posterUri = film.posterUrl?.startsWith('/')
    ? 'https://image.tmdb.org/t/p/w185' + film.posterUrl
    : film.posterUrl;

  useEffect(() => {
    try {
      const { getColors } = require('react-native-image-colors');
      if (posterUri && getColors) {
        getColors(posterUri, { fallback, cache: true, key: posterUri }).then((result: any) => {
          if (result.platform === 'ios') setBgColor(result.background ?? fallback);
          else if (result.platform === 'android') setBgColor(result.dominant ?? fallback);
        }).catch(() => {});
      }
    } catch {}
  }, [posterUri]);

  return (
    <Pressable
      onPress={() => router.push(`/film/${film.id}` as any)}
      style={styles.arcCard}
    >
      <LinearGradient
        colors={[hexToRgba(bgColor, 0.4), 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.arcColorAccent}
      />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {/* Poster thumbnail */}
        {imgError ? (
          <View style={[styles.arcPoster, styles.arcPosterPlaceholder]} />
        ) : (
          <Image
            source={{ uri: posterUri ?? undefined }}
            style={styles.arcPoster}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        )}

        {/* Title + score + graph */}
        <View style={{ flex: 1 }}>
          {/* Title row with score */}
          <View style={styles.titleRow}>
            <Text style={styles.arcTitle} numberOfLines={1}>
              {film.title}
            </Text>
            <Text style={styles.arcScore}>
              {(film.personalScore ?? film.score ?? 0).toFixed(1)}
            </Text>
          </View>

          {/* Sparkline graph */}
          <Sparkline
            dataPoints={((film.sparklineData ?? film.sentimentGraph?.dataPoints?.map((d: any) => d.score)) ?? []).map((s) => ({ score: s }))}
            width={sparklineWidth}
            height={55}
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
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  arcCard: {
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
    borderRadius: 4,
    backgroundColor: '#1a1a2e',
  },
  arcPosterPlaceholder: {
    backgroundColor: 'rgba(30,30,60,0.8)',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  arcTitle: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.ivory,
    flex: 1,
    marginRight: 8,
  },
  arcScore: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.gold,
  },
});
