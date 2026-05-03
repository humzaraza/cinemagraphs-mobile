// Category routing map. Used by the search browse list and the
// category detail screen to convert between the slug in the URL
// (CategoryKey), the human-readable label, and the API query
// params for /api/films.
//
// "Recently added" is intentionally absent: the API doesn't have
// a sort that corresponds to it yet. Revisit when that lands.

export type CategoryKey =
  | 'drama'
  | 'action'
  | 'horror'
  | 'sci-fi'
  | 'comedy'
  | 'thriller'
  | 'highest-rated'
  | 'most-dramatic'
  | 'release-date';

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  'drama': 'Drama',
  'action': 'Action',
  'horror': 'Horror',
  'sci-fi': 'Sci-Fi',
  'comedy': 'Comedy',
  'thriller': 'Thriller',
  'highest-rated': 'Highest rated',
  'most-dramatic': 'Most dramatic arcs',
  'release-date': 'Release date',
};

export const CATEGORY_PARAMS: Record<
  CategoryKey,
  { genre?: string; sort?: 'highest' | 'swing' | 'recent' }
> = {
  'drama': { genre: 'Drama' },
  'action': { genre: 'Action' },
  'horror': { genre: 'Horror' },
  // TMDB uses the full name "Science Fiction" rather than "Sci-Fi"
  'sci-fi': { genre: 'Science Fiction' },
  'comedy': { genre: 'Comedy' },
  'thriller': { genre: 'Thriller' },
  'highest-rated': { sort: 'highest' },
  'most-dramatic': { sort: 'swing' },
  'release-date': { sort: 'recent' },
};

export const LABEL_TO_KEY: Record<string, CategoryKey> = Object.fromEntries(
  (Object.entries(CATEGORY_LABELS) as [CategoryKey, string][]).map(
    ([key, label]) => [label, key],
  ),
) as Record<string, CategoryKey>;

export function isCategoryKey(value: string): value is CategoryKey {
  return value in CATEGORY_LABELS;
}
