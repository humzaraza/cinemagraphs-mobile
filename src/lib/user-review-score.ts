/**
 * The score shown for a user's own review.
 *
 * A review carries two inputs on the same 1 to 10 scale: the overall slider
 * and the per-beat ratings the user actually set. The displayed score is an
 * even blend of the two, rounded to one decimal:
 *
 *   0.5 * mean(beat ratings) + 0.5 * overallRating
 *
 * When the user rated no beats (null, undefined, an empty map, or a map
 * with no numeric values) the score is the overall rating alone.
 *
 * This is display-only. It never feeds the film's audience graph, which is
 * built from the beat ratings by themselves; the overall slider plays no
 * part in that graph.
 */
export function userReviewScore(
  overallRating: number,
  beatRatings: Record<string, number> | null | undefined,
): number {
  const beats = beatRatings
    ? Object.values(beatRatings).filter(
        (value): value is number => typeof value === 'number' && Number.isFinite(value),
      )
    : [];

  if (beats.length === 0) {
    return Math.round(overallRating * 10) / 10;
  }

  const beatMean = beats.reduce((sum, value) => sum + value, 0) / beats.length;
  const blended = 0.5 * beatMean + 0.5 * overallRating;
  // Math.round rounds a .5 midpoint up, so 7.25 becomes 7.3.
  return Math.round(blended * 10) / 10;
}
