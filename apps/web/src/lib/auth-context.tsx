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
import { AppCapability, type UserDto } from '@ltl-shop/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError, apiFetch, AUTH_TOKEN_KEY, setAuthToken } from './api';
import {
  fetchWithDeadline,
  PROFILE_RESTORE_TIMEOUT_MS,
  SESSION_RESTORE_TIMEOUT_MS,
  withDeadline,
} from './session-restore';
import { passwordResetRedirectUrl } from './site-url';

type AuthState = {
  user: UserDto | null;
  token: string | null;
  sessionLoading: boolean;
  profileLoading: boolean;
  passwordRecovery: boolean;
  error: string | null;
  sessionError: string | null;
  login: (email: string, password: string) => Promise<UserDto>;
  loginDev: (email: string) => Promise<UserDto>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  retrySession: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

function canUseSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return !!(supabaseUrl && anon && !supabaseUrl.includes('YOUR_PROJECT'));
}

let supabaseClientPromise: Promise<SupabaseClient> | null = null;

function getSupabaseClient() {
  if (!supabaseClientPromise) {
    supabaseClientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    );
  }
  return supabaseClientPromise;
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
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const profilePromiseRef = useRef<{ token: string; promise: Promise<UserDto> } | null>(null);

  const clearSession = useCallback(async () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
    setToken(null);
    setProfileLoading(false);
    setPasswordRecovery(false);
    profilePromiseRef.current = null;
    await fetch('/api/admin/session', { method: 'DELETE' }).catch(() => undefined);
  }, []);

  const retrySession = useCallback(() => {
    setSessionError(null);
    setSessionLoading(true);
    setSessionAttempt((current) => current + 1);
  }, []);

  const applyToken = useCallback((tok: string) => {
    setAuthToken(tok);
    setToken(tok);
    localStorage.setItem(AUTH_TOKEN_KEY, tok);
  }, []);

  const loadProfile = useCallback(
    (tok: string): Promise<UserDto> => {
      if (profilePromiseRef.current?.token === tok) return profilePromiseRef.current.promise;

      const promise = (async () => {
        setProfileLoading(true);
        applyToken(tok);
        try {
          const [res, serverSession] = await Promise.all([
            apiFetch<{ user: UserDto }>('/api/auth/me', { timeoutMs: PROFILE_RESTORE_TIMEOUT_MS }),
            fetchWithDeadline(
              '/api/admin/session',
              {
                method: 'POST',
                headers: { Authorization: `Bearer ${tok}` },
              },
              PROFILE_RESTORE_TIMEOUT_MS,
            ).catch(() => new Response(null, { status: 503 })),
          ]);
          // Publish the profile before the cookie check. A failed cookie refresh
          // must not leave role === admin as a null client user, or catalog and
          // roster writes stay on the read-only subtitle. Login still fails
          // closed when the secure session cannot be established.
          setUser(res.user);
          if (!serverSession.ok && res.user.capabilities.includes(AppCapability.ADMIN_ACCESS)) {
            throw new Error('Unable to establish the secure application session.');
          }
          return res.user;
        } catch (profileError) {
          profilePromiseRef.current = null;
          if (profileError instanceof ApiError && [401, 403].includes(profileError.status)) {
            void clearSession();
          } else {
            setSessionError(
              profileError instanceof Error
                ? profileError.message
                : 'Unable to restore your profile. Please try again.',
            );
          }
          throw profileError;
        } finally {
          setProfileLoading(false);
        }
      })();

      profilePromiseRef.current = { token: tok, promise };
      return promise;
    },
    [applyToken, clearSession],
  );

  useEffect(() => {
    const onExpired = () => void clearSession();
    window.addEventListener('ltl-auth-expired', onExpired);
    return () => window.removeEventListener('ltl-auth-expired', onExpired);
  }, [clearSession]);

  useEffect(() => {
    if (!sessionError) return;
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) retrySession();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [sessionError, retrySession]);

  useEffect(() => {
    let cancelled = false;
    let saved: string | null = null;

    async function init() {
      setSessionError(null);
      setSessionLoading(true);
      try {
        saved = localStorage.getItem(AUTH_TOKEN_KEY);
        if (saved) {
          applyToken(saved);
          if (!cancelled) setSessionLoading(false);
          void loadProfile(saved).catch(() => undefined);
        } else if (!cancelled) {
          // Do not block first paint or the login form on Supabase / network.
          setSessionLoading(false);
        }

        if (canUseSupabase()) {
          const supabase = await withDeadline(getSupabaseClient(), SESSION_RESTORE_TIMEOUT_MS);
          const {
            data: { session },
          } = await withDeadline(supabase.auth.getSession(), SESSION_RESTORE_TIMEOUT_MS);

          if (session?.access_token) {
            applyToken(session.access_token);
            if (!cancelled) setSessionLoading(false);
            void loadProfile(session.access_token).catch(() => undefined);
          }

          if (cancelled) return;

          const {
            data: { subscription },
          } = supabase.auth.onAuthStateChange((event, nextSession) => {
            if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
            if (!nextSession?.access_token) {
              void clearSession();
              return;
            }
            applyToken(nextSession.access_token);
            setSessionLoading(false);
            void loadProfile(nextSession.access_token).catch(() => undefined);
          });

          return () => subscription.unsubscribe();
        }
      } catch (initError) {
        // Background Supabase restore must not hide the login form. Only keep an
        // error when a saved app token still needs a visible retry.
        if (!cancelled && saved) {
          setSessionError(
            initError instanceof Error
              ? initError.message
              : 'Unable to restore your session. Please try again.',
          );
        }
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    }

    const cleanupPromise = init();
    return () => {
      cancelled = true;
      void cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [applyToken, loadProfile, clearSession, sessionAttempt]);

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
      return loadProfile(data.session.access_token);
    },
    [loadProfile],
  );

  const loginDev = useCallback(
    async (email: string) => {
      setError(null);
      return loadProfile(`dev:${email.toLowerCase()}`);
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
    const cleared = clearSession();
    try {
      if (canUseSupabase()) {
        const supabase = await getSupabaseClient();
        const { error: authError } = await supabase.auth.signOut();
        if (authError) throw new Error(authError.message);
      }
    } finally {
      await cleared;
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
      sessionError,
      login,
      loginDev,
      requestPasswordReset,
      updatePassword,
      logout,
      retrySession,
    }),
    [
      user,
      token,
      sessionLoading,
      profileLoading,
      passwordRecovery,
      error,
      sessionError,
      login,
      loginDev,
      requestPasswordReset,
      updatePassword,
      logout,
      retrySession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
