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
  // Returned by /api/films and /api/hero for authenticated requests
  // only; absent when anonymous or on older server responses.
  userHasReviewed?: boolean;
}

export interface PeakLowMoment {
  time: number;
  label: string;
  score: number;
}

// name is nullable on the wire (same identity selection as
// ReviewDetailUser in src/lib/api.ts); render "Anonymous" for null.
export interface ReviewUser {
  id: string;
  name: string | null;
  image?: string;
}

// Review row as returned by GET /api/films/[id]/reviews: the rating is
// overallRating, and prose lives in the four section fields with the
// denormalized combinedText as a fallback (there is no single `content`).
export interface FilmReview {
  id: string;
  user: ReviewUser;
  overallRating: number;
  beginning: string | null;
  middle: string | null;
  ending: string | null;
  otherThoughts: string | null;
  combinedText: string | null;
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

// Daily hero (GET /api/hero, backend PR #55). The film payload matches
// the detail shape closely enough for the Explore hero card: it always
// includes peakMoment/lowestMoment inside sentimentGraph, which the hero
// graph uses directly for the teal/red dots.
export interface HeroSentimentGraph extends SentimentGraph {
  peakMoment: PeakLowMoment;
  lowestMoment: PeakLowMoment;
}

export interface HeroFilm extends Film {
  sentimentGraph: HeroSentimentGraph | null;
}

// kind varies by weekday ("shape" on Wed/Sat, other kinds on other
// days); label is always the lowercase space-separated angle name used
// to key display copy.
export interface HeroAngle {
  kind: string;
  shape?: string;
  label: string;
}

export interface HeroResponse {
  film: HeroFilm;
  angle: HeroAngle;
  usedFallback: boolean;
}

export interface ReviewsResponse {
  reviews: FilmReview[];
  total: number;
  myReview: FilmReview | null;
}
