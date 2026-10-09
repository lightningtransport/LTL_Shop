'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import type { UserDto } from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { defaultWorkspacePath } from '@/lib/admin-routing';
import { DEMO_MODE_AVAILABLE } from '@/lib/dev-login';
import { DEFAULT_DEMO_STATE, DEMO_STATE_EVENT, type DemoState, demoPanelAvailable, readDemoState, writeDemoState } from './state';
import { switchDemoUser } from './switch-user';

export type DemoUserDto = Pick<UserDto, 'id' | 'name' | 'email' | 'role' | 'active' | 'capabilities'>;

export type DemoMode = {
  /** False until the saved state has been read on the client (keeps server and first client render equal). */
  ready: boolean;
  state: DemoState;
  /** Demo-capable build and the mode is on: the header button and the panel exist. */
  available: boolean;
  users: DemoUserDto[] | undefined;
  usersError: unknown;
  busy: boolean;
  error: string | null;
  setPanelOpen: (open: boolean) => void;
  setAutoFollow: (on: boolean) => void;
  /** Become another demo account and load its home (or `path`) from scratch. */
  switchTo: (email: string, path?: string) => Promise<void>;
  /** Clear the story and go back to the Manager dashboard. */
  resetDemo: () => Promise<void>;
  /** Turn the mode off; the current sign-in stays. */
  leave: () => void;
};

const DemoModeContext = createContext<DemoMode | null>(null);

export const DEMO_USERS_KEY = '/api/dev/demo/users';

function DemoModeProviderInner({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [state, setState] = useState<DemoState>(DEFAULT_DEMO_STATE);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setState(readDemoState());
    sync();
    setReady(true);
    // /login writes the state after this provider mounted (soft navigation); other tabs change it too.
    window.addEventListener(DEMO_STATE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(DEMO_STATE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const update = useCallback((patch: Partial<DemoState>) => {
    writeDemoState({ ...readDemoState(), ...patch });
  }, []);

  const available = ready && demoPanelAvailable(DEMO_MODE_AVAILABLE, state);
  const { data, error: usersError } = useSWR<{ users: DemoUserDto[] }>(
    available && token ? DEMO_USERS_KEY : null,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  const switchTo = useCallback(
    async (email: string, path?: string) => {
      setBusy(true);
      setError(null);
      const target = path ?? data?.users.find((item) => item.email === email.toLowerCase());
      const landing = typeof target === 'string' ? target : target ? defaultWorkspacePath(target) : '/';
      // Saved before the page is replaced, so the new document reopens the panel where it was.
      const next = { ...readDemoState(), enabled: true, panelOpen: true };
      writeDemoState(next);
      const result = await switchDemoUser(
        { email, path: landing },
        { fetch: (input, init) => window.fetch(input, init), storage: window.localStorage, assign: (to) => window.location.assign(to) },
      );
      if (!result.ok) {
        setBusy(false);
        setError(
          result.status === 0
            ? 'The API did not answer. Is demo-api running on port 3141?'
            : `Could not switch to ${email} (HTTP ${result.status}). Is the account active, and does the API have AUTH_DEV_BYPASS=true?`,
        );
      }
    },
    [data],
  );

  const resetDemo = useCallback(async () => {
    update({ storyId: null, stepIndex: 0, panelOpen: true });
    const manager = 'manager@lightning.local';
    if (user?.email === manager) {
      window.location.assign('/admin');
      return;
    }
    await switchTo(manager, '/admin');
  }, [switchTo, update, user?.email]);

  const leave = useCallback(() => {
    update({ ...DEFAULT_DEMO_STATE });
  }, [update]);

  const value = useMemo<DemoMode>(
    () => ({
      ready,
      state,
      available,
      users: data?.users,
      usersError,
      busy,
      error,
      setPanelOpen: (open) => update({ panelOpen: open }),
      setAutoFollow: (on) => update({ autoFollow: on }),
      switchTo,
      resetDemo,
      leave,
    }),
    [ready, state, available, data?.users, usersError, busy, error, update, switchTo, resetDemo, leave],
  );

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}

/** D36: no-op outside demo-capable builds, so production never mounts any of this. */
export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  if (!DEMO_MODE_AVAILABLE) return <>{children}</>;
  return <DemoModeProviderInner>{children}</DemoModeProviderInner>;
}

export function useDemoMode(): DemoMode | null {
  return useContext(DemoModeContext);
}
