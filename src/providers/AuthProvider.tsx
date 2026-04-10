import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loginWithEmail,
  registerWithEmail,
  verifyOTP,
  loginWithGoogle,
  loginWithApple,
  getToken,
  setToken,
  removeToken,
  apiFetch,
  type AuthUser,
  type AuthResponse,
} from '../lib/api';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  clearOnboarding: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signInWithApple: (identityToken: string, fullName?: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  needsOnboarding: false,
  clearOnboarding: () => {},
  signIn: async () => {},
  signUp: async () => {},
  verifyOtp: async () => {},
  signOut: async () => {},
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
  const t = data.token;
  if (typeof t !== 'string' || !t) {
    throw new Error('Auth response missing token');
  }
  await setToken(t);
  await SecureStore.setItemAsync('auth_user', JSON.stringify(data.user ?? {}));
}

async function clearAuth() {
  await removeToken();
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

  // --- Restore session on mount ---
  useEffect(() => {
    (async () => {
      try {
        const stored = await getToken();
        if (!stored) return;

        const res = await apiFetch('/user/profile');
        if (res.ok) {
          const profile = await res.json();
          setUser(profile.user ?? profile);
          setTokenState(stored);
        } else if (res.status === 401 || res.status === 403 || res.status === 404) {
          // Token invalid or user deleted - sign out
          console.error('[Auth] Token rejected on mount, status:', res.status);
          await clearAuth();
        } else {
          // Other error (500, network hiccup) - try cached user as offline fallback
          const cached = await SecureStore.getItemAsync('auth_user');
          if (cached) {
            setUser(JSON.parse(cached));
            setTokenState(stored);
          } else {
            await clearAuth();
          }
        }
      } catch {
        // Network error, fall back to cached user
        const stored = await getToken();
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

  // --- Internal: store auth result and check onboarding ---
  const handlePostAuth = useCallback(async (data: AuthResponse) => {
    await storeAuth(data);
    setUser(data.user);

    const userId = data.user?.id ?? data.user?.email;
    console.log('[Auth] handlePostAuth called, userId:', userId);
    if (userId) {
      const key = `has_seen_onboarding_${userId}`;
      const seen = await AsyncStorage.getItem(key);
      console.log('[Auth] has_seen_onboarding key:', key);
      console.log('[Auth] has_seen_onboarding value:', seen);
      console.log('[Auth] setting needsOnboarding to:', seen !== 'true');
      if (seen !== 'true') {
        setNeedsOnboarding(true);
      }
    } else {
      console.warn('[Auth] handlePostAuth: no userId found on data.user, keys:', Object.keys(data.user ?? {}));
    }

    // Setting token last so isAuthenticated flips after everything is ready
    setTokenState(data.token);
  }, []);

  // --- Public auth methods (no navigation, state only) ---

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await loginWithEmail(email, password);
    await handlePostAuth(data);
  }, [handlePostAuth]);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    await registerWithEmail(email, password, name);
    // Backend sends OTP. Caller navigates to OTP screen.
  }, []);

  const verifyOtp = useCallback(async (email: string, code: string) => {
    const data = await verifyOTP(email, code);
    await handlePostAuth(data);
  }, [handlePostAuth]);

  const signOut = useCallback(async () => {
    const userId = user?.id ?? user?.email;
    await clearAuth();
    if (userId) {
      await AsyncStorage.removeItem(`has_seen_onboarding_${userId}`);
    }
    setUser(null);
    setTokenState(null);
    setNeedsOnboarding(false);
  }, [user]);

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

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token,
        needsOnboarding,
        clearOnboarding,
        signIn,
        signUp,
        verifyOtp,
        signOut,
        signInWithGoogle: signInWithGoogleFn,
        signInWithApple: signInWithAppleFn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
