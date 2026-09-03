'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { UserDto } from '@ltl-shop/shared';
import { apiFetch, AUTH_TOKEN_KEY, setAuthToken } from './api';
import { passwordResetRedirectUrl } from './site-url';

type AuthState = {
  user: UserDto | null;
  token: string | null;
  sessionLoading: boolean;
  profileLoading: boolean;
  passwordRecovery: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginDev: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function canUseSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return !!(supabaseUrl && anon && !supabaseUrl.includes('YOUR_PROJECT'));
}

async function getSupabaseClient() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery',
  );
  const [error, setError] = useState<string | null>(null);
  const profileTokenRef = useRef<string | null>(null);

  const clearSession = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
    setToken(null);
    setProfileLoading(false);
    setPasswordRecovery(false);
    profileTokenRef.current = null;
  }, []);

  const applyToken = useCallback((tok: string) => {
    setAuthToken(tok);
    setToken(tok);
    localStorage.setItem(AUTH_TOKEN_KEY, tok);
  }, []);

  const loadProfile = useCallback(
    async (tok: string) => {
      if (profileTokenRef.current === tok) return;
      profileTokenRef.current = tok;
      setProfileLoading(true);
      applyToken(tok);
      try {
        const res = await apiFetch<{ user: UserDto }>('/api/auth/me');
        setUser(res.user);
      } catch (profileError) {
        profileTokenRef.current = null;
        clearSession();
        throw profileError;
      } finally {
        setProfileLoading(false);
      }
    },
    [applyToken, clearSession],
  );

  useEffect(() => {
    const onExpired = () => clearSession();
    window.addEventListener('ltl-auth-expired', onExpired);
    return () => window.removeEventListener('ltl-auth-expired', onExpired);
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        if (canUseSupabase()) {
          const supabase = await getSupabaseClient();
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.access_token) {
            applyToken(session.access_token);
            if (!cancelled) setSessionLoading(false);
            void loadProfile(session.access_token).catch(() => undefined);
          } else {
            const saved = localStorage.getItem(AUTH_TOKEN_KEY);
            if (saved?.startsWith('dev:')) {
              applyToken(saved);
              if (!cancelled) setSessionLoading(false);
              void loadProfile(saved).catch(() => undefined);
            }
          }

          if (cancelled) return;

          const {
            data: { subscription },
          } = supabase.auth.onAuthStateChange((event, nextSession) => {
            if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
            if (!nextSession?.access_token) {
              clearSession();
              return;
            }
            applyToken(nextSession.access_token);
            setSessionLoading(false);
            void loadProfile(nextSession.access_token).catch(() => undefined);
          });

          return () => subscription.unsubscribe();
        }

        const saved = localStorage.getItem(AUTH_TOKEN_KEY);
        if (saved) {
          applyToken(saved);
          if (!cancelled) setSessionLoading(false);
          void loadProfile(saved).catch(() => undefined);
        }
      } catch {
        clearSession();
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    }

    const cleanupPromise = init();
    return () => {
      cancelled = true;
      void cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [applyToken, loadProfile, clearSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      if (!canUseSupabase()) {
        throw new Error(
          'Supabase is not configured. Use Dev Login or set NEXT_PUBLIC_SUPABASE_* env vars.',
        );
      }
      const supabase = await getSupabaseClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError || !data.session) {
        throw new Error(authError?.message ?? 'Sign in failed');
      }
      await loadProfile(data.session.access_token);
    },
    [loadProfile],
  );

  const loginDev = useCallback(
    async (email: string) => {
      setError(null);
      await loadProfile(`dev:${email.toLowerCase()}`);
    },
    [loadProfile],
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!canUseSupabase()) {
      throw new Error('Password recovery is unavailable until Supabase is configured.');
    }
    const supabase = await getSupabaseClient();
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: passwordResetRedirectUrl(window.location.origin),
    });
    if (authError) throw new Error(authError.message);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (!canUseSupabase()) {
      throw new Error('Password recovery is unavailable until Supabase is configured.');
    }
    const supabase = await getSupabaseClient();
    const { error: authError } = await supabase.auth.updateUser({ password });
    if (authError) throw new Error(authError.message);
  }, []);

  const logout = useCallback(async () => {
    clearSession();
    if (canUseSupabase()) {
      const supabase = await getSupabaseClient();
      await supabase.auth.signOut();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      token,
      sessionLoading,
      profileLoading,
      passwordRecovery,
      error,
      login,
      loginDev,
      requestPasswordReset,
      updatePassword,
      logout,
    }),
    [
      user,
      token,
      sessionLoading,
      profileLoading,
      passwordRecovery,
      error,
      login,
      loginDev,
      requestPasswordReset,
      updatePassword,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
