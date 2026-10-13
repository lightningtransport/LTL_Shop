'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { FlaskConical, Loader2, Pause, Play, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DEMO_CAST, DEMO_CAST_GROUPS, castMember, castMemberByEmail } from '@/lib/demo/cast';
import { describeTarget } from '@/lib/demo/resolve-target';
import { DEMO_FLOW, DEMO_STORIES, DEMO_WHO_LABELS, DEMO_WHO_ORDER, storyChapters } from '@/lib/demo/scripts';
import { useDemoMode } from '@/lib/demo/demo-context';
import { DEMO_REBUILD, DEMO_SERVER_DOWN } from '@/lib/demo/copy';
import { DEMO_SPEEDS } from '@/lib/demo/state';
import { DEMO_HOSTED } from '@/lib/dev-login';
import { cn } from '@/lib/utils';
import { Badge, Button, InlineAlert, Select } from './ui';

/**
 * D36: the "Demo" panel from the proposal mockups (docs/proposals/wo-detail-redesign/mockup.html), now inside
 * the app for the local demo only. English, fixed copy: it is a presenter tool, not part of the product.
 * Revised after docs/ux-audit/demo-mode (2026-10-10): Next is the main action, a story previews before it
 * navigates, the panel says when the screen on view is not the step's, and the footer links are honest.
 */

const PANEL_HIDDEN_ON = ['/login', '/reset-password', '/access-denied'];

const PRESET_BUTTON =
  'flex min-h-11 flex-col items-start justify-center rounded-md border px-2 py-1.5 text-left text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 [@media(pointer:fine)]:min-h-9';
const PRESET_ACTIVE = 'border-primary bg-primary/10 text-primary';
const TEXT_LINK = 'rounded-md px-2 py-1 text-xs text-muted-foreground underline-offset-2 hover:bg-accent hover:text-foreground';

export function DemoHeaderButton() {
  const demo = useDemoMode();
  const { user } = useAuth();
  if (!demo?.available || !user) return null;
  return (
    <button
      type="button"
      onClick={() => demo.setPanelOpen(!demo.state.panelOpen)}
      aria-expanded={demo.state.panelOpen}
      aria-controls="demo-panel"
      className="mr-2 inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-primary/40 bg-primary/10 px-2.5 text-xs font-medium text-primary hover:bg-primary/15"
    >
      <FlaskConical aria-hidden="true" className="size-3.5" />
      Demo
    </button>
  );
}

/** Row in the profile menu (local builds): turn the demo on or off without signing out (UX-1-001). */
export function DemoModeMenuRow({ onNavigate }: { onNavigate?: () => void }) {
  const demo = useDemoMode();
  if (!demo?.ready) return null;
  const on = demo.state.enabled;
  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-medium"><FlaskConical aria-hidden="true" className="size-4 text-primary" />Demo mode · {on ? 'on' : 'off'}</p>
        <p className="text-xs text-muted-foreground">{DEMO_HOSTED ? 'Made-up data.' : 'Local only.'} Switch accounts and follow the stories.</p>
      </div>
      <Button
        variant={on ? 'outline' : 'default'}
        size="sm"
        onClick={() => {
          demo.setEnabled(!on);
          onNavigate?.();
        }}
      >
        {on ? 'Turn off' : 'Turn on'}
      </Button>
    </div>
  );
}

/**
 * While the panel is open, wide screens keep its column free (globals.css, html[data-demo-panel]) so it never
 * covers the buttons the presenter has to tap, such as Resolve on the right of the Admin pages.
 */
function ReservePanelSpace() {
  useEffect(() => {
    document.documentElement.dataset.demoPanel = 'open';
    return () => {
      delete document.documentElement.dataset.demoPanel;
    };
  }, []);
  return null;
}

export function DemoPanel() {
  const demo = useDemoMode();
  const { user } = useAuth();
  const pathname = usePathname();
  const [confirmLeave, setConfirmLeave] = useState(false);
  // UX-1-010 (DP2): on a phone the panel is a bottom bar with the step and Back/Next; "More" opens the rest.
  const [expanded, setExpanded] = useState(false);
  if (!demo?.available || !demo.state.panelOpen || !user) return null;
  if (PANEL_HIDDEN_ON.some((prefix) => pathname.startsWith(prefix))) return null;

  const activeEmails = new Set((demo.users ?? []).map((item) => item.email.toLowerCase()));
  const castEmails = new Set(DEMO_CAST.map((item) => item.email));
  const others = (demo.users ?? []).filter((item) => !castEmails.has(item.email.toLowerCase()));
  const current = user.email.toLowerCase();
  const stepUser = demo.step ? castMember(demo.step.user) : null;
  const stepIsMine = !!stepUser && stepUser.email === current;
  // While Play runs, a step's own tap may change the screen (a filter, a form that opens a page): no warning.
  const offScreen = demo.state.started && demo.onStepScreen === false && !demo.state.playing;
  const afterFive = new Date().getHours() >= 17;
  const chapters = demo.story ? storyChapters(demo.story) : [];
  const chapterIndex = chapters.findIndex((chapter) => demo.stepIndex >= chapter.from && demo.stepIndex <= chapter.to);
  // DA5: on a phone, a chosen story keeps the panel a bottom bar, before Start too; "More" opens the rest.
  const compact = !!demo.story && !expanded;
  /** Hidden on a phone while compact; always shown from sm up. */
  const phoneHidden = compact ? 'max-sm:hidden' : '';
  const pointAtNext = demo.state.started && !!demo.step?.spotlight && demo.spotlightDone;

  return (
    <div
      id="demo-panel"
      role="complementary"
      aria-label="Demo panel"
      className={cn('fixed inset-x-3 bottom-3 z-50 overflow-auto', compact ? 'max-h-[45vh]' : 'max-h-[75vh]', ' rounded-xl border bg-card p-4 text-sm text-card-foreground shadow-2xl sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-16 sm:max-h-[calc(100vh-5rem)] sm:w-[360px]')}
      style={{ paddingBottom: 'calc(1rem + var(--app-safe-bottom))' }}
    >
      <ReservePanelSpace />
      <div className={cn('mb-3 flex items-center justify-between', compact && 'max-sm:mb-1')}>
        <p className="font-semibold">Demo panel</p>
        {demo.story ? (
          <button type="button" className="ml-auto mr-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent sm:hidden" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Less' : 'More'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => demo.setPanelOpen(false)}
          className="grid size-8 place-items-center rounded-md hover:bg-accent"
          aria-label="Close demo panel"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>

      {demo.state.welcome && !demo.state.started ? (
        <p className={cn('mb-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs', phoneHidden)} role="status">
          Demo mode is on · you are <b>{castMemberByEmail(user.email)?.label ?? user.name}</b>. Tap <b>Play</b> and the demo runs by itself, or <b>Start</b> to tap each step yourself: the cursor shows where. You can also pick another story, or tap an account to see the app as that person.{' '}
          <button type="button" className="underline" onClick={() => demo.dismissWelcome()}>Got it</button>
        </p>
      ) : null}
      {demo.switchingTo ? (
        <p className="mb-3 flex items-center gap-2 rounded-md border px-3 py-2 text-xs" role="status" aria-live="polite">
          <Loader2 aria-hidden="true" className="size-4 animate-spin text-primary" />Switching to <b>{demo.switchingTo}</b>… the page loads again.
        </p>
      ) : null}
      {demo.error ? <InlineAlert className="mb-3">{demo.error}</InlineAlert> : null}
      {demo.usersError ? (
        <InlineAlert className="mb-3">The account list did not load. {DEMO_SERVER_DOWN}</InlineAlert>
      ) : null}
      {afterFive ? (
        <p className={cn('mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground dark:text-warning', phoneHidden)} role="status">
          It is after 5 PM: the day close has stopped today's clocks. {DEMO_HOSTED ? 'The data resets tonight.' : 'Rebuild the demo in the morning for a clean run.'}
        </p>
      ) : null}

      {/* Flex column so the Story block can move above the user grid (order-first) while a story is active. */}
      <div className="flex flex-col">
        <details open={!demo.story} className={cn('group', phoneHidden)}>
          <summary className="mb-2 cursor-pointer list-none text-xs text-muted-foreground">
            Accounts · signed in as <b className="text-foreground">{castMemberByEmail(user.email)?.label ?? user.name}</b>{demo.story ? ' · tap to switch by hand' : ''}
          </summary>
          {DEMO_CAST_GROUPS.map((group) => (
            <div key={group} className="mb-2">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{group}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {DEMO_CAST.filter((member) => member.group === group).map((member) => {
                  const active = member.email === current;
                  const loading = !demo.users && !demo.usersError;
                  const known = demo.users ? activeEmails.has(member.email) : true;
                  return (
                    <button
                      key={member.key}
                      type="button"
                      disabled={demo.busy || active || !known || loading}
                      aria-pressed={active}
                      onClick={() => void demo.switchTo(member.email)}
                      className={cn(PRESET_BUTTON, active && PRESET_ACTIVE, loading && 'opacity-60')}
                      title={loading ? 'Loading accounts…' : known ? member.hint : 'Not in the demo database'}
                    >
                      <span>{member.label} <span className="font-normal text-muted-foreground">· {member.roleLabel}</span>{active ? ' · you' : ''}</span>
                      <span className="line-clamp-2 font-normal text-muted-foreground">{loading ? 'Loading…' : known ? member.hint : 'inactive'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {others.length ? (
            <div className="mb-2">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Others</p>
              <div className="grid grid-cols-2 gap-1.5">
                {others.map((item) => {
                  const active = item.email.toLowerCase() === current;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={demo.busy || active}
                      aria-pressed={active}
                      onClick={() => void demo.switchTo(item.email)}
                      className={cn(PRESET_BUTTON, active && PRESET_ACTIVE)}
                    >
                      <span>{item.name}</span>
                      <span className="font-normal text-muted-foreground">{item.role === 'admin' ? 'System Admin' : item.role === 'manager' ? 'Shop Manager' : 'mechanic'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </details>

        <div className={demo.story ? 'order-first' : 'mt-4 border-t pt-3'}>
          <p className={cn('mb-2 text-xs text-muted-foreground', phoneHidden)}>Story</p>
          <div className={phoneHidden}>
          <Select
            aria-label="Story"
            value={demo.story?.id ?? ''}
            onChange={(event) => demo.selectStory(event.target.value || null)}
          >
            <option value="">None</option>
            <optgroup label="Demo flow">
              <option value={DEMO_FLOW.id}>{DEMO_FLOW.title} · {storyChapters(DEMO_FLOW).length} chapters</option>
            </optgroup>
            {DEMO_WHO_ORDER.map((who) => (
              <optgroup key={who} label={DEMO_WHO_LABELS[who]}>
                {DEMO_STORIES.filter((story) => story.who === who).map((story) => (
                  <option key={story.id} value={story.id}>
                    {story.title}{story.trucks.length ? ` (${story.trucks.join(', ')})` : ''} · {story.steps.length} steps
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          </div>
          {demo.story && chapters.length ? (
            <details className={cn('mt-2 rounded-md border px-2 py-1 text-xs', phoneHidden)}>
              <summary className="cursor-pointer select-none text-muted-foreground">Chapters · {chapters.length}{chapterIndex >= 0 ? ` · now ${chapterIndex + 1}` : ''}</summary>
            <ol className="mt-1 space-y-0.5" aria-label="Chapters">
              {chapters.map((chapter, index) => {
                const active = demo.stepIndex >= chapter.from && demo.stepIndex <= chapter.to;
                return (
                  <li key={chapter.title}>
                    <button
                      type="button"
                      disabled={demo.busy}
                      onClick={() => void demo.goToStep(chapter.from)}
                      aria-current={active ? 'step' : undefined}
                      className={cn('w-full rounded-md px-2 py-1 text-left hover:bg-accent', active ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground')}
                    >
                      {chapter.title}
                      <span className="ml-1 font-normal text-muted-foreground">· {castMember(demo.story!.steps[chapter.from].user).label}{chapter.to > chapter.from ? ` · ${chapter.to - chapter.from + 1} steps` : ''}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            </details>
          ) : null}

          {demo.story && demo.step && stepUser ? (
            <div className={cn('mt-3 rounded-lg border bg-background p-3', compact && 'max-sm:mt-0 max-sm:border-0 max-sm:p-0')} data-testid="demo-step">
              {chapterIndex >= 0 ? (
                <p className="text-xs font-medium text-primary">Chapter {chapterIndex + 1} of {chapters.length} · {chapters[chapterIndex].title.replace(/^\d+ · /, '')}</p>
              ) : null}
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {demo.state.started ? `Step ${demo.stepIndex + 1} of ${demo.story.steps.length}` : `Ready · ${demo.story.steps.length} steps`}{demo.story.id === 'FLOW' ? '' : ` · ${demo.story.role}`}
                {demo.story.id !== 'FLOW' ? <span className="ml-1 rounded border px-1 font-mono text-[10px]">{demo.story.id}</span> : null}
              </p>
              <p className="mt-1 text-base font-semibold">{demo.step.title}</p>
              <div className={cn('mt-2 flex flex-wrap gap-1.5', phoneHidden)}>
                <Badge variant={stepIsMine ? 'default' : 'warning'}>{stepUser.label}</Badge>
                <Badge variant={offScreen ? 'warning' : 'outline'}>{describeTarget(demo.step.target)}</Badge>
                {demo.step.mutates ? <Badge variant="secondary">Changes data</Badge> : null}
              </div>
              {demo.story.note && demo.stepIndex === 0 && !DEMO_HOSTED ? (
                <p className={cn('mt-2 text-xs text-muted-foreground', phoneHidden)}>{demo.story.note}</p>
              ) : null}
              <p className={cn('mt-2', compact && 'max-sm:line-clamp-2')}><b>Do:</b> {demo.step.do}</p>
              {demo.step.say ? <p className={cn('mt-1 text-muted-foreground', phoneHidden)}><b className="text-foreground">Why:</b> {demo.step.say}</p> : null}
              {demo.step.expect ? <p className={cn('mt-1 text-xs text-muted-foreground', phoneHidden)}><b>You should see:</b> {demo.step.expect}</p> : null}

              {!demo.state.started ? (
                <>
                  <Button className="mt-3 w-full" disabled={demo.busy} onClick={() => void demo.setPlaying(true)}>
                    <Play aria-hidden="true" className="size-4" /> Play: the demo runs by itself
                  </Button>
                  <p className={cn('mt-1 text-xs text-muted-foreground', phoneHidden)}>The cursor taps and types each step and moves on; you talk. Pause any time.</p>
                  <Button variant="outline" className="mt-2 w-full" disabled={demo.busy} onClick={() => void demo.startStory()}>
                    Start{stepIsMine ? '' : ` as ${stepUser.label}`}: I tap
                  </Button>
                  <p className={cn('mt-1 text-xs text-muted-foreground', phoneHidden)}>Opens the first screen{stepIsMine ? '' : ' and switches the account'}; the cursor points, you tap, and the step moves on.</p>
                </>
              ) : (
                <>
                  {!stepIsMine && !demo.state.autoFollow ? (
                    <p className="mt-2 text-xs text-warning-foreground dark:text-warning">You are {castMemberByEmail(user.email)?.label ?? user.name}; this step is {stepUser.label}'s. "Go to this step's screen" switches for you.</p>
                  ) : null}
                  {offScreen && (stepIsMine || demo.state.autoFollow) ? (
                    <p className="mt-2 text-xs text-warning-foreground dark:text-warning">This is not the step's screen.</p>
                  ) : null}
                  {demo.playError ? <InlineAlert className="mt-2">{demo.playError}</InlineAlert> : null}
                  {/* DA5: on a phone Back · Play · Next share one row and the speed sits under More; from sm up, Play and
                      the speed, then Back and Next. */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant={demo.state.playing ? 'outline' : 'default'}
                      className="flex-1 max-sm:order-2"
                      disabled={demo.busy && !demo.state.playing}
                      onClick={() => void demo.setPlaying(!demo.state.playing)}
                    >
                      {demo.state.playing ? <><Pause aria-hidden="true" className="size-4" /> Pause</> : <><Play aria-hidden="true" className="size-4" /> Play</>}
                    </Button>
                    <div role="group" aria-label="Play speed" className={cn('flex rounded-md border p-0.5 max-sm:order-4 max-sm:basis-full max-sm:justify-center', phoneHidden)}>
                      {DEMO_SPEEDS.map((speed) => (
                        <button
                          key={speed}
                          type="button"
                          aria-pressed={demo.state.speed === speed}
                          className={cn('rounded px-2 py-1 text-xs', demo.state.speed === speed ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}
                          onClick={() => demo.setSpeed(speed)}
                        >
                          {speed}×
                        </button>
                      ))}
                    </div>
                    <div aria-hidden="true" className="h-0 basis-full max-sm:hidden" />
                    <Button variant="outline" size="sm" className="max-sm:order-1" disabled={demo.busy || demo.stepIndex === 0} onClick={() => void demo.goToStep(demo.stepIndex - 1)}>
                      Back
                    </Button>
                    {demo.stepIndex < demo.story.steps.length - 1 ? (
                      <Button
                        variant={demo.state.playing ? 'outline' : 'default'}
                        className={cn('flex-1 max-sm:order-3', pointAtNext && !demo.state.playing && 'ring-2 ring-primary ring-offset-2 ring-offset-background motion-safe:animate-pulse')}
                        size="sm"
                        disabled={demo.busy}
                        onClick={() => void demo.goToStep(demo.stepIndex + 1)}
                      >
                        Next
                      </Button>
                    ) : (
                      <Button className="flex-1 max-sm:order-3" size="sm" disabled={demo.busy} onClick={() => demo.selectStory(null)}>Finish</Button>
                    )}
                  </div>
                  {offScreen || !demo.state.autoFollow ? (
                    <Button variant={offScreen ? 'default' : 'outline'} size="sm" className="mt-2 w-full" disabled={demo.busy} onClick={() => void demo.goToScreen()}>
                      Go to this step's screen
                    </Button>
                  ) : null}
                  {pointAtNext && !demo.state.playing ? <p className="mt-2 text-xs text-muted-foreground" role="status">Done here? Tap <b className="text-foreground">Next</b> for the next step.</p> : null}
                  <label className={cn('mt-3 flex items-center justify-between gap-3 text-xs', phoneHidden)}>
                    <span>Follow each step (switch account and open the screen)</span>
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--primary)]"
                      checked={demo.state.autoFollow}
                      onChange={(event) => demo.setAutoFollow(event.target.checked)}
                    />
                  </label>
                </>
              )}
            </div>
          ) : null}
        </div>

        <details className={cn('mt-4 border-t pt-3', phoneHidden)}>
          <summary className="cursor-pointer text-xs font-medium">What each control does</summary>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
            <li><b className="text-foreground">An account</b>: signs you in as that person and opens their home screen. No password; the page loads again.</li>
            <li><b className="text-foreground">A story</b>: one of the shop's user stories. Start opens its first screen; Next switches to the right account and screen each time and says what to tap and what to explain. The cursor points at what to tap; when you tap it, the step moves on.</li>
            <li><b className="text-foreground">Play</b>: the demo runs by itself. The cursor taps and types each step, waits the time it takes to read the "Why" and goes on, switching accounts. Pause stops it where it is; 0.5×, 1× and 2× set the pace.</li>
            <li><b className="text-foreground">Changes data</b>: that step creates or changes something. {DEMO_REBUILD}</li>
            {DEMO_HOSTED ? <li>Everyone who opens this demo shares the same made-up data, so a step someone else already did may look different.</li> : <li>Only on this machine: the panel exists in local builds and needs the demo server (<code>npm run start:demo</code>).</li>}
          </ul>
        </details>

        <div className={cn('mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-3', phoneHidden)}>
          <button type="button" className={TEXT_LINK} disabled={demo.busy} onClick={() => void demo.backToManager()}>
            Back to the Manager dashboard
          </button>
          <span aria-hidden="true" className="text-muted-foreground">·</span>
          {confirmLeave ? (
            <span className="flex items-center gap-2 text-xs">
              Turn demo mode off? You can turn it on again from your profile menu.
              <Button size="sm" variant="outline" onClick={() => demo.setEnabled(false)}>Turn off</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmLeave(false)}>Keep</Button>
            </span>
          ) : (
            <button type="button" className={TEXT_LINK} onClick={() => setConfirmLeave(true)}>
              Turn demo mode off
            </button>
          )}
        </div>
        <p className={cn('mt-1 text-[11px] text-muted-foreground', phoneHidden)}>Data stays as it is. {DEMO_REBUILD}</p>
        {castMemberByEmail(user.email) ? null : (
          <p className="mt-2 text-xs text-muted-foreground">{user.email} is not one of the demo accounts.</p>
        )}
      </div>
    </div>
  );
}
