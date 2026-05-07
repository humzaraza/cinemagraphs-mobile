// Type definitions used as ad-hoc shapes by:
//   - app/(tabs)/profile.tsx
//   - app/list/[id].tsx
//   - src/components/ArcCard.tsx
//   - src/lib/lists.ts

export interface MockFilm {
  id: string;
  title: string;
  year: number;
  posterUrl: string;
  score: number;
  personalScore: number;
  status: 'watched' | 'reviewed' | 'live-reacted';
  runtime: number;
  genres: string[];
  sparklineData: number[];
  dominantColor: string;
  dateWatched: string;
  sentimentGraph?: { dataPoints?: { score: number }[] };
}

export interface MockWatchlistFilm {
  id: string;
  title: string;
  year: number;
  posterUrl: string;
}

export interface MockList {
  id: string;
  name: string;
  genreTag: string;
  filmIds: string[];
  createdAt: string;
}
