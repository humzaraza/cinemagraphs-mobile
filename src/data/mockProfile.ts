// Mock data for Profile tab. Will be replaced with real API calls after auth (Prompt 9).

export interface MockUser {
  id: string;
  name: string;
  bio: string;
  avatarInitial: string;
  stats: { films: number; following: number; followers: number };
  counts: { reviewed: number; watched: number; watchlist: number; lists: number };
}

export interface MockFilm {
  id: string;
  title: string;
  year: number;
  posterUrl: string;
  score: number;
  personalScore: number;
  status: 'watched' | 'reviewed';
  runtime: number;
  genres: string[];
  sparklineData: number[];
  dominantColor: string;
  dateWatched: string;
}

export interface MockWatchlistFilm {
  id: string;
  title: string;
  year: number;
  posterUrl: string;
}

export const mockUser: MockUser = {
  id: 'mock-user-1',
  name: 'humza',
  bio: 'Film sentiment, beat by beat',
  avatarInitial: 'H',
  stats: { films: 42, following: 128, followers: 89 },
  counts: { reviewed: 24, watched: 18, watchlist: 7, lists: 3 },
};

export const mockFilms: MockFilm[] = [
  {
    id: 'oppenheimer-2023',
    title: 'Oppenheimer',
    year: 2023,
    posterUrl: 'https://image.tmdb.org/t/p/w185/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
    score: 8.6,
    personalScore: 9.0,
    status: 'reviewed',
    runtime: 180,
    genres: ['Drama', 'History'],
    sparklineData: [7, 6.5, 8, 7.5, 9, 8.5, 9.5, 8],
    dominantColor: '#8B4513',
    dateWatched: '2026-04-05',
  },
  {
    id: 'poor-things-2023',
    title: 'Poor Things',
    year: 2023,
    posterUrl: 'https://image.tmdb.org/t/p/w185/kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg',
    score: 8.1,
    personalScore: 8.5,
    status: 'reviewed',
    runtime: 141,
    genres: ['Comedy', 'Drama', 'Sci-Fi'],
    sparklineData: [6, 7, 8, 7.5, 9, 8, 8.5],
    dominantColor: '#2E4057',
    dateWatched: '2026-04-03',
  },
  {
    id: 'dune-part-two-2024',
    title: 'Dune: Part Two',
    year: 2024,
    posterUrl: 'https://image.tmdb.org/t/p/w185/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
    score: 8.4,
    personalScore: 9.5,
    status: 'reviewed',
    runtime: 166,
    genres: ['Sci-Fi', 'Adventure'],
    sparklineData: [7, 7.5, 8, 8.5, 9, 9.5, 10, 9],
    dominantColor: '#B8860B',
    dateWatched: '2026-03-28',
  },
  {
    id: 'the-holdovers-2023',
    title: 'The Holdovers',
    year: 2023,
    posterUrl: 'https://image.tmdb.org/t/p/w185/VHSzNBTwxV8vh7wylo7O9CLdac.jpg',
    score: 7.9,
    personalScore: 8.0,
    status: 'reviewed',
    runtime: 133,
    genres: ['Comedy', 'Drama'],
    sparklineData: [6, 6.5, 7, 7.5, 8, 8.5, 7, 8],
    dominantColor: '#8B0000',
    dateWatched: '2026-03-22',
  },
  {
    id: 'killers-of-the-flower-moon-2023',
    title: 'Killers of the Flower Moon',
    year: 2023,
    posterUrl: 'https://image.tmdb.org/t/p/w185/dB6Krk806zeqd0YNp2ngQ9zXteH.jpg',
    score: 7.8,
    personalScore: 7.5,
    status: 'reviewed',
    runtime: 206,
    genres: ['Crime', 'Drama', 'History'],
    sparklineData: [7, 6, 5, 6.5, 7, 8, 7.5, 6],
    dominantColor: '#556B2F',
    dateWatched: '2026-03-15',
  },
  {
    id: 'past-lives-2023',
    title: 'Past Lives',
    year: 2023,
    posterUrl: 'https://image.tmdb.org/t/p/w185/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg',
    score: 8.0,
    personalScore: 8.5,
    status: 'reviewed',
    runtime: 106,
    genres: ['Drama', 'Romance'],
    sparklineData: [5, 6, 7, 7.5, 8, 9, 8.5],
    dominantColor: '#4A6670',
    dateWatched: '2026-03-08',
  },
  {
    id: 'barbie-2023',
    title: 'Barbie',
    year: 2023,
    posterUrl: 'https://image.tmdb.org/t/p/w185/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg',
    score: 7.2,
    personalScore: 7.0,
    status: 'watched',
    runtime: 114,
    genres: ['Comedy', 'Adventure'],
    sparklineData: [7, 8, 7.5, 6, 5.5, 6.5, 7],
    dominantColor: '#E91E8F',
    dateWatched: '2026-02-14',
  },
  {
    id: 'anatomy-of-a-fall-2023',
    title: 'Anatomy of a Fall',
    year: 2023,
    posterUrl: 'https://image.tmdb.org/t/p/w185/kQs6keheMwCxJxrzV83VUwFtHkB.jpg',
    score: 7.9,
    personalScore: 8.0,
    status: 'reviewed',
    runtime: 152,
    genres: ['Thriller', 'Drama'],
    sparklineData: [6, 7, 8, 7, 8.5, 9, 8],
    dominantColor: '#87CEEB',
    dateWatched: '2026-02-20',
  },
  {
    id: 'the-zone-of-interest-2023',
    title: 'The Zone of Interest',
    year: 2023,
    posterUrl: 'https://image.tmdb.org/t/p/w185/hUu9zyZmDd8VZegKi1iK1Vk0RYS.jpg',
    score: 7.5,
    personalScore: 7.0,
    status: 'watched',
    runtime: 105,
    genres: ['Drama', 'History', 'War'],
    sparklineData: [5, 6, 7, 6.5, 7, 8, 7.5],
    dominantColor: '#3A5F0B',
    dateWatched: '2026-02-10',
  },
  {
    id: 'saltburn-2023',
    title: 'Saltburn',
    year: 2023,
    posterUrl: 'https://image.tmdb.org/t/p/w185/qjhahNLSZ705B5JP92YMEYPocPz.jpg',
    score: 7.1,
    personalScore: 7.5,
    status: 'watched',
    runtime: 131,
    genres: ['Thriller', 'Drama', 'Comedy'],
    sparklineData: [6, 7, 8, 7, 6, 5, 8],
    dominantColor: '#4A2C7A',
    dateWatched: '2026-02-01',
  },
];

export const mockWatchlist: MockWatchlistFilm[] = [
  {
    id: 'the-brutalist-2024',
    title: 'The Brutalist',
    year: 2024,
    posterUrl: 'https://image.tmdb.org/t/p/w185/vP7Yd6couiAaw9jgMd5cjMRj3hQ.jpg',
  },
  {
    id: 'anora-2024',
    title: 'Anora',
    year: 2024,
    posterUrl: 'https://image.tmdb.org/t/p/w185/oN0o3owobFjePDc5vMdLRAd0jkd.jpg',
  },
  {
    id: 'conclave-2024',
    title: 'Conclave',
    year: 2024,
    posterUrl: 'https://image.tmdb.org/t/p/w185/vYEyxF1UT779RiEalpMjUT6kfdf.jpg',
  },
  {
    id: 'the-substance-2024',
    title: 'The Substance',
    year: 2024,
    posterUrl: 'https://image.tmdb.org/t/p/w185/lqoMzCcZYEFK729d6qzt349fB4o.jpg',
  },
  {
    id: 'a-real-pain-2024',
    title: 'A Real Pain',
    year: 2024,
    posterUrl: 'https://image.tmdb.org/t/p/w185/67xRIXm5TxXRT4nV2V4AEJ9yq2d.jpg',
  },
];
