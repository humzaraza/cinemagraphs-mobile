import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Line } from 'react-native-svg';
import { colors, fonts, borderRadius } from '../../src/constants/theme';
import Sparkline from '../../src/components/Sparkline';
import { fetchUserLists, fetchUserFilms } from '../../src/lib/api';
import type { MockList, MockFilm } from '../../src/data/mockProfile';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PAD = 14;
const POSTER_GAP = 8;
const POSTER_COLS = 3;
const POSTER_W = (SCREEN_WIDTH - PAD * 2 - POSTER_GAP * (POSTER_COLS - 1)) / POSTER_COLS;
const POSTER_H = POSTER_W * 1.5;

type ViewMode = 'poster' | 'graph';

function GridIcon({ active }: { active: boolean }) {
  const c = active ? colors.gold : 'rgba(255,255,255,0.4)';
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d="M1 1h6v6H1zM9 1h6v6H9zM1 9h6v6H1zM9 9h6v6H9z" stroke={c} strokeWidth={1.2} />
    </Svg>
  );
}

function ListViewIcon({ active }: { active: boolean }) {
  const c = active ? colors.gold : 'rgba(255,255,255,0.4)';
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Line x1={1} y1={3} x2={15} y2={3} stroke={c} strokeWidth={1.5} />
      <Line x1={1} y1={8} x2={15} y2={8} stroke={c} strokeWidth={1.5} />
      <Line x1={1} y1={13} x2={15} y2={13} stroke={c} strokeWidth={1.5} />
    </Svg>
  );
}

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [list, setList] = useState<MockList | null>(null);
  const [allFilms, setAllFilms] = useState<MockFilm[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('graph');

  useEffect(() => {
    fetchUserLists().then((lists) => {
      const found = lists.find((l) => l.id === id);
      setList(found ?? null);
    });
    fetchUserFilms().then(setAllFilms);
  }, [id]);

  if (!list) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  const unique = allFilms.filter(
    (f, i, arr) => arr.findIndex((x) => x.id === f.id) === i,
  );
  const listFilms = list.filmIds
    .map((fid) => unique.find((f) => f.id === fid))
    .filter(Boolean) as MockFilm[];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke={colors.gold} strokeWidth={2} />
            </Svg>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>{list.name}</Text>
          <View style={styles.toggleRow}>
            <Pressable onPress={() => setViewMode('poster')} style={styles.toggleBtn}>
              <GridIcon active={viewMode === 'poster'} />
            </Pressable>
            <Pressable onPress={() => setViewMode('graph')} style={styles.toggleBtn}>
              <ListViewIcon active={viewMode === 'graph'} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.meta}>
          {list.genreTag} {'\u00B7'} {listFilms.length} film{listFilms.length !== 1 ? 's' : ''}
        </Text>

        {viewMode === 'graph' ? (
          <View style={styles.arcList}>
            {listFilms.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => router.push(`/film/${f.id}` as any)}
                style={styles.arcCard}
              >
                <View style={styles.arcTop}>
                  <Text style={styles.arcTitle} numberOfLines={1}>{f.title}</Text>
                  <Text style={styles.arcYear}>{f.year}</Text>
                  <Text style={styles.arcScore}>{f.score.toFixed(1)}</Text>
                </View>
                <View style={styles.arcGraph}>
                  <Sparkline
                    dataPoints={f.sparklineData.map((s) => ({ score: s }))}
                    width={SCREEN_WIDTH - PAD * 2 - 20}
                    height={36}
                    strokeColor={colors.gold}
                    strokeWidth={1.5}
                    showMidline
                  />
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.posterGrid}>
            {listFilms.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => router.push(`/film/${f.id}` as any)}
                style={styles.posterCell}
              >
                <Image
                  source={{ uri: f.posterUrl }}
                  style={styles.posterImg}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </View>
        )}

        {listFilms.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No films in this list yet</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(245,240,225,0.4)',
    textAlign: 'center',
    marginTop: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PAD,
    marginTop: 12,
    marginBottom: 4,
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center' },
  title: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.ivory,
    marginLeft: 4,
  },
  toggleRow: { flexDirection: 'row', gap: 6 },
  toggleBtn: { padding: 4 },
  meta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.4)',
    paddingHorizontal: PAD,
    marginBottom: 14,
    marginLeft: 36,
  },

  // Arc cards (graph view)
  arcList: { paddingHorizontal: PAD, gap: 8 },
  arcCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.08)',
    borderRadius: borderRadius.md,
    padding: 10,
  },
  arcTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 6,
  },
  arcTitle: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ivory,
  },
  arcYear: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
  },
  arcScore: {
    fontFamily: fonts.headingBold,
    fontSize: 14,
    color: colors.gold,
  },
  arcGraph: { marginTop: 2 },

  // Poster grid
  posterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: POSTER_GAP,
    paddingHorizontal: PAD,
  },
  posterCell: { width: POSTER_W },
  posterImg: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 5,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.12)',
    backgroundColor: 'rgba(30,30,60,0.8)',
  },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },
});
