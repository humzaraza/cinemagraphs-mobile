import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loginWithEmail,
  registerWithEmail,
  verifyOTP,
  loginWithGoogle,
  loginWithApple,
  getAccessToken,
  getRefreshToken,
  setTokens,
  removeTokens,
  cleanupLegacyTokenKey,
  setOnAuthFailure,
  requestServerLogout,
  deleteAccount as deleteAccountApi,
  apiFetch,
  type AuthUser,
  type AuthResponse,
} from '../lib/api';
import { consumePendingBanner } from '../lib/onboarding-persistence';
import { trackEvent, EVENTS } from '../lib/events';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface AuthContextValue {
  user: AuthUser | null;
  refreshUser: () => Promise<void>;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  clearOnboarding: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signInWithApple: (identityToken: string, fullName?: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  refreshUser: async () => {},
  token: null,
  isLoading: true,
  isAuthenticated: false,
  needsOnboarding: false,
  clearOnboarding: () => {},
  signIn: async () => {},
  signUp: async () => {},
  verifyOtp: async () => {},
  signOut: async () => {},
  deleteAccount: async () => {},
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// ---------------------------------------------------------------------------
// SecureStore helpers
// ---------------------------------------------------------------------------

async function storeAuth(data: AuthResponse) {
  if (!data.accessToken || typeof data.accessToken !== 'string') {
    throw new Error('Auth response missing accessToken');
  }
  if (!data.refreshToken || typeof data.refreshToken !== 'string') {
    throw new Error('Auth response missing refreshToken');
  }
  await setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  await SecureStore.setItemAsync('auth_user', JSON.stringify(data.user ?? {}));
}

async function clearAuth() {
  await removeTokens();
  await SecureStore.deleteItemAsync('auth_user');
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // --- Restore session on mount (runs exactly once) ---
  const didRestore = useRef(false);
  useEffect(() => {
    if (didRestore.current) return;
    didRestore.current = true;
    (async () => {
      // Clean up the pre-PR-3b 'auth_token' key if it exists. Idempotent.
      await cleanupLegacyTokenKey();

      try {
        const stored = await getAccessToken();
        if (!stored) return;

        const res = await apiFetch('/user/profile');
        if (res.ok) {
          const profile = await res.json();
          const restoredUser = profile.user ?? profile;
          // Re-read after apiFetch; refresh may have rotated the token during the call.
          const fresh = await getAccessToken();
          setUser(restoredUser);
          setTokenState(fresh);
        } else if (res.status === 401 || res.status === 403 || res.status === 404) {
          // Token invalid or user deleted - sign out
          if (__DEV__) {
            console.error('[Auth] Token rejected on mount, status:', res.status);
          }
          await clearAuth();
        } else {
          // Other error (500, network hiccup) - try cached user as offline fallback
          const cached = await SecureStore.getItemAsync('auth_user');
          if (cached) {
            // Re-read after apiFetch; refresh may have rotated the token during the call.
            const fresh = await getAccessToken();
            setUser(JSON.parse(cached));
            setTokenState(fresh);
          } else {
            await clearAuth();
          }
        }
      } catch {
        // Network error, fall back to cached user
        const stored = await getAccessToken();
        const cached = await SecureStore.getItemAsync('auth_user');
        if (stored && cached) {
          setUser(JSON.parse(cached));
          setTokenState(stored);
        } else {
          await clearAuth();
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // --- Register the auth-failure handler with apiFetch ---
  // apiFetch invokes this when a 401 + refresh attempt both fail. The
  // handler does local-only cleanup; apiFetch already proved the
  // refresh is dead, so calling the server again would just recurse.
  useEffect(() => {
    setOnAuthFailure(async () => {
      await clearAuth();
      setUser(null);
      setTokenState(null);
      setNeedsOnboarding(false);
    });
    return () => setOnAuthFailure(null);
  }, []);

  // --- Internal: store auth result and check onboarding ---
  const handlePostAuth = useCallback(async (data: AuthResponse) => {
    // 1. Store token to SecureStore
    await storeAuth(data);

    // 2. Check onboarding BEFORE setting user/token (which trigger navigation)
    const userId = data.user?.id ?? data.user?.email;
    if (__DEV__) {
      console.log('[Auth] handlePostAuth called, userId:', userId);
    }
    if (userId) {
      const key = `has_seen_onboarding_${userId}`;
      const seen = await AsyncStorage.getItem(key);
      if (__DEV__) {
        console.log('[Auth] has_seen_onboarding key:', key);
        console.log('[Auth] has_seen_onboarding value:', seen);
        console.log('[Auth] setting needsOnboarding to:', seen !== 'true');
      }
      if (seen !== 'true') {
        setNeedsOnboarding(true);
      }
    } else {
      console.warn('[Auth] handlePostAuth: no userId found on data.user, keys:', Object.keys(data.user ?? {}));
    }

    // 3. Set user and token last so isAuthenticated flips after needsOnboarding is ready
    setUser(data.user);
    setTokenState(data.accessToken);

    // 4. Consume pendingBanner if user is still on defaults. Runs after
    //    setUser/setTokenState so any concurrent UI render shows the user
    //    as authenticated immediately; banner application is async and
    //    updates the server record but doesn't block sign-in completion.
    await consumePendingBanner();
  }, []);

  // --- Public auth methods (no navigation, state only) ---

  const signIn = useCallback(async (email: string, password: string) => {
    if (__DEV__) {
      console.log('[Auth] signIn function called');
    }
    const data = await loginWithEmail(email, password);
    if (__DEV__) {
      console.log('[Auth] signIn API response received, user:', data.user?.id ?? data.user?.email);
    }
    await handlePostAuth(data);
  }, [handlePostAuth]);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    await registerWithEmail(email, password, name);
    // Backend sends OTP. Caller navigates to OTP screen.
  }, []);

  const verifyOtp = useCallback(async (email: string, code: string) => {
    const data = await verifyOTP(email, code);
    await handlePostAuth(data);
    trackEvent(EVENTS.SIGNUP_COMPLETE, { method: 'email' });
  }, [handlePostAuth]);

  const signOut = useCallback(async () => {
    // Snapshot the refresh token BEFORE clearing local state. We need
    // it for the server-side family revocation call that follows.
    let refreshTokenSnapshot: string | null = null;
    try {
      refreshTokenSnapshot = await getRefreshToken();
    } catch {
      // Continue without it; local cleanup runs regardless.
    }

    // Clear local state immediately. User-perceived sign-out is instant
    // and does not depend on the network.
    await clearAuth();
    setUser(null);
    setTokenState(null);
    setNeedsOnboarding(false);

    // Fire-and-forget server-side revocation. Background network call
    // with 2s abort timeout. Local sign-out has already happened.
    if (refreshTokenSnapshot) {
      requestServerLogout(refreshTokenSnapshot);
    }
  }, []);

  // Permanently delete the authenticated account. Mirrors signOut's
  // local-cleanup ordering, with two differences: it awaits the server
  // delete BEFORE wiping local state (so a server failure leaves the
  // user signed in to retry), and it skips requestServerLogout because
  // the server cascade-deletes the refresh-token family. Also nukes the
  // per-user onboarding flag so a re-signup with a recycled email gets
  // the first-run experience again.
  const deleteAccount = useCallback(async () => {
    const currentUserId = user?.id;

    // Throws on failure; caller (modal) handles the error UI. Local
    // state is untouched if this throws, so the user can retry.
    await deleteAccountApi();

    // Best-effort onboarding-flag cleanup. AsyncStorage failures here
    // are cosmetic (worst case: returning user skips onboarding) and
    // must not block the rest of the sign-out cleanup.
    if (currentUserId) {
      try {
        await AsyncStorage.removeItem(`has_seen_onboarding_${currentUserId}`);
      } catch {
        // Best-effort.
      }
    }

    // Same local cleanup as signOut. No requestServerLogout: the server
    // has already invalidated the refresh-token family as part of the
    // account-delete cascade.
    await clearAuth();
    setUser(null);
    setTokenState(null);
    setNeedsOnboarding(false);
  }, [user?.id]);

  const signInWithGoogleFn = useCallback(async (idToken: string) => {
    const data = await loginWithGoogle(idToken);
    await handlePostAuth(data);
  }, [handlePostAuth]);

  const signInWithAppleFn = useCallback(async (identityToken: string, fullName?: string | null) => {
    const data = await loginWithApple(identityToken, fullName);
    await handlePostAuth(data);
  }, [handlePostAuth]);

  const clearOnboarding = useCallback(async () => {
    setNeedsOnboarding(false);
    const userId = user?.id ?? user?.email;
    if (userId) {
      await AsyncStorage.setItem(`has_seen_onboarding_${userId}`, 'true');
    }
  }, [user]);

  // Pull the latest user record from the server and sync both in-memory
  // state and the SecureStore cache. Replaces the prior pattern of
  // consumers calling setUser() directly from context, which leaked
  // mutability and let callers desync the cache.
  const refreshUser = useCallback(async () => {
    try {
      const res = await apiFetch('/user/profile');
      if (!res.ok) return;
      const profile = await res.json();
      const refreshed = profile.user ?? profile;
      setUser(refreshed);
      await SecureStore.setItemAsync('auth_user', JSON.stringify(refreshed));
    } catch {
      // Network errors leave state unchanged; caller may retry.
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        refreshUser,
        token,
        isLoading,
        isAuthenticated: !!token,
        needsOnboarding,
        clearOnboarding,
        signIn,
        signUp,
        verifyOtp,
        signOut,
        deleteAccount,
        signInWithGoogle: signInWithGoogleFn,
        signInWithApple: signInWithAppleFn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
