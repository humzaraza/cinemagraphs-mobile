export interface FilmDataPoint {
  timeMidpoint: number;
  score: number;
  label: string;
}

export interface SentimentGraph {
  overallScore: number;
  dataPoints: FilmDataPoint[];
  biggestSwing: string | null;
}

export interface Film {
  id: string;
  title: string;
  year: number;
  posterPath: string | null;
  posterUrl: string | null;
  runtime: number | null;
  genres: string[];
  director: string | null;
  sentimentGraph: SentimentGraph | null;
}

export interface PeakLowMoment {
  time: number;
  label: string;
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

export interface DetailedSentimentGraph extends SentimentGraph {
  peakMoment: PeakLowMoment;
  lowestMoment: PeakLowMoment;
  summary: string;
  overallSentiment: number;
}

export interface ReviewSubmission {
  overallRating: number;
  beginning?: string;
  middle?: string;
  ending?: string;
  otherThoughts?: string;
  beatRatings?: Record<string, number>;
}

export interface FilmDetail extends Film {
  sentimentGraph: DetailedSentimentGraph;
  reviews: FilmReview[];
  director: string;
  genres: string[];
  runtime: number;
  backdropUrl: string;
}
