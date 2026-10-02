import { describe, it, expect } from 'vitest';
import { userReviewScore } from '../lib/user-review-score';

describe('userReviewScore', () => {
  it('returns the overall rating alone when there are no beat ratings', () => {
    expect(userReviewScore(6, null)).toBe(6);
    expect(userReviewScore(6, undefined)).toBe(6);
    expect(userReviewScore(6, {})).toBe(6);
  });

  it('rounds a bare overall rating to one decimal', () => {
    expect(userReviewScore(7.26, null)).toBe(7.3);
  });

  it('blends a single beat evenly with the overall rating', () => {
    // (0.5 * 8) + (0.5 * 6) = 7
    expect(userReviewScore(6, { Opening: 8 })).toBe(7);
  });

  it('blends the mean of several beats evenly with the overall rating', () => {
    // mean(8, 7, 9) = 8; (0.5 * 8) + (0.5 * 6) = 7.0
    expect(userReviewScore(6, { Opening: 8, Midpoint: 7, Climax: 9 })).toBe(7);
    // mean(2, 9.5) = 5.75; (0.5 * 5.75) + (0.5 * 8) = 6.875 -> 6.9
    expect(userReviewScore(8, { Opening: 2, Climax: 9.5 })).toBe(6.9);
  });

  it('rounds a .5 midpoint up to one decimal', () => {
    // (0.5 * 7) + (0.5 * 7.5) = 7.25 -> 7.3
    expect(userReviewScore(7.5, { Opening: 7 })).toBe(7.3);
  });

  it('ignores non-numeric beat values', () => {
    const beats = {
      Opening: 8,
      Midpoint: '7' as unknown as number,
      Climax: Number.NaN,
      Resolution: null as unknown as number,
      Coda: undefined as unknown as number,
    };
    // Only Opening counts: (0.5 * 8) + (0.5 * 6) = 7
    expect(userReviewScore(6, beats)).toBe(7);
  });

  it('falls back to the overall rating when every beat value is non-numeric', () => {
    const beats = { Opening: 'high' as unknown as number };
    expect(userReviewScore(6.5, beats)).toBe(6.5);
  });
});
