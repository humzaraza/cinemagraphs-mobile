// Banner source resolver for the Profile banner and Header picker preview.
//
// Until PR 1a there was no resolver: ProfileBanner consumed a presetKey
// directly and assumed bannerType === 'GRADIENT'. PR 1b adds BACKDROP, so
// callers now persist a (bannerType, bannerValue) pair and need a single
// place that turns that into something renderable.
//
// PHOTO is intentionally not handled here yet; it lands in the next mobile
// prompt. The resolver currently treats PHOTO the same as a missing banner
// and returns the default gradient so the UI still has something to draw.
//
// For BACKDROP, the user profile API does not include the resolved backdrop
// URL, so the caller (Profile screen, picker preview) must pass the film
// record (or at least its backdrop fields) once it has been fetched. If the
// film has not loaded yet, the resolver falls back to the default gradient,
// which is the correct momentary state while the backdrop fetch is in
// flight.

import type { BannerType } from './api';
import {
  BANNER_DEFAULT_KEY,
  isBannerPresetKey,
  type BannerPresetKey,
} from '../constants/bannerPresets';

const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w780';

export type BannerSource =
  | { kind: 'gradient'; presetKey: BannerPresetKey }
  | { kind: 'backdrop'; uri: string };

// Minimal shape required to resolve a backdrop URI. Either a fully-built
// URL (backdropUrl, possibly already TMDB-prefixed) or a TMDB path
// (backdropPath, with or without leading slash) works.
export type BackdropInput =
  | { backdropUrl?: string | null; backdropPath?: string | null }
  | null
  | undefined;

// Build a renderable backdrop URI from a film-shaped record. Returns null
// when no backdrop is available (lets callers fall back gracefully).
export function resolveBackdropUri(input: BackdropInput): string | null {
  if (!input) return null;
  const path = input.backdropUrl || input.backdropPath;
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const sep = path.startsWith('/') ? '' : '/';
  return `${TMDB_BACKDROP_BASE}${sep}${path}`;
}

// Resolve the persisted (bannerType, bannerValue) pair into a discriminated
// source. The optional `film` is required for BACKDROP to read backdropUrl;
// without it, BACKDROP falls back to the default gradient so the UI never
// renders an empty frame.
export function resolveBannerSource(
  bannerType: BannerType,
  bannerValue: string,
  film?: BackdropInput,
): BannerSource {
  if (bannerType === 'BACKDROP') {
    const uri = resolveBackdropUri(film);
    if (uri) return { kind: 'backdrop', uri };
    return gradientFallback();
  }
  if (bannerType === 'GRADIENT') {
    const presetKey: BannerPresetKey = isBannerPresetKey(bannerValue)
      ? bannerValue
      : BANNER_DEFAULT_KEY;
    return { kind: 'gradient', presetKey };
  }
  // PHOTO and any future / unknown bannerType: gradient fallback. PHOTO
  // gets its own branch in the next mobile prompt.
  return gradientFallback();
}

function gradientFallback(): BannerSource {
  return { kind: 'gradient', presetKey: BANNER_DEFAULT_KEY };
}
