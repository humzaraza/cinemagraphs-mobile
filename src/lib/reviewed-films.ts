import { useSyncExternalStore } from 'react';
import type { Film } from '../types/film';

// Session-scoped optimistic record of films the user has reviewed.
// Bridges the gap between submitting a review and the next refetch of
// list payloads; server truth (userHasReviewed) wins once data reloads.

type FilmId = Film['id'];

const reviewedIds = new Set<FilmId>();
const listeners = new Set<() => void>();

export function markReviewed(id: FilmId): void {
  if (reviewedIds.has(id)) return;
  reviewedIds.add(id);
  listeners.forEach((listener) => listener());
}

export function isReviewed(id: FilmId): boolean {
  return reviewedIds.has(id);
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useIsReviewed(id: FilmId): boolean {
  return useSyncExternalStore(subscribe, () => isReviewed(id));
}
