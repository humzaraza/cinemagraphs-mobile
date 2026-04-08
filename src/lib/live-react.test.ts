import { describe, it, expect } from 'vitest';
import {
  clampScore,
  applyReaction,
  canReact,
  selectBeats,
  findDivergence,
  COOLDOWN_MS,
} from './live-react';
import type { FilmDataPoint, ReactionPoint } from '../types/film';

// ---------------------------------------------------------------------------
// Score calculation
// ---------------------------------------------------------------------------

describe('clampScore', () => {
  it('returns value within bounds', () => {
    expect(clampScore(5)).toBe(5);
    expect(clampScore(7.3)).toBe(7.3);
  });

  it('clamps to 1 at the low end', () => {
    expect(clampScore(0)).toBe(1);
    expect(clampScore(-5)).toBe(1);
  });

  it('clamps to 10 at the high end', () => {
    expect(clampScore(11)).toBe(10);
    expect(clampScore(100)).toBe(10);
  });
});

describe('applyReaction', () => {
  it('starts at 5.0 and applies +0.5', () => {
    expect(applyReaction(5.0, 0.5)).toBe(5.5);
  });

  it('applies -0.5', () => {
    expect(applyReaction(5.0, -0.5)).toBe(4.5);
  });

  it('applies +1.0 (wow)', () => {
    expect(applyReaction(5.0, 1.0)).toBe(6.0);
  });

  it('clamps at 10 when exceeding max', () => {
    expect(applyReaction(9.8, 1.0)).toBe(10);
  });

  it('clamps at 1 when going below min', () => {
    expect(applyReaction(1.3, -0.5)).toBe(1);
  });

  it('chains multiple reactions correctly', () => {
    let score = 5.0;
    score = applyReaction(score, 0.5);  // 5.5
    score = applyReaction(score, 0.5);  // 6.0
    score = applyReaction(score, -0.5); // 5.5
    score = applyReaction(score, 1.0);  // 6.5
    score = applyReaction(score, 0.3);  // 6.8
    expect(score).toBeCloseTo(6.8);
  });
});

// ---------------------------------------------------------------------------
// Cooldown logic
// ---------------------------------------------------------------------------

describe('canReact', () => {
  it('allows reaction when cooldown has elapsed', () => {
    expect(canReact(1000, 1000 + COOLDOWN_MS)).toBe(true);
  });

  it('allows reaction well after cooldown', () => {
    expect(canReact(1000, 1000 + COOLDOWN_MS + 5000)).toBe(true);
  });

  it('blocks reaction within cooldown period', () => {
    expect(canReact(1000, 1000 + 1000)).toBe(false);
  });

  it('blocks reaction at exactly cooldown minus 1ms', () => {
    expect(canReact(1000, 1000 + COOLDOWN_MS - 1)).toBe(false);
  });

  it('allows first reaction (lastReactionTime = 0)', () => {
    expect(canReact(0, COOLDOWN_MS)).toBe(true);
    expect(canReact(0, 1000)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Beat selection
// ---------------------------------------------------------------------------

function makeBeats(count: number): FilmDataPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    timeMidpoint: i * 10,
    score: 5 + Math.sin(i) * 3,
    label: `Beat ${i + 1}`,
  }));
}

describe('selectBeats', () => {
  it('returns all beats when count <= 8', () => {
    const beats = makeBeats(5);
    expect(selectBeats(beats)).toEqual(beats);
    expect(selectBeats(beats)).toHaveLength(5);
  });

  it('returns exactly 8 when count > 8', () => {
    const beats = makeBeats(20);
    const selected = selectBeats(beats);
    expect(selected).toHaveLength(8);
  });

  it('always includes first and last beat', () => {
    const beats = makeBeats(15);
    const selected = selectBeats(beats);
    expect(selected[0]).toBe(beats[0]);
    expect(selected[selected.length - 1]).toBe(beats[beats.length - 1]);
  });

  it('includes peak and lowest scoring beats', () => {
    const beats = makeBeats(12);
    const peakScore = Math.max(...beats.map((b) => b.score));
    const lowScore = Math.min(...beats.map((b) => b.score));
    const selected = selectBeats(beats);
    const selectedScores = selected.map((b) => b.score);
    expect(selectedScores).toContain(peakScore);
    expect(selectedScores).toContain(lowScore);
  });

  it('returns beats in chronological order', () => {
    const beats = makeBeats(20);
    const selected = selectBeats(beats);
    for (let i = 1; i < selected.length; i++) {
      expect(selected[i].timeMidpoint).toBeGreaterThanOrEqual(selected[i - 1].timeMidpoint);
    }
  });
});

// ---------------------------------------------------------------------------
// Divergence calculation
// ---------------------------------------------------------------------------

describe('findDivergence', () => {
  it('returns null when no live points', () => {
    expect(findDivergence([], [{ timestamp: 60, score: 7, label: 'A' }])).toBeNull();
  });

  it('returns null when no beat ratings', () => {
    expect(findDivergence([{ timestamp: 60, score: 7, reaction: 'up' }], [])).toBeNull();
  });

  it('finds the beat with largest live vs beat difference', () => {
    const live: ReactionPoint[] = [
      { timestamp: 0, score: 5, reaction: 'up' },
      { timestamp: 60, score: 8, reaction: 'up' },
      { timestamp: 120, score: 6, reaction: 'down' },
    ];
    const beats = [
      { timestamp: 60, score: 8, label: 'Matching' },    // diff 0
      { timestamp: 120, score: 2, label: 'Divergent' },   // diff 4
    ];
    const result = findDivergence(live, beats);
    expect(result).not.toBeNull();
    expect(result!.label).toBe('Divergent');
    expect(result!.liveScore).toBe(6);
    expect(result!.beatScore).toBe(2);
  });

  it('interpolates live score from most recent point before timestamp', () => {
    const live: ReactionPoint[] = [
      { timestamp: 0, score: 5, reaction: 'up' },
      { timestamp: 100, score: 9, reaction: 'wow' },
    ];
    const beats = [
      { timestamp: 50, score: 3, label: 'Early' },   // live=5, diff=2
      { timestamp: 150, score: 9, label: 'Late' },    // live=9, diff=0
    ];
    const result = findDivergence(live, beats);
    expect(result!.label).toBe('Early');
    expect(result!.liveScore).toBe(5);
  });
});
