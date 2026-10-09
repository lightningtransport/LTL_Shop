'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import type { UserDto } from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { defaultWorkspacePath } from '@/lib/admin-routing';
import { DEMO_MODE_AVAILABLE } from '@/lib/dev-login';
import { useTrucks } from '@/lib/shop-data';
import { castMember } from './cast';
import { resolveDemoTarget } from './resolve-target';
import { type DemoStep, type DemoStory, findDemoStory } from './scripts';
import { DEFAULT_DEMO_STATE, DEMO_STATE_EVENT, type DemoState, demoPanelAvailable, readDemoState, writeDemoState } from './state';
import { refreshAdminSessionCookie, switchDemoUser } from './switch-user';

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
  /** The chosen story and its current step, clamped to the story length. */
  story: DemoStory | null;
  step: DemoStep | null;
  stepIndex: number;
  setPanelOpen: (open: boolean) => void;
  setAutoFollow: (on: boolean) => void;
  /** Become another demo account and load its home (or `path`) from scratch. */
  switchTo: (email: string, path?: string) => Promise<void>;
  /** Pick a story (null clears it). With auto-follow on, its first step opens at once. */
  selectStory: (id: string | null) => Promise<void>;
  /** Move to a step; with auto-follow on, switches user and screen. */
  goToStep: (index: number) => Promise<void>;
  /** Open the current step's screen now (used when auto-follow is off, or to come back to it). */
  goToScreen: () => Promise<void>;
  /** Clear the story and go back to the Manager dashboard. */
  resetDemo: () => Promise<void>;
  /** Turn the mode off; the current sign-in stays. */
  leave: () => void;
};

const DemoModeContext = createContext<DemoMode | null>(null);

export const DEMO_USERS_KEY = '/api/dev/demo/users';

function clampStep(story: DemoStory | null, index: number): number {
  if (!story) return 0;
  return Math.min(Math.max(index, 0), story.steps.length - 1);
}

function DemoModeProviderInner({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { mutate } = useSWRConfig();
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
  const { data: trucks } = useTrucks(available && !!token && !!state.storyId);

  const story = useMemo(() => findDemoStory(state.storyId), [state.storyId]);
  const stepIndex = clampStep(story, state.stepIndex);
  const step = story ? story.steps[stepIndex] : null;

  const switchTo = useCallback(
    async (email: string, path?: string) => {
      setBusy(true);
      setError(null);
      const target = path ?? data?.users.find((item) => item.email === email.toLowerCase());
      const landing = typeof target === 'string' ? target : target ? defaultWorkspacePath(target) : '/';
      // Saved before the page is replaced, so the new document reopens the panel where it was.
      writeDemoState({ ...readDemoState(), enabled: true, panelOpen: true });
      const result = await switchDemoUser(
        { email, path: landing },
        { fetch: (input, init) => window.fetch(input, init), storage: window.localStorage, assign: (to) => window.location.assign(to) },
      );
      if (!result.ok) {
        setBusy(false);
        setError(
          result.status === 0
            ? 'The API did not answer. Is demo-api running (npm run start:demo)?'
            : `Could not switch to ${email} (HTTP ${result.status}). Is the account active, and does the API have AUTH_DEV_BYPASS=true?`,
        );
      }
    },
    [data],
  );

  const openStep = useCallback(
    async (target: DemoStep) => {
      setError(null);
      if (!trucks && target.target.kind !== 'path') {
        setError('The truck list has not loaded yet. Try again in a second.');
        return;
      }
      const resolved = resolveDemoTarget(target.target, trucks ?? []);
      if ('error' in resolved) {
        setError(
          resolved.error === 'truck_not_found'
            ? `Truck ${resolved.unit} is not in this database. Did you build the demo (npm run prisma:demo-local)?`
            : `Truck ${resolved.unit} has no open Work Order. Did you rebuild the demo (npm run prisma:demo-local)?`,
        );
        return;
      }
      const email = castMember(target.user).email;
      if (user?.email.toLowerCase() !== email) {
        await switchTo(email, resolved.path);
        return;
      }
      if (resolved.path.startsWith('/admin') && token) await refreshAdminSessionCookie(token);
      const current = `${pathname}${window.location.search}`;
      if (current === resolved.path) {
        router.refresh();
        void mutate(() => true);
      } else {
        router.push(resolved.path);
      }
    },
    [trucks, user?.email, token, pathname, router, mutate, switchTo],
  );

  const goToStep = useCallback(
    async (index: number) => {
      const current = readDemoState();
      const target = findDemoStory(current.storyId);
      if (!target) return;
      const next = clampStep(target, index);
      update({ stepIndex: next, panelOpen: true });
      if (current.autoFollow) await openStep(target.steps[next]);
    },
    [update, openStep],
  );

  const selectStory = useCallback(
    async (id: string | null) => {
      const target = findDemoStory(id);
      update({ storyId: target?.id ?? null, stepIndex: 0, panelOpen: true });
      setError(null);
      if (target && readDemoState().autoFollow) await openStep(target.steps[0]);
    },
    [update, openStep],
  );

  const goToScreen = useCallback(async () => {
    if (step) await openStep(step);
  }, [step, openStep]);

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
      story,
      step,
      stepIndex,
      setPanelOpen: (open) => update({ panelOpen: open }),
      setAutoFollow: (on) => update({ autoFollow: on }),
      switchTo,
      selectStory,
      goToStep,
      goToScreen,
      resetDemo,
      leave,
    }),
    [ready, state, available, data?.users, usersError, busy, error, story, step, stepIndex, update, switchTo, selectStory, goToStep, goToScreen, resetDemo, leave],
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
