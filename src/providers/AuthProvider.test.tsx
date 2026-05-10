import { describe, it, expect, vi, beforeEach } from 'vitest';
import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

vi.mock('../lib/api', () => ({
  loginWithEmail: vi.fn(),
  registerWithEmail: vi.fn(),
  verifyOTP: vi.fn(),
  loginWithGoogle: vi.fn(),
  loginWithApple: vi.fn(),
  getAccessToken: vi.fn(async () => null),
  getRefreshToken: vi.fn(async () => 'refresh-token-snapshot'),
  setTokens: vi.fn(async () => undefined),
  removeTokens: vi.fn(async () => undefined),
  cleanupLegacyTokenKey: vi.fn(async () => undefined),
  setOnAuthFailure: vi.fn(),
  requestServerLogout: vi.fn(),
  apiFetch: vi.fn(),
}));

vi.mock('../lib/onboarding-persistence', () => ({
  consumePendingBanner: vi.fn(async () => undefined),
}));

vi.mock('../lib/events', () => ({
  trackEvent: vi.fn(),
  EVENTS: { SIGNUP_COMPLETE: 'signup_complete' },
}));

import { loginWithEmail } from '../lib/api';
import AuthProvider, { useAuth } from './AuthProvider';

type AuthState = ReturnType<typeof useAuth>;

function setup() {
  let captured: AuthState | undefined;
  function Capture() {
    captured = useAuth();
    return null;
  }
  let tree: ReactTestRenderer | undefined;
  TestRenderer.act(() => {
    tree = TestRenderer.create(
      <AuthProvider>
        <Capture />
      </AuthProvider>,
    );
  });
  if (!tree || !captured) throw new Error('renderer never assigned');
  return { state: () => captured as AuthState };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuthProvider.signOut', () => {
  it('awaiting signOut() leaves auth state fully cleared, so a caller that navigates after the await sees isAuthenticated=false and needsOnboarding=false', async () => {
    vi.mocked(loginWithEmail).mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'u1', email: 'u1@example.com', name: 'User One' },
    });

    const { state } = setup();

    // Let the mount-time restore effect resolve (no stored session).
    await TestRenderer.act(async () => {});

    // Establish authenticated state via the public API. New user (no
    // stored has_seen_onboarding flag) so needsOnboarding becomes true.
    await TestRenderer.act(async () => {
      await state().signIn('u1@example.com', 'pw');
    });
    expect(state().isAuthenticated).toBe(true);
    expect(state().needsOnboarding).toBe(true);

    // Sign out and assert the cleared state is observable to a caller
    // that awaits the promise. This is the invariant the settings
    // sign-out handler now relies on: navigation runs after the await,
    // so the index route guard sees fresh state and redirects to
    // Landing instead of /onboarding.
    await TestRenderer.act(async () => {
      await state().signOut();
    });
    expect(state().user).toBeNull();
    expect(state().token).toBeNull();
    expect(state().isAuthenticated).toBe(false);
    expect(state().needsOnboarding).toBe(false);
  });
});
