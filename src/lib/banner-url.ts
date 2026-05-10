// Banner source resolver for the Profile banner and Header picker preview.
//
// Until PR 1a there was no resolver: ProfileBanner consumed a presetKey
// directly and assumed bannerType === 'GRADIENT'. PR 1b added BACKDROP
// (mobile prompt 2) and PHOTO (mobile prompt 3), so callers persist a
// (bannerType, bannerValue) pair and need a single place that turns that
// into something renderable.
//
// PR 1c (web PR #29 + mobile companion) widened BACKDROP: bannerValue can
// now be a JSON-encoded { filmId, backdropPath } object instead of a
// plain filmId string. Mobile keeps reading both shapes:
//   - new shape: parsed via parseBackdropBannerValue, backdropPath used
//     to build a TMDB URL directly via getBackdropUrl(path, 'preview').
//   - legacy shape: plain filmId string, backdropPath treated as null,
//     falls back to film.backdropUrl on the Film record (existing PR 1b
//     behaviour). Migrated DB rows also fall through this path.
//
// The Profile screen still passes the film record to resolveBannerSource
// because the legacy / null-backdropPath path still needs it.
//
// For PHOTO, bannerValue is a Vercel Blob pathname (e.g.
// banners/<userId>/<random>.jpg). The full CDN URL has the form
// https://<storeId>.public.blob.vercel-storage.com/<pathname>, so the
// helper needs the store hostname. It reads it from
// EXPO_PUBLIC_VERCEL_BLOB_HOST at build time (Expo bakes EXPO_PUBLIC_*
// vars in). When bannerValue is already a fully-qualified URL we pass it
// through unchanged; this lets the picker render the just-uploaded URL
// returned by the upload step without waiting for a Profile refetch.

import type { BannerType } from './api';
import {
  BANNER_DEFAULT_KEY,
  isBannerPresetKey,
  type BannerPresetKey,
} from '../constants/bannerPresets';
import { getBackdropUrl } from './tmdb-image';

export type BannerSource =
  | { kind: 'gradient'; presetKey: BannerPresetKey }
  | { kind: 'backdrop'; uri: string }
  | { kind: 'photo'; uri: string };

// Minimal shape required to resolve a backdrop URI from a film record.
// Either a fully-built URL (backdropUrl, possibly already TMDB-prefixed)
// or a TMDB path (backdropPath, with or without leading slash) works.
export type BackdropInput =
  | { backdropUrl?: string | null; backdropPath?: string | null }
  | null
  | undefined;

export interface ParsedBackdropBannerValue {
  filmId: string;
  // null when the persisted row is in the legacy plain-filmId shape OR
  // when the user persisted a BACKDROP that pre-dates per-backdrop
  // selection (web PR #29 migration sets backdropPath=null for these).
  backdropPath: string | null;
}

// Parse a BACKDROP bannerValue into the structured shape, tolerating
// both the new JSON-encoded form ({"filmId":"...","backdropPath":"..."})
// and the legacy plain filmId string. Returns null for empty / null /
// undefined input; any other input resolves to a usable filmId (legacy
// fallback) so the caller doesn't need to special-case parse errors.
//
// filmId in the JSON shape may be a number (Prisma autoincrement IDs
// serialize as numbers) or a string. Both are coerced to string so
// callers building `/api/films/<id>` URLs always get a usable id.
export function parseBackdropBannerValue(
  bannerValue: string | null | undefined,
): ParsedBackdropBannerValue | null {
  if (!bannerValue || typeof bannerValue !== 'string') return null;
  try {
    const parsed = JSON.parse(bannerValue);
    if (
      parsed &&
      typeof parsed === 'object' &&
      (typeof parsed.filmId === 'string' || typeof parsed.filmId === 'number')
    ) {
      const backdropPath =
        typeof parsed.backdropPath === 'string' ? parsed.backdropPath : null;
      return { filmId: String(parsed.filmId), backdropPath };
    }
  } catch {
    // Fall through to legacy treatment.
  }
  // Legacy: bannerValue is the plain filmId string. backdropPath null
  // means "use the film's default backdropUrl from the Film record".
  return { filmId: bannerValue, backdropPath: null };
}

// Build a renderable backdrop URI from a film-shaped record. Returns null
// when no backdrop is available (lets callers fall back gracefully).
// Now routes through getBackdropUrl(_, 'preview') so the Profile banner
// uses w1280 (sharp on retina at typical screen widths) instead of the
// pre-PR-1c hardcoded w780.
export function resolveBackdropUri(input: BackdropInput): string | null {
  if (!input) return null;
  // Prefer backdropUrl (may already be a fully-qualified URL with a
  // baked-in size) over backdropPath. getBackdropUrl handles all three
  // input shapes uniformly: plain path, TMDB-prefixed URL, or non-TMDB
  // full URL.
  const path = input.backdropUrl || input.backdropPath;
  return getBackdropUrl(path, 'preview');
}

// Build a Vercel Blob CDN URL from a stored pathname. Returns null when
// the pathname is missing or the store host env var is not configured at
// build time (in which case the resolver falls back to gradient so the UI
// never renders broken). A fully-qualified URL is passed through unchanged
// so the picker can render the immediate post-upload response.
export function resolvePhotoUri(bannerValue: string): string | null {
  if (!bannerValue) return null;
  if (bannerValue.startsWith('http://') || bannerValue.startsWith('https://')) {
    return bannerValue;
  }
  const host = process.env.EXPO_PUBLIC_VERCEL_BLOB_HOST;
  if (!host) return null;
  const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const cleanPath = bannerValue.replace(/^\/+/, '');
  return `https://${cleanHost}/${cleanPath}`;
}

// Resolve the persisted (bannerType, bannerValue) pair into a discriminated
// source. The optional `film` is required for BACKDROP when the persisted
// shape doesn't include a backdropPath (legacy rows + migrated rows with
// null path fall back to film.backdropUrl).
export function resolveBannerSource(
  bannerType: BannerType,
  bannerValue: string,
  film?: BackdropInput,
): BannerSource {
  if (bannerType === 'BACKDROP') {
    const parsed = parseBackdropBannerValue(bannerValue);
    // Prefer the backdropPath baked into the persisted bannerValue
    // (PR 1c new shape). Build the URL directly from the path; no film
    // record needed.
    if (parsed?.backdropPath) {
      const uri = getBackdropUrl(parsed.backdropPath, 'preview');
      if (uri) return { kind: 'backdrop', uri };
    }
    // Legacy shape (plain filmId) or new shape with null backdropPath:
    // fall back to the film record's default backdrop. Profile fetches
    // and passes the film whenever bannerType is BACKDROP.
    const uri = resolveBackdropUri(film);
    if (uri) return { kind: 'backdrop', uri };
    return gradientFallback();
  }
  if (bannerType === 'PHOTO') {
    const uri = resolvePhotoUri(bannerValue);
    if (uri) return { kind: 'photo', uri };
    return gradientFallback();
  }
  if (bannerType === 'GRADIENT') {
    const presetKey: BannerPresetKey = isBannerPresetKey(bannerValue)
      ? bannerValue
      : BANNER_DEFAULT_KEY;
    return { kind: 'gradient', presetKey };
  }
  // Any future / unknown bannerType: gradient fallback.
  return gradientFallback();
}

function gradientFallback(): BannerSource {
  return { kind: 'gradient', presetKey: BANNER_DEFAULT_KEY };
}
