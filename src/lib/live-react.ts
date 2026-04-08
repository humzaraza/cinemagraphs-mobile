// Pure logic for live reactions, extracted for testability.

import type { FilmDataPoint, ReactionPoint } from '../types/film';

export const COOLDOWN_MS = 3000;
export const MAX_BEATS = 8;

export function clampScore(score: number): number {
  return Math.max(1, Math.min(10, score));
}

export function applyReaction(current: number, weight: number): number {
  return clampScore(current + weight);
}

export function canReact(lastReactionTime: number, now: number): boolean {
  return now - lastReactionTime >= COOLDOWN_MS;
}

/** Select up to MAX_BEATS: peak, lowest, first, last, then evenly spaced. */
export function selectBeats(dataPoints: FilmDataPoint[]): FilmDataPoint[] {
  if (dataPoints.length <= MAX_BEATS) return dataPoints;
  const indexed = dataPoints.map((dp, i) => ({ dp, i, score: dp.score ?? 0 }));
  const picked = new Set<number>();
  picked.add(0);
  picked.add(dataPoints.length - 1);
  let peakIdx = 0;
  let lowIdx = 0;
  indexed.forEach(({ score }, i) => {
    if (score > indexed[peakIdx].score) peakIdx = i;
    if (score < indexed[lowIdx].score) lowIdx = i;
  });
  picked.add(peakIdx);
  picked.add(lowIdx);
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

export function findDivergence(
  livePoints: ReactionPoint[],
  beatRatings: { timestamp: number; score: number; label: string }[],
): { timestamp: number; liveScore: number; beatScore: number; label: string } | null {
  if (!livePoints.length || !beatRatings.length) return null;
  let maxDiff = -1;
  let result: { timestamp: number; liveScore: number; beatScore: number; label: string } | null = null;
  for (const beat of beatRatings) {
    let liveScore = 5;
    for (let i = 0; i < livePoints.length; i++) {
      if (livePoints[i].timestamp <= beat.timestamp) {
        liveScore = livePoints[i].score;
      } else {
        break;
      }
    }
    const diff = Math.abs(liveScore - beat.score);
    if (diff > maxDiff) {
      maxDiff = diff;
      result = { timestamp: beat.timestamp, liveScore, beatScore: beat.score, label: beat.label };
    }
  }
  return result;
}
