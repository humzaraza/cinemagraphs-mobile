import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Line, Polyline, Circle } from 'react-native-svg';
import Slider from '@react-native-community/slider';
import { colors, fonts, borderRadius } from '../../src/constants/theme';
import {
  fetchFilmDetail,
  createReactionSession,
  getIncompleteSession,
  postReaction,
} from '../../src/lib/api';
import type { FilmDetail, FilmDataPoint, ReactionType, ReactionPoint } from '../../src/types/film';
import {
  clampScore,
  applyReaction,
  canReact,
  selectBeats,
  findDivergence,
  COOLDOWN_MS,
} from '../../src/lib/live-react';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRAPH_PAD = 14;

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}m`;
}

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ---------------------------------------------------------------------------
// Reaction config
// ---------------------------------------------------------------------------

interface ReactionConfig {
  type: ReactionType;
  emoji: string;
  label: string;
  weight: number;
  color: string;
}

const PRIMARY_REACTIONS: ReactionConfig[] = [
  { type: 'up', emoji: '\u{1F44D}', label: 'Like', weight: 0.5, color: '#2DD4A8' },
  { type: 'down', emoji: '\u{1F44E}', label: 'Dislike', weight: -0.5, color: '#ef4444' },
];

const SECONDARY_REACTIONS: ReactionConfig[] = [
  { type: 'wow', emoji: '\u{1F929}', label: 'Wow', weight: 1.0, color: '#C8A951' },
  { type: 'shock', emoji: '\u{1F631}', label: 'Shock', weight: 0.5, color: '#a855f7' },
  { type: 'funny', emoji: '\u{1F602}', label: 'Funny', weight: 0.3, color: '#38bdf8' },
];

// ---------------------------------------------------------------------------
// SVG icons
// ---------------------------------------------------------------------------

function BackChevron() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={colors.ivory} strokeWidth={2} />
    </Svg>
  );
}

function LightningIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill={colors.gold}>
      <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Live graph component (no fontFamily on SVG Text)
// ---------------------------------------------------------------------------

function LiveGraph({
  points,
  width,
  height,
  runtimeSeconds,
}: {
  points: ReactionPoint[];
  width: number;
  height: number;
  runtimeSeconds: number;
}) {
  if (points.length < 1) {
    return (
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Line
          x1={0} y1={height / 2} x2={width} y2={height / 2}
          stroke="rgba(245,240,225,0.06)" strokeWidth={0.5} strokeDasharray="3,3"
        />
      </Svg>
    );
  }

  const pad = 4;
  const cw = width - pad * 2;
  const ch = height - pad * 2;
  const maxT = Math.max(runtimeSeconds, points[points.length - 1].timestamp, 60);

  const pts = points
    .map((p) => {
      const x = pad + (p.timestamp / maxT) * cw;
      const y = pad + (1 - (p.score - 1) / 9) * ch;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const lastP = points[points.length - 1];
  const lastX = pad + (lastP.timestamp / maxT) * cw;
  const lastY = pad + (1 - (lastP.score - 1) / 9) * ch;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Line
        x1={0} y1={height / 2} x2={width} y2={height / 2}
        stroke="rgba(245,240,225,0.06)" strokeWidth={0.5} strokeDasharray="3,3"
      />
      <Polyline
        points={pts} fill="none" stroke={colors.gold}
        strokeWidth={1.5} strokeLinejoin="round"
      />
      <Circle cx={lastX} cy={lastY} r={3} fill={colors.gold} />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Merged graph (gold live + teal beats polylines)
// ---------------------------------------------------------------------------

function MergedGraph({
  livePoints,
  beatPoints,
  width,
  height,
  runtimeSeconds,
}: {
  livePoints: ReactionPoint[];
  beatPoints: { timestamp: number; score: number }[];
  width: number;
  height: number;
  runtimeSeconds: number;
}) {
  const pad = 4;
  const cw = width - pad * 2;
  const ch = height - pad * 2;
  const maxT = Math.max(
    runtimeSeconds,
    livePoints.length > 0 ? livePoints[livePoints.length - 1].timestamp : 60,
    beatPoints.length > 0 ? beatPoints[beatPoints.length - 1].timestamp : 60,
  );

  const toPolyline = (pts: { timestamp: number; score: number }[]) =>
    pts
      .map((p) => {
        const x = pad + (p.timestamp / maxT) * cw;
        const y = pad + (1 - (p.score - 1) / 9) * ch;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Line
        x1={0} y1={height / 2} x2={width} y2={height / 2}
        stroke="rgba(245,240,225,0.06)" strokeWidth={0.5} strokeDasharray="3,3"
      />
      {livePoints.length >= 2 && (
        <Polyline
          points={toPolyline(livePoints)} fill="none" stroke={colors.gold}
          strokeWidth={1.5} strokeLinejoin="round"
        />
      )}
      {beatPoints.length >= 2 && (
        <Polyline
          points={toPolyline(beatPoints)} fill="none" stroke={colors.teal}
          strokeWidth={1.5} strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Types for screen state
// ---------------------------------------------------------------------------

type Screen = 'active' | 'post' | 'beats' | 'merged';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LiveReactScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { filmId } = useLocalSearchParams<{ filmId: string }>();

  // Film data
  const [film, setFilm] = useState<FilmDetail | null>(null);

  // Screen state
  const [screen, setScreen] = useState<Screen>('active');

  // Timer state
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reaction state
  const [score, setScore] = useState(5.0);
  const [points, setPoints] = useState<ReactionPoint[]>([]);
  const [lastReactionTime, setLastReactionTime] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Beat rating state
  const [selectedBeats, setSelectedBeats] = useState<FilmDataPoint[]>([]);
  const [beatRatings, setBeatRatings] = useState<Record<string, number>>({});

  // Load film
  useEffect(() => {
    if (!filmId) return;
    fetchFilmDetail(filmId).then((f) => {
      if (f) setFilm(f);
    });
  }, [filmId]);

  // Timer interval
  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running]);

  // Cooldown countdown display
  useEffect(() => {
    if (cooldownLeft > 0) {
      cooldownRef.current = setInterval(() => {
        setCooldownLeft((c) => {
          if (c <= 100) {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            return 0;
          }
          return c - 100;
        });
      }, 100);
    }
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [cooldownLeft > 0]);

  const runtimeSeconds = (film?.runtime ?? 180) * 60;
  const progress = runtimeSeconds > 0 ? Math.min(1, elapsed / runtimeSeconds) : 0;
  const graphWidth = SCREEN_WIDTH - GRAPH_PAD * 2 - 24; // container padding

  // Handle reaction tap
  const handleReaction = useCallback(
    async (config: ReactionConfig) => {
      const now = Date.now();
      if (!canReact(lastReactionTime, now)) return;

      // Auto-start timer on first reaction
      if (!running && elapsed === 0) {
        setRunning(true);
      }

      const newScore = applyReaction(score, config.weight);
      const point: ReactionPoint = {
        timestamp: elapsed,
        score: newScore,
        reaction: config.type,
      };

      setScore(newScore);
      setPoints((prev) => [...prev, point]);
      setLastReactionTime(now);
      setCooldownLeft(COOLDOWN_MS);

      // API calls (fire and forget, UI works without auth)
      try {
        let sid = sessionId;
        if (!sid) {
          const session = await createReactionSession(filmId || '');
          sid = session.id;
          setSessionId(sid);
        }
        if (sid) {
          await postReaction(filmId || '', {
            reaction: config.type,
            sessionTimestamp: elapsed,
            currentScore: newScore,
            sessionId: sid,
          });
        }
      } catch {
        // API errors do not block the local experience
      }
    },
    [lastReactionTime, running, elapsed, score, sessionId, filmId],
  );

  // End session
  const handleEndSession = useCallback(() => {
    setRunning(false);
    // Add starting point if missing
    if (points.length === 0) {
      setPoints([{ timestamp: 0, score: 5.0, reaction: 'up' }]);
    }
    setScreen('post');
  }, [points.length]);

  // Reset timer
  const handleReset = useCallback(() => {
    setRunning(false);
    setElapsed(0);
    setScore(5.0);
    setPoints([]);
    setSessionId(null);
    setLastReactionTime(0);
    setCooldownLeft(0);
  }, []);

  // Start beat rating
  const handleRateBeats = useCallback(() => {
    if (film?.sentimentGraph?.dataPoints) {
      const beats = selectBeats(film.sentimentGraph.dataPoints);
      setSelectedBeats(beats);
      const initial: Record<string, number> = {};
      beats.forEach((b) => { initial[b.label] = 5.0; });
      setBeatRatings(initial);
    }
    setScreen('beats');
  }, [film]);

  // Submit beat ratings and go to merged view
  const handleSubmitBeats = useCallback(() => {
    setScreen('merged');
  }, []);

  // Share
  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `My live reaction arc for ${film?.title ?? 'a film'} on Cinemagraphs: ${score.toFixed(1)}/10`,
      });
    } catch {
      // Share cancelled
    }
  }, [film, score]);

  // Go home
  const handleHome = useCallback(() => {
    router.push('/(tabs)' as any);
  }, [router]);

  // Computed values for post-session
  const finalScore = points.length > 0 ? points[points.length - 1].score : score;
  const peakPoint = points.length > 0 ? points.reduce((a, b) => (b.score > a.score ? b : a), points[0]) : null;
  const lowPoint = points.length > 0 ? points.reduce((a, b) => (b.score < a.score ? b : a), points[0]) : null;
  const criticsAvg = film?.sentimentGraph?.overallScore ?? 0;

  // Merged view data
  const beatPointsForGraph = selectedBeats
    .filter((b) => beatRatings[b.label] !== undefined)
    .map((b) => ({
      timestamp: b.timeMidpoint * 60,
      score: beatRatings[b.label],
      label: b.label,
    }));

  const divergence = findDivergence(points, beatPointsForGraph);

  const isCooling = cooldownLeft > 0;

  // =========================================================================
  // SCREEN 1: Active Session
  // =========================================================================

  if (screen === 'active') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Back button */}
        <Pressable onPress={() => router.back()} style={styles.back}>
          <BackChevron />
        </Pressable>

        {/* Gold header banner */}
        <View style={styles.banner}>
          <LightningIcon />
          <Text style={styles.bannerText}>Live Reaction Mode</Text>
          <View style={styles.livePill}>
            <Text style={styles.livePillText}>LIVE</Text>
          </View>
          <Text style={styles.bannerFilm} numberOfLines={1}>
            {film?.title ?? 'Loading...'}
          </Text>
        </View>

        {/* Timer section */}
        <View style={styles.timerSection}>
          <View style={styles.timerRow}>
            <Text style={styles.timerDisplay}>{formatTime(elapsed)}</Text>
            <View style={styles.timerControls}>
              <Pressable
                onPress={() => setRunning(!running)}
                style={[styles.timerPill, running && styles.timerPillRed]}
              >
                <Text style={[styles.timerPillText, running && styles.timerPillTextWhite]}>
                  {running ? 'Pause' : 'Play'}
                </Text>
              </Pressable>
              <Pressable onPress={handleReset} style={styles.timerPillOutlined}>
                <Text style={styles.timerPillTextMuted}>Reset</Text>
              </Pressable>
              <Pressable onPress={handleEndSession} style={styles.timerPillOutlined}>
                <Text style={[styles.timerPillTextMuted, { color: colors.gold }]}>End</Text>
              </Pressable>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <View style={styles.timestampRow}>
            <Text style={styles.timestampText}>0:00</Text>
            <Text style={styles.timestampText}>{formatRuntime(film?.runtime ?? 180)}</Text>
          </View>
        </View>

        {/* Graph section */}
        <View style={styles.graphContainer}>
          <View style={styles.graphHeader}>
            <Text style={styles.graphLabel}>YOUR SENTIMENT</Text>
            <Text style={styles.graphScore}>{score.toFixed(1)}</Text>
          </View>
          <LiveGraph
            points={points}
            width={graphWidth}
            height={80}
            runtimeSeconds={runtimeSeconds}
          />
        </View>

        {/* Reaction buttons anchored to bottom */}
        <View style={[styles.reactionsContainer, { paddingBottom: insets.bottom + 16 }]}>
          {/* Row 1: Like / Dislike */}
          <View style={styles.reactionRow}>
            {PRIMARY_REACTIONS.map((r) => (
              <Pressable
                key={r.type}
                onPress={() => handleReaction(r)}
                style={[
                  styles.reactionPrimary,
                  {
                    backgroundColor:
                      r.type === 'up'
                        ? 'rgba(45,212,168,0.08)'
                        : 'rgba(226,75,74,0.08)',
                    borderColor:
                      r.type === 'up'
                        ? 'rgba(45,212,168,0.2)'
                        : 'rgba(226,75,74,0.2)',
                  },
                  isCooling && styles.reactionDisabled,
                ]}
                disabled={isCooling}
              >
                <Text style={styles.emojiPrimary}>{r.emoji}</Text>
                <Text style={styles.reactionLabel}>{r.label}</Text>
                <Text style={[styles.reactionWeight, { color: r.color }]}>
                  {r.weight > 0 ? '+' : ''}{r.weight.toFixed(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Row 2: Wow / Shock / Funny */}
          <View style={styles.reactionRow}>
            {SECONDARY_REACTIONS.map((r) => (
              <Pressable
                key={r.type}
                onPress={() => handleReaction(r)}
                style={[
                  styles.reactionSecondary,
                  isCooling && styles.reactionDisabled,
                ]}
                disabled={isCooling}
              >
                <Text style={styles.emojiSecondary}>{r.emoji}</Text>
                <Text style={styles.reactionLabelSmall}>{r.label}</Text>
                <Text style={[styles.reactionWeightSmall, { color: r.color }]}>
                  {r.weight > 0 ? '+' : ''}{r.weight.toFixed(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.cooldownHint}>
            {isCooling
              ? `Wait... ${(cooldownLeft / 1000).toFixed(1)}s`
              : 'Cooldown: 3s between reactions'}
          </Text>
        </View>
      </View>
    );
  }

  // =========================================================================
  // SCREEN 2: Post-Session
  // =========================================================================

  if (screen === 'post') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={[styles.postScroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <View style={styles.postTitle}>
            <Text style={styles.postTitleText}>Your arc for {film?.title ?? 'this film'}</Text>
            <Text style={styles.postSubtitle}>Session complete</Text>
          </View>

          {/* Arc graph */}
          <View style={styles.graphContainer}>
            <LiveGraph
              points={points}
              width={graphWidth}
              height={80}
              runtimeSeconds={runtimeSeconds}
            />
          </View>

          {/* Score cards */}
          <View style={styles.cardRow}>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreCardValue}>{finalScore.toFixed(1)}</Text>
              <Text style={styles.scoreCardLabel}>Your score</Text>
            </View>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreCardValueWhite}>{criticsAvg.toFixed(1)}</Text>
              <Text style={styles.scoreCardLabel}>Critics avg</Text>
            </View>
          </View>

          {/* Peak / Low cards */}
          <View style={styles.cardRow}>
            <View style={styles.peakCard}>
              <Text style={styles.peakLabel}>Your peak</Text>
              <Text style={styles.peakTimestamp}>
                {peakPoint ? formatTimestamp(peakPoint.timestamp) : '--'}
              </Text>
              <Text style={styles.peakScore}>
                {peakPoint ? `${peakPoint.score.toFixed(0)}/10` : '--'}
              </Text>
            </View>
            <View style={styles.lowCard}>
              <Text style={styles.lowLabel}>Your low</Text>
              <Text style={styles.lowTimestamp}>
                {lowPoint ? formatTimestamp(lowPoint.timestamp) : '--'}
              </Text>
              <Text style={styles.lowScore}>
                {lowPoint ? `${lowPoint.score.toFixed(0)}/10` : '--'}
              </Text>
            </View>
          </View>

          {/* Rate beats CTA */}
          {film?.sentimentGraph?.dataPoints && film.sentimentGraph.dataPoints.length >= 2 && (
            <Pressable onPress={handleRateBeats} style={styles.beatsCta}>
              <Text style={styles.beatsCtaText}>Rate the story beats</Text>
            </Pressable>
          )}

          {/* Share / Home */}
          <View style={styles.cardRow}>
            <Pressable onPress={handleShare} style={styles.actionBtn}>
              <Text style={styles.actionBtnTextGold}>Share</Text>
            </Pressable>
            <Pressable onPress={handleHome} style={styles.actionBtn}>
              <Text style={styles.actionBtnTextMuted}>Home</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // =========================================================================
  // SCREEN 2b: Beat Rating
  // =========================================================================

  if (screen === 'beats') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={[styles.postScroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.postTitle}>
            <Text style={styles.postTitleText}>Rate the story beats</Text>
            <Text style={styles.postSubtitle}>{film?.title ?? ''}</Text>
          </View>

          {selectedBeats.map((beat) => (
            <View key={beat.label} style={styles.beatCard}>
              <View style={styles.beatHeader}>
                <Text style={styles.beatLabel} numberOfLines={1}>{beat.label}</Text>
                <Text style={styles.beatTimestamp}>{formatTimestamp(beat.timeMidpoint)}</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={10}
                step={0.5}
                value={beatRatings[beat.label] ?? 5}
                onValueChange={(v) =>
                  setBeatRatings((prev) => ({ ...prev, [beat.label]: v }))
                }
                minimumTrackTintColor={colors.gold}
                maximumTrackTintColor="rgba(245,240,225,0.08)"
                thumbTintColor={colors.gold}
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabelText}>1 Hated it</Text>
                <Text style={styles.sliderLabelText}>
                  {(beatRatings[beat.label] ?? 5).toFixed(1)}
                </Text>
                <Text style={styles.sliderLabelText}>10 Loved it</Text>
              </View>
            </View>
          ))}

          <Pressable onPress={handleSubmitBeats} style={styles.beatsCta}>
            <Text style={styles.beatsCtaText}>See merged view</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // =========================================================================
  // SCREEN 3: Merged View
  // =========================================================================

  if (screen === 'merged') {
    const peakBeat = beatPointsForGraph.length > 0
      ? beatPointsForGraph.reduce((a, b) => (b.score > a.score ? b : a), beatPointsForGraph[0])
      : null;
    const lowBeat = beatPointsForGraph.length > 0
      ? beatPointsForGraph.reduce((a, b) => (b.score < a.score ? b : a), beatPointsForGraph[0])
      : null;

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={[styles.postScroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <View style={styles.postTitle}>
            <Text style={styles.postTitleText}>Your arc for {film?.title ?? 'this film'}</Text>
            <Text style={styles.postSubtitle}>Live reaction + story beats</Text>
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: colors.gold }]} />
              <Text style={styles.legendText}>Live reaction</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: colors.teal }]} />
              <Text style={styles.legendText}>Story beats</Text>
            </View>
          </View>

          {/* Merged graph */}
          <View style={styles.graphContainer}>
            <MergedGraph
              livePoints={points}
              beatPoints={beatPointsForGraph}
              width={graphWidth}
              height={90}
              runtimeSeconds={runtimeSeconds}
            />
          </View>

          {/* Score cards */}
          <View style={styles.cardRow}>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreCardValue}>{finalScore.toFixed(1)}</Text>
              <Text style={styles.scoreCardLabel}>Your score</Text>
            </View>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreCardValueWhite}>{criticsAvg.toFixed(1)}</Text>
              <Text style={styles.scoreCardLabel}>Critics avg</Text>
            </View>
          </View>

          {/* Peak / Low with beat labels */}
          <View style={styles.cardRow}>
            <View style={styles.peakCard}>
              <Text style={styles.peakLabel}>Your peak</Text>
              <Text style={styles.peakBeatLabel} numberOfLines={1}>
                {peakBeat?.label ?? (peakPoint ? formatTimestamp(peakPoint.timestamp) : '--')}
              </Text>
              <Text style={styles.peakScore}>
                {peakBeat
                  ? `${formatTimestamp(peakBeat.timestamp)} \u00B7 ${peakBeat.score.toFixed(0)}/10`
                  : peakPoint
                    ? `${peakPoint.score.toFixed(0)}/10`
                    : '--'}
              </Text>
            </View>
            <View style={styles.lowCard}>
              <Text style={styles.lowLabel}>Your low</Text>
              <Text style={styles.lowBeatLabel} numberOfLines={1}>
                {lowBeat?.label ?? (lowPoint ? formatTimestamp(lowPoint.timestamp) : '--')}
              </Text>
              <Text style={styles.lowScore}>
                {lowBeat
                  ? `${formatTimestamp(lowBeat.timestamp)} \u00B7 ${lowBeat.score.toFixed(0)}/10`
                  : lowPoint
                    ? `${lowPoint.score.toFixed(0)}/10`
                    : '--'}
              </Text>
            </View>
          </View>

          {/* Divergence insight */}
          {divergence && (
            <View style={styles.divergenceBlock}>
              <Text style={styles.divergenceText}>
                Your live gut reaction diverged most at{' '}
                <Text style={{ color: colors.gold }}>{formatTimestamp(divergence.timestamp)}</Text>
              </Text>
              <Text style={styles.divergenceDetail}>
                Live: {divergence.liveScore.toFixed(0)}/10 vs Beat rating: {divergence.beatScore.toFixed(0)}/10
              </Text>
            </View>
          )}

          {/* Share / Home */}
          <View style={styles.cardRow}>
            <Pressable onPress={handleShare} style={styles.actionBtn}>
              <Text style={styles.actionBtnTextGold}>Share</Text>
            </Pressable>
            <Pressable onPress={handleHome} style={styles.actionBtn}>
              <Text style={styles.actionBtnTextMuted}>Home</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  back: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },

  // Banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(200,169,81,0.08)',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  bannerText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.gold,
  },
  livePill: {
    backgroundColor: '#E24B4A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  livePillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 8,
    color: '#fff',
  },
  bannerFilm: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(245,240,225,0.4)',
    flex: 1,
    textAlign: 'right',
  },

  // Timer
  timerSection: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  timerDisplay: {
    fontFamily: fonts.bodyMedium,
    fontSize: 22,
    color: colors.ivory,
    letterSpacing: 2,
  },
  timerControls: {
    flexDirection: 'row',
    gap: 4,
  },
  timerPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(245,240,225,0.2)',
  },
  timerPillRed: {
    backgroundColor: '#E24B4A',
    borderColor: '#E24B4A',
  },
  timerPillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: 'rgba(245,240,225,0.5)',
  },
  timerPillTextWhite: {
    color: '#fff',
  },
  timerPillOutlined: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(245,240,225,0.2)',
  },
  timerPillTextMuted: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(245,240,225,0.5)',
  },

  // Progress
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(245,240,225,0.08)',
    borderRadius: 2,
    marginBottom: 3,
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.gold,
    borderRadius: 2,
  },
  timestampRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timestampText: {
    fontFamily: fonts.body,
    fontSize: 8,
    color: 'rgba(245,240,225,0.25)',
  },

  // Graph
  graphContainer: {
    backgroundColor: 'rgba(245,240,225,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.10)',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 14,
    marginBottom: 12,
  },
  graphHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  graphLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: 'rgba(245,240,225,0.3)',
    textTransform: 'uppercase',
  },
  graphScore: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.gold,
  },

  // Reactions
  reactionsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: colors.background,
  },
  reactionRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 6,
  },
  reactionPrimary: {
    flex: 1,
    borderWidth: 0.5,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  reactionSecondary: {
    flex: 1,
    backgroundColor: 'rgba(245,240,225,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.12)',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  reactionDisabled: {
    opacity: 0.4,
  },
  emojiPrimary: {
    fontSize: 22,
  },
  emojiSecondary: {
    fontSize: 18,
  },
  reactionLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.ivory,
    marginTop: 3,
  },
  reactionLabelSmall: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.ivory,
    marginTop: 2,
  },
  reactionWeight: {
    fontFamily: fonts.body,
    fontSize: 9,
  },
  reactionWeightSmall: {
    fontFamily: fonts.body,
    fontSize: 8,
  },
  cooldownHint: {
    fontFamily: fonts.body,
    fontSize: 8,
    color: 'rgba(245,240,225,0.2)',
    textAlign: 'center',
  },

  // Post-session shared styles
  postScroll: {
    paddingHorizontal: 14,
    paddingTop: 40,
  },
  postTitle: {
    alignItems: 'center',
    marginBottom: 16,
  },
  postTitleText: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.ivory,
    marginBottom: 3,
  },
  postSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(245,240,225,0.4)',
  },

  // Card row
  cardRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  scoreCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(245,240,225,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.12)',
    borderRadius: 10,
  },
  scoreCardValue: {
    fontFamily: fonts.heading,
    fontSize: 24,
    color: colors.gold,
  },
  scoreCardValueWhite: {
    fontFamily: fonts.heading,
    fontSize: 24,
    color: colors.ivory,
  },
  scoreCardLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(245,240,225,0.4)',
    marginTop: 3,
  },

  // Peak / Low
  peakCard: {
    flex: 1,
    backgroundColor: 'rgba(45,212,168,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(45,212,168,0.2)',
    borderRadius: 10,
    padding: 10,
  },
  peakLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 9,
    color: colors.teal,
    marginBottom: 2,
  },
  peakTimestamp: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ivory,
    marginBottom: 1,
  },
  peakBeatLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ivory,
    marginBottom: 1,
  },
  peakScore: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(245,240,225,0.4)',
  },
  lowCard: {
    flex: 1,
    backgroundColor: 'rgba(226,75,74,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(226,75,74,0.2)',
    borderRadius: 10,
    padding: 10,
  },
  lowLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 9,
    color: '#E24B4A',
    marginBottom: 2,
  },
  lowTimestamp: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ivory,
    marginBottom: 1,
  },
  lowBeatLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ivory,
    marginBottom: 1,
  },
  lowScore: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(245,240,225,0.4)',
  },

  // Beats CTA
  beatsCta: {
    backgroundColor: 'rgba(45,212,168,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(45,212,168,0.3)',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  beatsCtaText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.teal,
  },

  // Action buttons
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: 'rgba(245,240,225,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.12)',
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnTextGold: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.gold,
  },
  actionBtnTextMuted: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: 'rgba(245,240,225,0.5)',
  },

  // Beat rating
  beatCard: {
    backgroundColor: 'rgba(245,240,225,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.12)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  beatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  beatLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ivory,
    flex: 1,
  },
  beatTimestamp: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.4)',
  },
  slider: {
    width: '100%',
    height: 24,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  sliderLabelText: {
    fontFamily: fonts.body,
    fontSize: 8,
    color: 'rgba(245,240,225,0.25)',
  },

  // Legend
  legendRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendLine: {
    width: 10,
    height: 2,
    borderRadius: 1,
  },
  legendText: {
    fontFamily: fonts.body,
    fontSize: 8,
    color: 'rgba(245,240,225,0.35)',
  },

  // Divergence
  divergenceBlock: {
    alignItems: 'center',
    marginBottom: 14,
  },
  divergenceText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(245,240,225,0.3)',
    textAlign: 'center',
    marginBottom: 4,
  },
  divergenceDetail: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: 'rgba(245,240,225,0.2)',
    textAlign: 'center',
  },
});
