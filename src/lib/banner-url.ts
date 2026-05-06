// Banner source resolver for the Profile banner and Header picker preview.
//
// Until PR 1a there was no resolver: ProfileBanner consumed a presetKey
// directly and assumed bannerType === 'GRADIENT'. PR 1b added BACKDROP
// (mobile prompt 2) and PHOTO (mobile prompt 3), so callers persist a
// (bannerType, bannerValue) pair and need a single place that turns that
// into something renderable.
//
// For BACKDROP, the user profile API does not include the resolved backdrop
// URL, so the caller (Profile screen, picker preview) must pass the film
// record (or at least its backdrop fields) once it has been fetched. If the
// film has not loaded yet, the resolver falls back to the default gradient,
// which is the correct momentary state while the backdrop fetch is in
// flight.
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

const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w780';

export type BannerSource =
  | { kind: 'gradient'; presetKey: BannerPresetKey }
  | { kind: 'backdrop'; uri: string }
  | { kind: 'photo'; uri: string };

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
