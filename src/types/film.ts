export interface Film {
  id: string;
  title: string;
  posterPath: string;
  releaseDate: string;
  overallScore: number;
}

export interface StoryBeat {
  label: string;
  timeMidpoint: string;
  score: number;
}

export interface PeakLowMoment {
  label: string;
  timeMidpoint: string;
  score: number;
}

export interface ReviewUser {
  id: string;
  name: string;
  image?: string;
}

export interface FilmReview {
  id: string;
  user: ReviewUser;
  score: number;
  content: string;
  createdAt: string;
}

export interface SentimentGraph {
  dataPoints: number[];
  storyBeats: StoryBeat[];
  peakMoment: PeakLowMoment;
  lowestMoment: PeakLowMoment;
  summary: string;
  overallSentiment: number;
}

export interface FilmDetail extends Film {
  sentimentGraph: SentimentGraph;
  reviews: FilmReview[];
  director: string;
  genres: string[];
  runtime: number;
  backdropPath: string;
}
