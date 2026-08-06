import { useSyncExternalStore } from 'react';

// Session-scoped unread flag for the Activity tab's dot. Seeded from
// GET /api/activity/unread when the tab bar mounts; cleared when the
// Activity screen successfully POSTs /api/activity/seen. Same
// module-level store pattern as reviewed-films.ts: no provider, any
// component reads it via useUnreadActivity.

let unread = false;
const listeners = new Set<() => void>();

export function setUnreadActivity(value: boolean): void {
  if (unread === value) return;
  unread = value;
  listeners.forEach((listener) => listener());
}

export function getUnreadActivity(): boolean {
  return unread;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useUnreadActivity(): boolean {
  return useSyncExternalStore(subscribe, getUnreadActivity);
}
