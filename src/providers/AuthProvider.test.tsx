import { describe, it, expect, vi, beforeEach } from 'vitest';
import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));

// In-memory AsyncStorage mock so the persisted has_seen_onboarding
// flag survives across signOut/signIn within a single test, which is
// what we need to assert that a returning user with completed
// onboarding skips the flow.
const asyncStore = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => asyncStore.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      asyncStore.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      asyncStore.delete(key);
    }),
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
  asyncStore.clear();
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

describe('AuthProvider.clearOnboarding', () => {
  it('returning user who completed onboarding (clearOnboarding called) signs in again with needsOnboarding=false', async () => {
    vi.mocked(loginWithEmail).mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'u1', email: 'u1@example.com', name: 'User One' },
    });

    const { state } = setup();
    await TestRenderer.act(async () => {});

    // First sign-in: brand-new user. handlePostAuth finds no
    // has_seen_onboarding flag, so needsOnboarding flips to true.
    await TestRenderer.act(async () => {
      await state().signIn('u1@example.com', 'pw');
    });
    expect(state().needsOnboarding).toBe(true);

    // Simulate the reveal screen's "Get Started" tap. This persists
    // the per-user-id completion flag and clears the in-memory
    // needsOnboarding state.
    await TestRenderer.act(async () => {
      await state().clearOnboarding();
    });
    expect(state().needsOnboarding).toBe(false);
    expect(asyncStore.get('has_seen_onboarding_u1')).toBe('true');

    // Sign out, then sign in again as the same returning user.
    await TestRenderer.act(async () => {
      await state().signOut();
    });
    await TestRenderer.act(async () => {
      await state().signIn('u1@example.com', 'pw');
    });

    // handlePostAuth reads the persisted flag, sees 'true', and does
    // NOT flip needsOnboarding back to true. This is what was broken
    // before clearOnboarding got wired into reveal.tsx.
    expect(state().isAuthenticated).toBe(true);
    expect(state().needsOnboarding).toBe(false);
  });
});
