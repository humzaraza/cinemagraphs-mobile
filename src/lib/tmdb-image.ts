// Centralized TMDB poster URL builder. Picks the right source size
// based on render context to avoid upscaling small sources into
// large containers (causes visible fuzziness on retina) or
// downloading large sources into tiny containers (wastes data).
//
// Size guide:
// - thumbnail (w185): containers under ~60pt wide. Tiny inline
//   poster chips, trending row thumbnails, list preview strips,
//   review form headers, picker rows, small review-row posters.
// - card (w342): 60-130pt wide containers. Search results,
//   explore poster cards, profile recently-viewed strip, film
//   detail metadata poster, similar film cards, ArcCard
//   thumbnails.
// - grid (w500): multi-column 3-col poster grids at ~117pt wide.
//   Category screen, profile My Films, profile Watchlist, list
//   detail poster grid.
// - hero (original): full-bleed detail screens. Reserved for
//   future full-bleed designs not currently in use. No callers
//   today, kept for forward compatibility.

const TMDB_BASE = 'https://image.tmdb.org/t/p'

// Matches the prefix of a baked-in TMDB image URL up to and including the
// size segment, e.g. 'https://image.tmdb.org/t/p/w185/'. Used to swap the
// size segment to whatever the caller's context requires.
const TMDB_PREFIX_RE = /^https:\/\/image\.tmdb\.org\/t\/p\/[^/]+\//

const SIZE_MAP = {
  thumbnail: 'w185',
  card: 'w342',
  grid: 'w500',
  hero: 'original',
} as const

export type PosterContext = keyof typeof SIZE_MAP

type FilmWithPoster = {
  posterUrl?: string | null
  posterPath?: string | null
}

export function getPosterUrl(
  film: FilmWithPoster | null | undefined,
  context: PosterContext,
): string | null {
  if (!film) return null
  const path = film.posterUrl || film.posterPath
  if (!path) return null
  // Pre-built TMDB image URL with a baked-in size segment (some mocks and
  // API responses ship w185 URLs). Rewrite the size segment so the caller's
  // context controls the source resolution instead of always rendering at
  // whatever size the URL was pre-baked with.
  if (TMDB_PREFIX_RE.test(path)) {
    return path.replace(TMDB_PREFIX_RE, `${TMDB_BASE}/${SIZE_MAP[context]}/`)
  }
  // Non-TMDB full URL (user-uploaded avatar, external service, etc.)
  if (path.startsWith('http')) return path
  // Plain TMDB path stored without prefix; guard against missing leading slash.
  const sep = path.startsWith('/') ? '' : '/'
  return `${TMDB_BASE}/${SIZE_MAP[context]}${sep}${path}`
}
