import { describe, it, expect, vi, beforeEach } from 'vitest';
import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';

// Capture AppState listeners so tests can simulate foreground/background
// transitions by invoking them directly.
type AppStateListener = (state: string) => void;
const appStateListeners: AppStateListener[] = [];
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: vi.fn((_type: string, listener: AppStateListener) => {
      appStateListeners.push(listener);
      return {
        remove: vi.fn(() => {
          const idx = appStateListeners.indexOf(listener);
          if (idx !== -1) appStateListeners.splice(idx, 1);
        }),
      };
    }),
  },
}));

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
  refreshIfExpiringSoon: vi.fn(async () => null),
  deleteAccount: vi.fn(async () => undefined),
  apiFetch: vi.fn(),
}));

vi.mock('../lib/onboarding-persistence', () => ({
  consumePendingBanner: vi.fn(async () => undefined),
}));

vi.mock('../lib/events', () => ({
  trackEvent: vi.fn(),
  EVENTS: { SIGNUP_COMPLETE: 'signup_complete' },
}));

vi.mock('../lib/blind-mode', () => ({
  clearBlindModeCache: vi.fn(),
}));

import {
  loginWithEmail,
  getAccessToken,
  apiFetch,
  setOnAuthFailure,
  requestServerLogout,
  refreshIfExpiringSoon,
  removeTokens,
  deleteAccount as deleteAccountApi,
} from '../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { clearBlindModeCache } from '../lib/blind-mode';
// Real module (not mocked): the sign-in test asserts actual cache state.
import * as payloadCache from '../lib/payload-cache';
import AuthProvider, { useAuth } from './AuthProvider';

const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

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
  appStateListeners.length = 0;
  payloadCache.clearPayloadCache();
  // clearAllMocks wipes the default implementation set in the factory.
  vi.mocked(refreshIfExpiringSoon).mockResolvedValue(null);
});

// Simulate an AppState transition by invoking every registered listener.
async function fireAppState(nextState: string) {
  await TestRenderer.act(async () => {
    for (const listener of [...appStateListeners]) listener(nextState);
  });
  await flushPromises();
}

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

  it('drops the in-memory blind-mode cache so the next user does not inherit the previous user’s perFilm overrides', async () => {
    // Cross-account leak fix: clearBlindModeCache is a module-level
    // function (not React state), so a stale cached state would
    // otherwise survive sign-out and be returned to the next user
    // who lands on a film detail screen before the next /user/blind-mode
    // fetch resolves.
    vi.mocked(loginWithEmail).mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'u1', email: 'u1@example.com', name: 'User One' },
    });

    const { state } = setup();
    await TestRenderer.act(async () => {});
    await TestRenderer.act(async () => {
      await state().signIn('u1@example.com', 'pw');
    });

    vi.mocked(clearBlindModeCache).mockClear();

    await TestRenderer.act(async () => {
      await state().signOut();
    });

    expect(vi.mocked(clearBlindModeCache)).toHaveBeenCalledTimes(1);
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

describe('AuthProvider mount restore', () => {
  it('stores the rotated access token when apiFetch refreshes during /user/profile (stale-token bug fold)', async () => {
    // Before the fix, mount restore wrote the pre-apiFetch token snapshot
    // into state, leaving the rotated token in storage but a stale token
    // in memory. After the fix, the success branch re-reads via
    // getAccessToken() before writing to setTokenState.
    vi.mocked(getAccessToken)
      .mockResolvedValueOnce('old-token')
      .mockResolvedValueOnce('new-token');
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        user: { id: 'u1', email: 'u1@example.com', name: 'User One' },
      }),
    } as unknown as Response);

    const { state } = setup();
    await TestRenderer.act(async () => {});
    await flushPromises();

    expect(state().isAuthenticated).toBe(true);
    expect(state().token).toBe('new-token');
    expect(state().user?.id).toBe('u1');
  });
});

describe('AuthProvider auth-failure handler', () => {
  it('invoking the registered handler clears user, token, and onboarding state (apiFetch 401 + refresh failure path)', async () => {
    vi.mocked(loginWithEmail).mockResolvedValueOnce({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'u1', email: 'u1@example.com', name: 'User One' },
    });

    const { state } = setup();
    await TestRenderer.act(async () => {});
    await flushPromises();
    await TestRenderer.act(async () => {
      await state().signIn('u1@example.com', 'pw');
    });
    await flushPromises();
    expect(state().isAuthenticated).toBe(true);
    expect(state().needsOnboarding).toBe(true);

    // Grab the handler the provider registered with apiFetch and invoke
    // it directly, which is what apiFetch does internally when a 401 +
    // refresh attempt both fail.
    const handler = vi.mocked(setOnAuthFailure).mock.calls.at(-1)?.[0];
    expect(typeof handler).toBe('function');

    await TestRenderer.act(async () => {
      await handler!();
    });
    await flushPromises();

    expect(state().user).toBeNull();
    expect(state().token).toBeNull();
    expect(state().isAuthenticated).toBe(false);
    expect(state().needsOnboarding).toBe(false);
  });
});

describe('AuthProvider.refreshUser', () => {
  it('pulls the latest user from /user/profile, updates context state, and writes the SecureStore cache', async () => {
    vi.mocked(loginWithEmail).mockResolvedValueOnce({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'u1', email: 'u1@example.com', name: 'User One' },
    });

    const { state } = setup();
    await TestRenderer.act(async () => {});
    await flushPromises();
    await TestRenderer.act(async () => {
      await state().signIn('u1@example.com', 'pw');
    });
    await flushPromises();
    expect(state().user?.name).toBe('User One');

    const updatedUser = {
      id: 'u1',
      email: 'u1@example.com',
      name: 'User One Updated',
    };
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ user: updatedUser }),
    } as unknown as Response);

    await TestRenderer.act(async () => {
      await state().refreshUser();
    });
    await flushPromises();

    expect(state().user).toEqual(updatedUser);
    expect(vi.mocked(SecureStore.setItemAsync)).toHaveBeenCalledWith(
      'auth_user',
      JSON.stringify(updatedUser),
    );
  });

  it('network error during refreshUser leaves context state unchanged', async () => {
    vi.mocked(loginWithEmail).mockResolvedValueOnce({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'u1', email: 'u1@example.com', name: 'User One' },
    });

    const { state } = setup();
    await TestRenderer.act(async () => {});
    await flushPromises();
    await TestRenderer.act(async () => {
      await state().signIn('u1@example.com', 'pw');
    });
    await flushPromises();
    const beforeUser = state().user;
    expect(beforeUser).not.toBeNull();

    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('network down'));

    // Should not throw despite apiFetch rejecting.
    await TestRenderer.act(async () => {
      await state().refreshUser();
    });
    await flushPromises();

    expect(state().user).toEqual(beforeUser);
    expect(state().isAuthenticated).toBe(true);
  });
});

describe('AuthProvider.deleteAccount', () => {
  // Shared helper: sign in as user u1 so the provider has an
  // authenticated state to tear down. Mirrors the signOut test's setup.
  async function signInAsU1(state: () => AuthState) {
    vi.mocked(loginWithEmail).mockResolvedValueOnce({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'u1', email: 'u1@example.com', name: 'User One' },
    });
    await TestRenderer.act(async () => {});
    await flushPromises();
    await TestRenderer.act(async () => {
      await state().signIn('u1@example.com', 'pw');
    });
    await flushPromises();
  }

  it('happy path: calls the api deleteAccount exactly once', async () => {
    vi.mocked(deleteAccountApi).mockResolvedValueOnce(undefined);

    const { state } = setup();
    await signInAsU1(state);
    expect(state().isAuthenticated).toBe(true);

    await TestRenderer.act(async () => {
      await state().deleteAccount();
    });

    expect(vi.mocked(deleteAccountApi)).toHaveBeenCalledTimes(1);
  });

  it('happy path: clears user and token so isAuthenticated flips to false', async () => {
    vi.mocked(deleteAccountApi).mockResolvedValueOnce(undefined);

    const { state } = setup();
    await signInAsU1(state);
    expect(state().isAuthenticated).toBe(true);
    expect(state().user).not.toBeNull();

    await TestRenderer.act(async () => {
      await state().deleteAccount();
    });

    expect(state().user).toBeNull();
    expect(state().token).toBeNull();
    expect(state().isAuthenticated).toBe(false);
  });

  it('happy path: removes the per-user has_seen_onboarding flag from AsyncStorage', async () => {
    vi.mocked(deleteAccountApi).mockResolvedValueOnce(undefined);

    const { state } = setup();
    await signInAsU1(state);

    await TestRenderer.act(async () => {
      await state().deleteAccount();
    });

    expect(vi.mocked(AsyncStorage.removeItem)).toHaveBeenCalledWith(
      'has_seen_onboarding_u1',
    );
  });

  it('happy path: does NOT call requestServerLogout (server cascade already revoked the family)', async () => {
    vi.mocked(deleteAccountApi).mockResolvedValueOnce(undefined);

    const { state } = setup();
    await signInAsU1(state);

    await TestRenderer.act(async () => {
      await state().deleteAccount();
    });

    expect(vi.mocked(requestServerLogout)).not.toHaveBeenCalled();
  });

  it('failure path: api rejection propagates, local state stays authenticated, local cleanup did not run', async () => {
    vi.mocked(deleteAccountApi).mockRejectedValueOnce(
      new Error('Failed to delete account'),
    );

    const { state } = setup();
    await signInAsU1(state);
    const beforeUser = state().user;
    expect(beforeUser).not.toBeNull();

    // removeTokens (called by clearAuth) was already invoked once during
    // the mount-time clearAuth fallback, but signInAsU1 resets nothing,
    // so capture the count and assert no NEW calls land after the failed
    // delete.
    const removeTokensCountBefore = vi.mocked(removeTokens).mock.calls.length;
    const removeItemCountBefore = vi.mocked(AsyncStorage.removeItem).mock.calls
      .length;

    await TestRenderer.act(async () => {
      await expect(state().deleteAccount()).rejects.toThrow(
        'Failed to delete account',
      );
    });

    expect(state().user).toEqual(beforeUser);
    expect(state().isAuthenticated).toBe(true);
    expect(vi.mocked(removeTokens).mock.calls.length).toBe(
      removeTokensCountBefore,
    );
    expect(vi.mocked(AsyncStorage.removeItem).mock.calls.length).toBe(
      removeItemCountBefore,
    );
  });

  it('AsyncStorage failure resilience: removeItem rejection does not block local cleanup or surface as an error', async () => {
    vi.mocked(deleteAccountApi).mockResolvedValueOnce(undefined);
    vi.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(
      new Error('AsyncStorage offline'),
    );

    const { state } = setup();
    await signInAsU1(state);
    expect(state().isAuthenticated).toBe(true);

    // Must not throw despite the AsyncStorage rejection.
    await TestRenderer.act(async () => {
      await state().deleteAccount();
    });

    expect(state().user).toBeNull();
    expect(state().token).toBeNull();
    expect(state().isAuthenticated).toBe(false);
  });
});

describe('AuthProvider foreground token refresh', () => {
  async function signInAsU1(state: () => AuthState) {
    vi.mocked(loginWithEmail).mockResolvedValueOnce({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'u1', email: 'u1@example.com', name: 'User One' },
    });
    await TestRenderer.act(async () => {});
    await flushPromises();
    await TestRenderer.act(async () => {
      await state().signIn('u1@example.com', 'pw');
    });
    await flushPromises();
  }

  it('foregrounding with an expired token refreshes: the check runs and the rotated token lands in state', async () => {
    // refreshIfExpiringSoon models the expired-token case by returning a
    // rotated pair (its internal expired/valid discrimination is covered
    // by the api.ts tests).
    vi.mocked(refreshIfExpiringSoon).mockResolvedValue({
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token',
    });

    const { state } = setup();
    await signInAsU1(state);
    expect(state().token).toBe('access-token');

    await fireAppState('active');

    expect(vi.mocked(refreshIfExpiringSoon)).toHaveBeenCalledTimes(1);
    expect(state().token).toBe('rotated-access-token');
    expect(state().isAuthenticated).toBe(true);
  });

  it('foregrounding with a valid token does not rotate: the helper resolves null and state is untouched', async () => {
    vi.mocked(refreshIfExpiringSoon).mockResolvedValue(null);

    const { state } = setup();
    await signInAsU1(state);

    await fireAppState('active');

    expect(vi.mocked(refreshIfExpiringSoon)).toHaveBeenCalledTimes(1);
    expect(state().token).toBe('access-token');
  });

  it('only fires on the transition to active, not background/inactive', async () => {
    const { state } = setup();
    await signInAsU1(state);

    await fireAppState('background');
    await fireAppState('inactive');

    expect(vi.mocked(refreshIfExpiringSoon)).not.toHaveBeenCalled();
  });

  it('does not re-run the full restore on foreground (no /user/profile fetch)', async () => {
    const { state } = setup();
    await signInAsU1(state);
    const apiFetchCallsBefore = vi.mocked(apiFetch).mock.calls.length;

    await fireAppState('active');

    expect(vi.mocked(apiFetch).mock.calls.length).toBe(apiFetchCallsBefore);
  });

  it('a rejected refresh is swallowed and leaves auth state intact', async () => {
    vi.mocked(refreshIfExpiringSoon).mockRejectedValue(
      new Error('network down'),
    );

    const { state } = setup();
    await signInAsU1(state);

    await fireAppState('active');

    expect(state().token).toBe('access-token');
    expect(state().isAuthenticated).toBe(true);
  });
});

describe('AuthProvider sign-in cache clearing', () => {
  it('signIn clears the payload cache so guest-browsing payloads do not survive into the session', async () => {
    // Simulate payloads cached while browsing signed out: the anonymous
    // variant of viewer-personalized data plus a neutral category page.
    payloadCache.set('film:1', { id: '1', userReview: null });
    payloadCache.set('reviews:1:ex', { reviews: [] });
    payloadCache.set('category:drama', { films: [] });

    vi.mocked(loginWithEmail).mockResolvedValueOnce({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'u1', email: 'u1@example.com', name: 'User One' },
    });

    const { state } = setup();
    await TestRenderer.act(async () => {});
    await TestRenderer.act(async () => {
      await state().signIn('u1@example.com', 'pw');
    });

    // handlePostAuth clears EVERYTHING (unlike token rotation, this is a
    // session boundary, same as sign-out).
    expect(payloadCache.get('film:1')).toBeUndefined();
    expect(payloadCache.get('reviews:1:ex')).toBeUndefined();
    expect(payloadCache.get('category:drama')).toBeUndefined();
    expect(state().isAuthenticated).toBe(true);
  });
});
