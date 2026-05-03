import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Share,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Line,
  Polyline,
  Circle,
  Text as SvgText,
} from 'react-native-svg';
import Slider from '@react-native-community/slider';
import { colors, fonts, borderRadius } from '../src/constants/theme';
import { fetchFilmDetail, submitReview } from '../src/lib/api';
import type { FilmDetail, FilmDataPoint } from '../src/types/film';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TMDB_POSTER = 'https://image.tmdb.org/t/p/w185';
const MAX_BEATS = 8;

/** Select up to MAX_BEATS: peak, lowest, first, last, then evenly spaced. */
function selectBeats(dataPoints: FilmDataPoint[]): FilmDataPoint[] {
  if (dataPoints.length <= MAX_BEATS) return dataPoints;
  const indexed = dataPoints.map((dp, i) => ({ dp, i, score: dp.score ?? 0 }));
  const picked = new Set<number>();
  // first and last
  picked.add(0);
  picked.add(dataPoints.length - 1);
  // peak and lowest by score
  let peakIdx = 0;
  let lowIdx = 0;
  indexed.forEach(({ score }, i) => {
    if (score > indexed[peakIdx].score) peakIdx = i;
    if (score < indexed[lowIdx].score) lowIdx = i;
  });
  picked.add(peakIdx);
  picked.add(lowIdx);
  // fill remaining slots evenly
  const remaining = MAX_BEATS - picked.size;
  if (remaining > 0) {
    const candidates = indexed.filter((_, i) => !picked.has(i));
    const step = candidates.length / (remaining + 1);
    for (let j = 1; j <= remaining; j++) {
      picked.add(candidates[Math.round(step * j)].i);
    }
  }
  return [...picked].sort((a, b) => a - b).map((i) => dataPoints[i]);
}

type ScreenState = 'loading' | 'form-a' | 'form-b' | 'arc-reveal' | 'preview-b' | 'confirmed-b' | 'error';

function formatTimestamp(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

function getPosterUri(film: { posterUrl?: string | null; posterPath?: string | null }): string | null {
  const path = film.posterUrl || film.posterPath;
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${TMDB_POSTER}${path}`;
}

// ---------------------------------------------------------------------------
// Back header
// ---------------------------------------------------------------------------

function BackHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.backRow, { paddingTop: insets.top }]}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
          <Line x1={15} y1={18} x2={9} y2={12} stroke={colors.ivory} strokeWidth={2} />
          <Line x1={9} y1={12} x2={15} y2={6} stroke={colors.ivory} strokeWidth={2} />
        </Svg>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Film header row (shared by State A and B)
// ---------------------------------------------------------------------------

function FilmHeader({ film }: { film: FilmDetail }) {
  const posterUri = getPosterUri(film);

  return (
    <View style={styles.filmHeader}>
      {posterUri ? (
        <Image source={{ uri: posterUri }} style={styles.filmPoster} resizeMode="cover" />
      ) : (
        <View style={[styles.filmPoster, { backgroundColor: 'rgba(30,30,60,0.8)' }]} />
      )}
      <View>
        <Text style={styles.filmHeaderTitle}>Write your review</Text>
        <Text style={styles.filmHeaderMeta}>
          {film.title} ({film.year})
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Overall rating card
// ---------------------------------------------------------------------------

function OverallRatingCard({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.overallCard}>
      <View style={styles.overallHeader}>
        <Text style={styles.overallLabel}>Overall rating</Text>
        <Text style={styles.overallScore}>{value.toFixed(1)}</Text>
      </View>
      <Slider
        value={value}
        onValueChange={onChange}
        minimumValue={1}
        maximumValue={10}
        step={0.5}
        minimumTrackTintColor="#C8A951"
        maximumTrackTintColor="rgba(245,240,225,0.08)"
        thumbTintColor="#C8A951"
        style={{ height: 28 }}
      />
      <View style={styles.scaleRow}>
        <Text style={styles.scaleLabel}>1</Text>
        <Text style={styles.scaleLabel}>5</Text>
        <Text style={styles.scaleLabel}>10</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Beat slider card
// ---------------------------------------------------------------------------

function BeatCard({
  dp,
  value,
  onChange,
}: {
  dp: FilmDataPoint;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.beatCard}>
      <View style={styles.beatHeader}>
        <Text style={styles.beatLabel}>
          {dp.label}{' '}
          <Text style={styles.beatTimestamp}>{formatTimestamp(dp.timeMidpoint)}</Text>
        </Text>
        <Text style={styles.beatScore}>{value.toFixed(1)}</Text>
      </View>
      <Slider
        value={value}
        onValueChange={onChange}
        minimumValue={1}
        maximumValue={10}
        step={0.5}
        minimumTrackTintColor="#C8A951"
        maximumTrackTintColor="rgba(245,240,225,0.08)"
        thumbTintColor="#C8A951"
        style={{ height: 24 }}
      />
      <View style={styles.scaleRow}>
        <Text style={styles.scaleHint}>Hated it</Text>
        <Text style={styles.scaleHint}>Neutral</Text>
        <Text style={styles.scaleHint}>Loved it</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Arc reveal graph (post-submit State A)
// ---------------------------------------------------------------------------

function ArcGraph({
  dataPoints,
  beatRatings,
}: {
  dataPoints: FilmDataPoint[];
  beatRatings: Record<string, number>;
}) {
  const padL = 20;
  const padR = 4;
  const padT = 6;
  const padB = 18;
  const w = SCREEN_WIDTH - 28 - 20; // scroll padding + card padding
  const h = 120;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const n = dataPoints.length;
  const midY = padT + plotH * 0.5;

  function getX(i: number): number {
    return padL + (i / Math.max(1, n - 1)) * plotW;
  }
  function getY(score: number): number {
    return padT + (1 - Math.max(0, Math.min(10, score)) / 10) * plotH;
  }

  const scores = dataPoints.map((dp) => beatRatings[dp.label] ?? 5);
  const points = scores.map((s, i) => `${getX(i).toFixed(1)},${getY(s).toFixed(1)}`).join(' ');

  let peakIdx = 0;
  let lowIdx = 0;
  scores.forEach((s, i) => {
    if (s > scores[peakIdx]) peakIdx = i;
    if (s < scores[lowIdx]) lowIdx = i;
  });

  return (
    <View style={styles.graphCard}>
      <Svg width={w} height={h}>
        {/* Y-axis line */}
        <Line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="rgba(245,240,225,0.15)" strokeWidth={0.5} />
        {/* X-axis line */}
        <Line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="rgba(245,240,225,0.15)" strokeWidth={0.5} />
        {/* Dashed midline */}
        <Line x1={padL} y1={midY} x2={padL + plotW} y2={midY} stroke="rgba(245,240,225,0.08)" strokeWidth={0.5} strokeDasharray="4,3" />
        {/* Y labels */}
        <SvgText x={padL - 3} y={padT + 4} textAnchor="end" fontSize={7} fill="rgba(245,240,225,0.25)">10</SvgText>
        <SvgText x={padL - 3} y={midY + 3} textAnchor="end" fontSize={7} fill="rgba(245,240,225,0.25)">5</SvgText>
        <SvgText x={padL - 3} y={padT + plotH} textAnchor="end" fontSize={7} fill="rgba(245,240,225,0.25)">0</SvgText>
        {/* Polyline */}
        {n >= 2 && <Polyline points={points} fill="none" stroke={colors.gold} strokeWidth={1.5} />}
        {/* Peak and low dots */}
        <Circle cx={getX(peakIdx)} cy={getY(scores[peakIdx])} r={3.5} fill={colors.teal} />
        <Circle cx={getX(lowIdx)} cy={getY(scores[lowIdx])} r={3.5} fill={colors.negativeRed} />
        {/* X timestamps */}
        {dataPoints.map((dp, i) => (
          <SvgText key={i} x={getX(i)} y={h - 2} textAnchor="middle" fontSize={7} fill="rgba(245,240,225,0.2)">
            {formatTimestamp(dp.timeMidpoint)}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ReviewScreen() {
  const { filmId } = useLocalSearchParams<{ filmId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [film, setFilm] = useState<FilmDetail | null>(null);
  const [effectiveBeats, setEffectiveBeats] = useState<FilmDataPoint[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form state
  const [overallRating, setOverallRating] = useState(5.5);
  const [beatRatings, setBeatRatings] = useState<Record<string, number>>({});
  const [thoughts, setThoughts] = useState('');

  // Load film
  useEffect(() => {
    if (!filmId) {
      setScreenState('error');
      setErrorMsg('No film selected');
      return;
    }
    fetchFilmDetail(filmId)
      .then((data) => {
        if (!data) {
          setScreenState('error');
          setErrorMsg('Could not load film');
          return;
        }
        setFilm(data);

        // Prefer NLP sentiment graph beats. Fall back to Wikipedia-derived
        // filmBeats when no graph exists. Wiki beats have no scores, so
        // normalize them to FilmDataPoint shape with a neutral 5.5 score
        // (the user's slider value will replace it anyway).
        const graphPoints = data.sentimentGraph?.dataPoints;
        let beats: FilmDataPoint[] = [];
        if (graphPoints && graphPoints.length > 0) {
          beats = graphPoints;
        } else if (data.filmBeats?.beats && data.filmBeats.beats.length > 0) {
          beats = data.filmBeats.beats.map((b) => ({
            label: b.label,
            timeMidpoint: b.timeMidpoint,
            score: 5.5,
          }));
        }

        if (beats.length > 0) {
          setEffectiveBeats(beats);
          const initial: Record<string, number> = {};
          beats.forEach((p) => { initial[p.label] = 5; });
          setBeatRatings(initial);
          setScreenState('form-a');
        } else {
          setEffectiveBeats([]);
          setScreenState('form-b');
        }
      })
      .catch(() => {
        setScreenState('error');
        setErrorMsg('Could not load film');
      });
  }, [filmId]);

  const updateBeat = useCallback((label: string, val: number) => {
    setBeatRatings((prev) => ({ ...prev, [label]: val }));
  }, []);

  // Submit handlers
  const handleSubmitA = useCallback(async () => {
    if (!film) return;
    const payload = {
      overallRating,
      beatRatings,
      beginning: thoughts.trim() || undefined,
    };
    setSubmitting(true);
    setErrorMsg('');
    try {
      await submitReview(film.id, payload);
      setScreenState('arc-reveal');
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.includes('auth') || err.message?.includes('session')) {
        setErrorMsg('Sign in to submit reviews');
      } else {
        setErrorMsg(err.message || 'Failed to submit');
      }
    } finally {
      setSubmitting(false);
    }
  }, [film, overallRating, beatRatings, thoughts]);

  const handlePreviewB = useCallback(() => {
    setScreenState('preview-b');
  }, []);

  const handleSubmitB = useCallback(async () => {
    if (!film) return;
    const payload = {
      overallRating,
      beginning: thoughts.trim() || undefined,
    };
    setSubmitting(true);
    setErrorMsg('');
    try {
      await submitReview(film.id, payload);
      setScreenState('confirmed-b');
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.includes('auth') || err.message?.includes('session')) {
        setErrorMsg('Sign in to submit reviews');
      } else {
        setErrorMsg(err.message || 'Failed to submit');
      }
    } finally {
      setSubmitting(false);
    }
  }, [film, overallRating, thoughts]);

  const handleShare = useCallback(async () => {
    if (!film) return;
    await Share.share({
      message: `I just reviewed ${film.title} on Cinemagraphs and rated it ${overallRating.toFixed(1)}/10! Check out my sentiment arc at cinemagraphs.ca`,
      url: 'https://cinemagraphs.ca',
    });
  }, [film, overallRating]);

  const handleHome = useCallback(() => {
    router.replace('/(tabs)/explore' as any);
  }, [router]);

  const stitchedText = thoughts.trim();
  const canPreviewB = stitchedText.trim().length > 0 || overallRating !== 5.5;

  // ----- LOADING -----
  if (screenState === 'loading') {
    return (
      <View style={styles.container}>
        <BackHeader />
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading film...</Text>
        </View>
      </View>
    );
  }

  // ----- ERROR -----
  if (screenState === 'error' || !film) {
    return (
      <View style={styles.container}>
        <BackHeader />
        <View style={styles.center}>
          <Text style={styles.errorText}>{errorMsg || 'Something went wrong'}</Text>
        </View>
      </View>
    );
  }

  // ----- ARC REVEAL (State A post-submit) -----
  if (screenState === 'arc-reveal') {
    const dp = effectiveBeats;
    const scores = dp.map((p) => beatRatings[p.label] ?? 5);
    let peakIdx = 0;
    let lowIdx = 0;
    scores.forEach((s, i) => {
      if (s > scores[peakIdx]) peakIdx = i;
      if (s < scores[lowIdx]) lowIdx = i;
    });
    const peakDp = dp[peakIdx];
    const lowDp = dp[lowIdx];
    const criticsAvg = film.sentimentGraph?.overallSentiment ?? film.sentimentGraph?.overallScore;

    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.postTitle}>Your arc for {film.title}</Text>
          <Text style={styles.postSubtitle}>Review submitted</Text>

          <ArcGraph dataPoints={dp} beatRatings={beatRatings} />

          <View style={styles.scoreCardsRow}>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreCardValue}>{overallRating.toFixed(1)}</Text>
              <Text style={styles.scoreCardLabel}>Your score</Text>
            </View>
            <View style={styles.scoreCard}>
              <Text style={[styles.scoreCardValue, { color: colors.ivory }]}>
                {criticsAvg != null ? criticsAvg.toFixed(1) : '--'}
              </Text>
              <Text style={styles.scoreCardLabel}>Critics avg</Text>
            </View>
          </View>

          <View style={styles.peakLowRow}>
            <View style={styles.peakCard}>
              <Text style={styles.peakLabel}>Your peak</Text>
              <Text style={styles.peakTitle}>{peakDp?.label}</Text>
              <Text style={styles.peakMeta}>
                {peakDp ? formatTimestamp(peakDp.timeMidpoint) : ''} {'\u00B7'} {scores[peakIdx]}/10
              </Text>
            </View>
            <View style={styles.lowCard}>
              <Text style={styles.lowLabel}>Your low</Text>
              <Text style={styles.lowTitle}>{lowDp?.label}</Text>
              <Text style={styles.lowMeta}>
                {lowDp ? formatTimestamp(lowDp.timeMidpoint) : ''} {'\u00B7'} {scores[lowIdx]}/10
              </Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable onPress={handleShare} style={styles.shareButton}>
              <Text style={styles.shareText}>Share</Text>
            </Pressable>
            <Pressable onPress={handleHome} style={styles.homeButton}>
              <Text style={styles.homeText}>Home</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ----- PREVIEW B (pre-submit) -----
  if (screenState === 'preview-b') {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.postTitle}>Review preview</Text>
          <Text style={styles.postSubtitle}>{film.title} ({film.year})</Text>

          <View style={styles.previewScoreCard}>
            <Text style={styles.previewScoreValue}>{overallRating.toFixed(1)}</Text>
            <Text style={styles.previewScoreLabel}>Your rating</Text>
          </View>

          <Text style={styles.sectionLabel}>YOUR REVIEW</Text>
          <View style={styles.stitchedCard}>
            <Text style={styles.stitchedText}>{stitchedText}</Text>
          </View>

          {errorMsg ? <Text style={styles.inlineError}>{errorMsg}</Text> : null}

          <View style={styles.actionRow}>
            <Pressable onPress={() => { setScreenState('form-b'); setErrorMsg(''); }} style={styles.homeButton}>
              <Text style={styles.homeText}>Edit</Text>
            </Pressable>
            <Pressable onPress={handleSubmitB} style={[styles.submitButton, submitting && { opacity: 0.5 }]} disabled={submitting}>
              <Text style={styles.submitText}>Post review</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ----- CONFIRMED B (post-submit) -----
  if (screenState === 'confirmed-b') {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.postTitle}>Review posted</Text>
          <Text style={styles.postSubtitle}>{film.title} ({film.year})</Text>

          <View style={styles.previewScoreCard}>
            <Text style={styles.previewScoreValue}>{overallRating.toFixed(1)}</Text>
            <Text style={styles.previewScoreLabel}>Your rating</Text>
          </View>

          <Text style={styles.sectionLabel}>YOUR REVIEW</Text>
          <View style={styles.stitchedCard}>
            <Text style={styles.stitchedText}>{stitchedText}</Text>
          </View>

          <View style={styles.tealBanner}>
            <Text style={styles.tealBannerText}>Thanks for helping build this film's graph</Text>
          </View>

          <View style={styles.actionRow}>
            <Pressable onPress={handleShare} style={styles.shareButton}>
              <Text style={styles.shareText}>Share</Text>
            </Pressable>
            <Pressable onPress={handleHome} style={styles.homeButton}>
              <Text style={styles.homeText}>Home</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ----- FORM A (beats + text) -----
  if (screenState === 'form-a') {
    const dp = selectBeats(effectiveBeats);

    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <BackHeader />
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <FilmHeader film={film} />
          <OverallRatingCard value={overallRating} onChange={setOverallRating} />

          <Text style={styles.sectionLabel}>STORY BEATS</Text>
          <View style={{ gap: 8, marginBottom: 14 }}>
            {dp.map((beat) => (
              <BeatCard
                key={beat.label}
                dp={beat}
                value={beatRatings[beat.label] ?? 5}
                onChange={(v) => updateBeat(beat.label, v)}
              />
            ))}
          </View>

          <Text style={styles.sectionLabel}>YOUR THOUGHTS</Text>

          <Text style={styles.fieldLabel}>Your thoughts</Text>
          <TextInput
            style={styles.textField}
            placeholder="What did you think of the film?"
            placeholderTextColor="rgba(245,240,225,0.2)"
            value={thoughts}
            onChangeText={setThoughts}
            multiline
            numberOfLines={6}
          />

          {errorMsg ? <Text style={styles.inlineError}>{errorMsg}</Text> : null}

          <Pressable
            onPress={handleSubmitA}
            style={[styles.submitButton, submitting && { opacity: 0.5 }]}
            disabled={submitting}
          >
            <Text style={styles.submitText}>Submit review</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ----- FORM B (no beats) -----
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BackHeader />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <FilmHeader film={film} />

        <View style={styles.tealBanner}>
          <Text style={styles.tealBannerText}>
            Help build this film's graph. Your review helps create one.
          </Text>
        </View>

        <OverallRatingCard value={overallRating} onChange={setOverallRating} />

        <Text style={styles.sectionLabel}>YOUR THOUGHTS</Text>

        <Text style={styles.fieldLabel}>Your thoughts</Text>
        <TextInput
          style={styles.textField}
          placeholder="What did you think of the film?"
          placeholderTextColor="rgba(245,240,225,0.2)"
          value={thoughts}
          onChangeText={setThoughts}
          multiline
          numberOfLines={6}
        />

        {errorMsg ? <Text style={styles.inlineError}>{errorMsg}</Text> : null}

        <Pressable
          onPress={handlePreviewB}
          style={[styles.submitButton, !canPreviewB && { opacity: 0.4 }]}
          disabled={!canPreviewB || submitting}
        >
          <Text style={styles.submitText}>Preview review</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 14,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(245,240,225,0.4)',
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(245,240,225,0.4)',
  },
  inlineError: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.negativeRed,
    textAlign: 'center',
    marginBottom: 10,
  },

  // Back header
  backRow: {
    paddingHorizontal: 6,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Film header
  filmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  filmPoster: {
    width: 38,
    height: 56,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.15)',
  },
  filmHeaderTitle: {
    fontFamily: fonts.heading,
    fontSize: 15,
    color: colors.ivory,
  },
  filmHeaderMeta: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(245,240,225,0.4)',
    marginTop: 2,
  },

  // Overall rating
  overallCard: {
    backgroundColor: 'rgba(200,169,81,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.15)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  overallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  overallLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ivory,
  },
  overallScore: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.gold,
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  scaleLabel: {
    fontSize: 8,
    color: 'rgba(245,240,225,0.25)',
    fontFamily: fonts.body,
  },
  scaleHint: {
    fontSize: 7,
    color: 'rgba(245,240,225,0.2)',
    fontFamily: fonts.body,
  },

  // Beat card
  beatCard: {
    backgroundColor: 'rgba(200,169,81,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.10)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  beatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  beatLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.ivory,
  },
  beatTimestamp: {
    color: 'rgba(245,240,225,0.3)',
  },
  beatScore: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.gold,
  },

  // Section label
  sectionLabel: {
    fontSize: 9,
    color: 'rgba(245,240,225,0.3)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontFamily: fonts.body,
    marginBottom: 8,
  },

  // Text fields
  fieldLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(245,240,225,0.4)',
    marginBottom: 4,
  },
  textField: {
    backgroundColor: 'rgba(245,240,225,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.10)',
    borderRadius: 8,
    padding: 10,
    minHeight: 120,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.ivory,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  textFieldSmall: {
    backgroundColor: 'rgba(245,240,225,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.10)',
    borderRadius: 8,
    padding: 8,
    minHeight: 44,
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.ivory,
    textAlignVertical: 'top',
    marginBottom: 10,
  },

  // Submit / action buttons
  submitButton: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  submitText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.background,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  shareButton: {
    flex: 1,
    backgroundColor: 'rgba(200,169,81,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.2)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  shareText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.gold,
  },
  homeButton: {
    flex: 1,
    backgroundColor: 'rgba(245,240,225,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.12)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  homeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: 'rgba(245,240,225,0.5)',
  },

  // Teal banner
  tealBanner: {
    backgroundColor: 'rgba(45,212,168,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(45,212,168,0.15)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 14,
  },
  tealBannerText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.teal,
    textAlign: 'center',
  },

  // Post-submit shared
  postTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    color: colors.ivory,
    textAlign: 'center',
    marginBottom: 3,
  },
  postSubtitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.4)',
    textAlign: 'center',
    marginBottom: 14,
  },

  // Graph card
  graphCard: {
    backgroundColor: 'rgba(245,240,225,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.10)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },

  // Score cards
  scoreCardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: 'rgba(245,240,225,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.12)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  scoreCardValue: {
    fontFamily: fonts.heading,
    fontSize: 22,
    color: colors.gold,
  },
  scoreCardLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: 'rgba(245,240,225,0.4)',
    marginTop: 3,
  },

  // Peak / Low
  peakLowRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  peakCard: {
    flex: 1,
    backgroundColor: 'rgba(45,212,168,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(45,212,168,0.2)',
    borderRadius: 10,
    padding: 8,
  },
  peakLabel: {
    fontSize: 8,
    color: colors.teal,
    fontFamily: fonts.bodyMedium,
    marginBottom: 2,
  },
  peakTitle: {
    fontSize: 11,
    color: colors.ivory,
    fontFamily: fonts.bodyMedium,
    marginBottom: 1,
  },
  peakMeta: {
    fontSize: 9,
    color: 'rgba(245,240,225,0.4)',
    fontFamily: fonts.body,
  },
  lowCard: {
    flex: 1,
    backgroundColor: 'rgba(226,75,74,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(226,75,74,0.2)',
    borderRadius: 10,
    padding: 8,
  },
  lowLabel: {
    fontSize: 8,
    color: colors.negativeRed,
    fontFamily: fonts.bodyMedium,
    marginBottom: 2,
  },
  lowTitle: {
    fontSize: 11,
    color: colors.ivory,
    fontFamily: fonts.bodyMedium,
    marginBottom: 1,
  },
  lowMeta: {
    fontSize: 9,
    color: 'rgba(245,240,225,0.4)',
    fontFamily: fonts.body,
  },

  // Preview B
  previewScoreCard: {
    alignSelf: 'center',
    backgroundColor: 'rgba(245,240,225,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.12)',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 14,
  },
  previewScoreValue: {
    fontFamily: fonts.heading,
    fontSize: 28,
    color: colors.gold,
  },
  previewScoreLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: 'rgba(245,240,225,0.4)',
    marginTop: 3,
  },
  stitchedCard: {
    backgroundColor: 'rgba(245,240,225,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.10)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  stitchedText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(245,240,225,0.7)',
    lineHeight: 19,
  },
});
