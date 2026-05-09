import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from './api';
import { trackEvent, EVENTS } from './events';

describe('trackEvent', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 200 }));
  });

  it('POSTs to /events with method POST', () => {
    trackEvent(EVENTS.SIGNUP_COMPLETE);
    expect(apiFetch).toHaveBeenCalledTimes(1);
    const [path, init] = vi.mocked(apiFetch).mock.calls[0];
    expect(path).toBe('/events');
    expect(init?.method).toBe('POST');
  });

  it('encodes the event name and a numeric timestamp in the body', () => {
    const before = Date.now();
    trackEvent(EVENTS.REVEAL_COMPLETE);
    const after = Date.now();
    const init = vi.mocked(apiFetch).mock.calls[0][1];
    const body = JSON.parse(init?.body as string);
    expect(body.event).toBe('reveal_complete');
    expect(typeof body.timestamp).toBe('number');
    expect(body.timestamp).toBeGreaterThanOrEqual(before);
    expect(body.timestamp).toBeLessThanOrEqual(after);
  });

  it('passes properties through when provided', () => {
    trackEvent(EVENTS.ONBOARDING_STEP_VIEW, { screen: 'eras' });
    const init = vi.mocked(apiFetch).mock.calls[0][1];
    const body = JSON.parse(init?.body as string);
    expect(body.properties).toEqual({ screen: 'eras' });
  });

  it('defaults properties to {} when not provided', () => {
    trackEvent(EVENTS.SIGNUP_COMPLETE);
    const init = vi.mocked(apiFetch).mock.calls[0][1];
    const body = JSON.parse(init?.body as string);
    expect(body.properties).toEqual({});
  });

  it('does not throw or reject when apiFetch rejects', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('network down'));

    expect(() => trackEvent(EVENTS.SIGNUP_COMPLETE)).not.toThrow();
    // Yield to the microtask queue so the rejected fetch's .catch runs.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
});
