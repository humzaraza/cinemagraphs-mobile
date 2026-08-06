// Mirrors the web's formatReviewProse (src/lib/review-prose.ts): stitch the
// section fields in order, skipping empty ones, then fall back to the
// denormalized combinedText when no section survives.

export interface ReviewProseFields {
  beginning?: string | null;
  middle?: string | null;
  ending?: string | null;
  otherThoughts?: string | null;
  combinedText?: string | null;
}

export function stitchReviewProse(review: ReviewProseFields): string {
  const stitched = [review.beginning, review.middle, review.ending, review.otherThoughts]
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .join('\n\n');
  return stitched || review.combinedText || '';
}
