import React from 'react';
import { ScrollView } from 'react-native';
import EmptyStateCard from './EmptyStateCard';
import RecentReviewCard, { type RecentReview } from './RecentReviewCard';

type RecentReviewsRowProps = {
  reviews: RecentReview[];
  onPressReview: (filmId: string) => void;
  onFindFilm: () => void;
};

export default function RecentReviewsRow({
  reviews,
  onPressReview,
  onFindFilm,
}: RecentReviewsRowProps) {
  if (reviews.length === 0) {
    return (
      <EmptyStateCard
        icon="◐"
        title="No reviews yet"
        body="Mark the moments that hit. Your arc takes shape from there."
        ctaLabel="Find a film"
        onCtaPress={onFindFilm}
      />
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}
    >
      {reviews.map((review) => (
        <RecentReviewCard
          key={review.filmId}
          review={review}
          onPress={onPressReview}
        />
      ))}
    </ScrollView>
  );
}
