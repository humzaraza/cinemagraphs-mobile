import { apiFetch } from './api';

/**
 * Funnel event names. Adding a new event means adding it here first,
 * then importing the constant at the call site. This prevents typos
 * in event names from creating phantom events in the logs.
 */
export const EVENTS = {
  SIGNUP_COMPLETE: 'signup_complete',
  ONBOARDING_STEP_VIEW: 'onboarding_step_view',
  ONBOARDING_SKIP: 'onboarding_skip',
  REVEAL_COMPLETE: 'reveal_complete',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export interface EventProperties {
  [key: string]: string | number | boolean;
}

/**
 * Fire-and-forget event tracking. POSTs to /api/events with the event
 * name, properties, and current timestamp. Errors are silently
 * swallowed; tracking failures never block UX.
 *
 * Auth header is attached automatically when a session exists (via
 * apiFetch). Anonymous calls (pre-signup) land server-side with
 * userId: null.
 *
 * Property values are limited to string/number/boolean. Other types
 * (null, objects, arrays) are dropped silently by the server. Match
 * those constraints client-side to avoid sending payloads that get
 * partially discarded.
 */
export function trackEvent(event: EventName, properties?: EventProperties): void {
  apiFetch('/events', {
    method: 'POST',
    body: JSON.stringify({
      event,
      properties: properties ?? {},
      timestamp: Date.now(),
    }),
  }).catch(() => {
    // Silently swallow. Tracking is best-effort.
  });
}
