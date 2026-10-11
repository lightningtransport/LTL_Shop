'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { AppCapability, type UserDto } from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { defaultWorkspacePath, hasCapability } from '@/lib/admin-routing';
import { DEMO_MODE_AVAILABLE } from '@/lib/dev-login';
import { useTrucks } from '@/lib/shop-data';
import { castMember, castMemberByEmail } from './cast';
import { resolveDemoTarget } from './resolve-target';
import { type DemoStep, type DemoStory, findDemoStory } from './scripts';
import { DEFAULT_DEMO_STATE, DEMO_STATE_EVENT, type DemoState, demoPanelAvailable, readDemoState, writeDemoState } from './state';
import { refreshAdminSessionCookie, switchDemoUser } from './switch-user';

export type DemoUserDto = Pick<UserDto, 'id' | 'name' | 'email' | 'role' | 'active' | 'capabilities'>;

export const DEMO_MANAGER_EMAIL = 'manager@lightning.local';

/** The Admin cookie lives 60 minutes (api/admin/session); a demo lasts longer (UX-1-003). */
const ADMIN_COOKIE_REFRESH_MS = 20 * 60_000;

export type DemoMode = {
  /** False until the saved state has been read on the client (keeps server and first client render equal). */
  ready: boolean;
  state: DemoState;
  /** Demo-capable build and the mode is on: the header button and the panel exist. */
  available: boolean;
  users: DemoUserDto[] | undefined;
  usersError: unknown;
  busy: boolean;
  /** Label of the account being switched to while the page is replaced (UX-6-002). */
  switchingTo: string | null;
  error: string | null;
  /** The chosen story and its current step, clamped to the story length. */
  story: DemoStory | null;
  step: DemoStep | null;
  stepIndex: number;
  /** The screen on view is the current step's screen (null while trucks have not loaded) (UX-5-001). */
  onStepScreen: boolean | null;
  setPanelOpen: (open: boolean) => void;
  setAutoFollow: (on: boolean) => void;
  /** Turn the mode on or off from anywhere (profile menu); the sign-in stays (UX-1-001). */
  setEnabled: (on: boolean) => void;
  dismissWelcome: () => void;
  /** Become another demo account and load its home (or `path`) from scratch. */
  switchTo: (email: string, path?: string) => Promise<void>;
  /** Pick a story (null clears it). The card previews step 1; nothing navigates until `startStory` (UX-7-003). */
  selectStory: (id: string | null) => void;
  /** Open the first step of the chosen story (switches account and screen). */
  startStory: () => Promise<void>;
  /** Move to a step; with auto-follow on, switches user and screen. */
  goToStep: (index: number) => Promise<void>;
  /** Open the current step's screen now (auto-follow off, or the presenter wandered off). */
  goToScreen: () => Promise<void>;
  /** Clear the story and go back to the Manager dashboard. Data is not rebuilt. */
  backToManager: () => Promise<void>;
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
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingStep = useRef<DemoStep | null>(null);

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

  // UX-1-003: while the demo is on and the account can enter the Admin, keep its server cookie alive.
  const canAdmin = hasCapability(user, AppCapability.ADMIN_ACCESS);
  useEffect(() => {
    if (!available || !token || !canAdmin) return;
    const id = window.setInterval(() => void refreshAdminSessionCookie(token), ADMIN_COOKIE_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [available, token, canAdmin]);

  const switchTo = useCallback(
    async (email: string, path?: string) => {
      setBusy(true);
      setError(null);
      const normalized = email.toLowerCase();
      const known = data?.users.find((item) => item.email.toLowerCase() === normalized);
      setSwitchingTo(castMemberByEmail(normalized)?.label ?? known?.name ?? email);
      const landing = path ?? (known ? defaultWorkspacePath(known) : '/');
      // Saved before the page is replaced, so the new document reopens the panel where it was.
      writeDemoState({ ...readDemoState(), enabled: true, panelOpen: true });
      const result = await switchDemoUser(
        { email, path: landing },
        { fetch: (input, init) => window.fetch(input, init), storage: window.localStorage, replace: (to) => window.location.replace(to) },
      );
      if (!result.ok) {
        setBusy(false);
        setSwitchingTo(null);
        setError(
          result.status === 0
            ? 'The demo server is not answering. Start it from a terminal: npm run start:demo'
            : result.status === 403 || result.status === 401
              ? `${email} is not an active account in the demo database. Rebuild the demo: npm run prisma:demo-local`
              : `Could not switch to ${email} (HTTP ${result.status}). Check the demo server and try again.`,
        );
      }
    },
    [data],
  );

  const resolvedPathOf = useCallback(
    (target: DemoStep) => {
      if (!trucks && target.target.kind !== 'path') return null;
      const resolved = resolveDemoTarget(target.target, trucks ?? []);
      return 'error' in resolved ? resolved : resolved.path;
    },
    [trucks],
  );

  const openStep = useCallback(
    async (target: DemoStep) => {
      setError(null);
      const resolved = resolvedPathOf(target);
      if (resolved === null) {
        // UX-6-003: wait for the truck list instead of asking the presenter to tap again.
        pendingStep.current = target;
        return;
      }
      if (typeof resolved !== 'string') {
        setError(
          resolved.error === 'truck_not_found'
            ? `Truck ${resolved.unit} is not in this database. Build the demo data first: npm run prisma:demo-local`
            : `Truck ${resolved.unit} has no open Work Order any more: this story was already run on this data. Rebuild the demo: npm run prisma:demo-local`,
        );
        return;
      }
      const email = castMember(target.user).email;
      if (user?.email.toLowerCase() !== email) {
        await switchTo(email, resolved);
        return;
      }
      if (resolved.startsWith('/admin') && token) await refreshAdminSessionCookie(token);
      const current = `${pathname}${window.location.search}`;
      if (current === resolved) {
        router.refresh();
        void mutate(() => true);
      } else {
        router.push(resolved);
      }
    },
    [resolvedPathOf, user?.email, token, pathname, router, mutate, switchTo],
  );

  useEffect(() => {
    if (!trucks || !pendingStep.current) return;
    const target = pendingStep.current;
    pendingStep.current = null;
    void openStep(target);
  }, [trucks, openStep]);

  const goToStep = useCallback(
    async (index: number) => {
      const current = readDemoState();
      const target = findDemoStory(current.storyId);
      if (!target) return;
      const next = clampStep(target, index);
      update({ stepIndex: next, panelOpen: true, started: true });
      if (current.autoFollow) await openStep(target.steps[next]);
    },
    [update, openStep],
  );

  const selectStory = useCallback(
    (id: string | null) => {
      const target = findDemoStory(id);
      pendingStep.current = null;
      setError(null);
      update({ storyId: target?.id ?? null, stepIndex: 0, started: false, panelOpen: true });
    },
    [update],
  );

  const startStory = useCallback(async () => {
    const current = readDemoState();
    const target = findDemoStory(current.storyId);
    if (!target) return;
    update({ stepIndex: 0, started: true, panelOpen: true });
    await openStep(target.steps[0]);
  }, [update, openStep]);

  const goToScreen = useCallback(async () => {
    if (step) await openStep(step);
  }, [step, openStep]);

  const backToManager = useCallback(async () => {
    update({ storyId: null, stepIndex: 0, started: false, panelOpen: true });
    if (user?.email === DEMO_MANAGER_EMAIL) {
      window.location.replace('/admin');
      return;
    }
    await switchTo(DEMO_MANAGER_EMAIL, '/admin');
  }, [switchTo, update, user?.email]);

  const setEnabled = useCallback(
    (on: boolean) => {
      if (on) update({ enabled: true, panelOpen: true });
      else update({ ...DEFAULT_DEMO_STATE });
    },
    [update],
  );

  const onStepScreen = useMemo(() => {
    if (!step || !state.started) return null;
    const resolved = resolvedPathOf(step);
    if (resolved === null || typeof resolved !== 'string') return null;
    const stepUser = castMember(step.user).email;
    if (user?.email.toLowerCase() !== stepUser) return false;
    const current = typeof window === 'undefined' ? pathname : `${pathname}${window.location.search}`;
    return current === resolved;
  }, [step, state.started, resolvedPathOf, user?.email, pathname]);

  const value = useMemo<DemoMode>(
    () => ({
      ready,
      state,
      available,
      users: data?.users,
      usersError,
      busy,
      switchingTo,
      error,
      story,
      step,
      stepIndex,
      onStepScreen,
      setPanelOpen: (open) => update({ panelOpen: open }),
      setAutoFollow: (on) => update({ autoFollow: on }),
      setEnabled,
      dismissWelcome: () => update({ welcome: false }),
      switchTo,
      selectStory,
      startStory,
      goToStep,
      goToScreen,
      backToManager,
    }),
    [ready, state, available, data?.users, usersError, busy, switchingTo, error, story, step, stepIndex, onStepScreen, update, setEnabled, switchTo, selectStory, startStory, goToStep, goToScreen, backToManager],
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
