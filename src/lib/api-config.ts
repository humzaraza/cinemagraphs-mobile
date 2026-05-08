// Origin for the cinemagraphs.ca API. Override via EXPO_PUBLIC_API_BASE_URL
// at build time (e.g., to point at a staging environment). The existing
// src/lib/api.ts hardcodes the same origin and could migrate to this module
// in a follow-up; new modules should consume API_BASE_URL from here.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://cinemagraphs.ca';
