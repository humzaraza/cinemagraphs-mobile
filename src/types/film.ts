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

export interface WikiBeat {
  label: string;
  timeStart?: number;
  timeEnd?: number;
  timeMidpoint: number;
}

export interface FilmBeats {
  beats: WikiBeat[];
  source: string;
}

export interface Film {
  id: string;
  title: string;
  year: number;
  posterPath: string | null;
  posterUrl: string | null;
  // Optional on the listing endpoints (only populated when the API
  // includes backdrops, e.g. /api/films?hasBackdrop=true&sort=popular
  // for the banner picker). Always populated on FilmDetail.
  backdropPath?: string | null;
  backdropUrl?: string | null;
  runtime: number | null;
  genres: string[];
  director: string | null;
  sentimentGraph: SentimentGraph | null;
  filmBeats?: FilmBeats | null;
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

// Live Reactions
export type ReactionType = 'up' | 'down' | 'wow' | 'shock' | 'funny';

export interface ReactionPoint {
  timestamp: number; // elapsed seconds
  score: number;
  reaction: ReactionType;
}

export interface LiveReactionSession {
  id: string;
  userId: string;
  filmId: string;
  startedAt: string;
  lastReactionAt: string;
  completionRate: number;
  reactions?: ReactionPoint[];
}

export interface FilmDetail extends Film {
  sentimentGraph: DetailedSentimentGraph;
  reviews: FilmReview[];
  director: string;
  genres: string[];
  runtime: number;
  backdropUrl: string;
  // Added in PR 4a (server) and consumed by PR 4b (mobile). Optional
  // because older API responses or unauthenticated requests may omit it.
  userHasReviewed?: boolean;
  similarFilms?: SimilarFilm[];
}

export interface SimilarFilm {
  id: string;
  title: string;
  year: number;
  posterUrl: string | null;
  score: number | null;
  userHasReviewed: boolean;
}

export interface ReviewsResponse {
  reviews: FilmReview[];
  total: number;
  myReview: FilmReview | null;
}
