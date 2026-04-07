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
  runtime: number | null;
  genres: string[];
  director: string | null;
  sentimentGraph: SentimentGraph | null;
}
