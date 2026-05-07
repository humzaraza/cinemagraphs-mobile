// In-memory cache of TMDB backdrop responses, keyed by filmId. Lives at
// module scope so it persists across screens within a single banner-picker
// session: the user opens the picker, taps a film (push backdrop-picker,
// fetch backdrops), backs out, taps the same film again (cache hit, no
// refetch). The header-picker calls clearBackdropsCache() in its unmount
// cleanup so the cache lifetime is bounded by picker mount and we don't
// leak stale data between picker sessions.
//
// Module-level Map (vs React Context) because the backdrop-picker is a
// separate route in expo-router; there's no shared component tree we
// could hang a Context provider on without restructuring the layout.

import type { Backdrop } from './api';

const cache = new Map<string, Backdrop[]>();

export function getCachedBackdrops(filmId: string): Backdrop[] | null {
  return cache.get(filmId) ?? null;
}

export function setCachedBackdrops(filmId: string, backdrops: Backdrop[]): void {
  cache.set(filmId, backdrops);
}

export function clearBackdropsCache(): void {
  cache.clear();
}
