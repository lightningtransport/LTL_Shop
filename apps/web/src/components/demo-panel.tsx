'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { FlaskConical, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DEMO_CAST, DEMO_CAST_GROUPS, castMember, castMemberByEmail } from '@/lib/demo/cast';
import { describeTarget } from '@/lib/demo/resolve-target';
import { DEMO_JOB_IDS, DEMO_JTBD, DEMO_STORIES } from '@/lib/demo/scripts';
import { useDemoMode } from '@/lib/demo/demo-context';
import { cn } from '@/lib/utils';
import { Badge, Button, InlineAlert, Select } from './ui';

/**
 * D36: the "Demo" panel from the proposal mockups (docs/proposals/wo-detail-redesign/mockup.html), now inside
 * the app for the local demo only. English, fixed copy: it is a presenter tool, not part of the product.
 */

const PANEL_HIDDEN_ON = ['/login', '/reset-password', '/access-denied'];

const PRESET_BUTTON =
  'flex min-h-11 flex-col items-start justify-center rounded-md border px-2 py-1.5 text-left text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 [@media(pointer:fine)]:min-h-9';
const PRESET_ACTIVE = 'border-primary bg-primary/10 text-primary';

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
  if (!demo?.available || !demo.state.panelOpen || !user) return null;
  if (PANEL_HIDDEN_ON.some((prefix) => pathname.startsWith(prefix))) return null;

  const activeEmails = new Set((demo.users ?? []).map((item) => item.email.toLowerCase()));
  const castEmails = new Set(DEMO_CAST.map((item) => item.email));
  const others = (demo.users ?? []).filter((item) => !castEmails.has(item.email.toLowerCase()));
  const current = user.email.toLowerCase();

  return (
    <div
      id="demo-panel"
      role="complementary"
      aria-label="Demo panel"
      className="fixed inset-x-3 bottom-3 z-50 max-h-[75vh] overflow-auto rounded-xl border bg-card p-4 text-sm text-card-foreground shadow-2xl sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-16 sm:w-[360px]"
      style={{ paddingBottom: 'calc(1rem + var(--app-safe-bottom))' }}
    >
      <ReservePanelSpace />
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold">Demo panel</p>
        <button
          type="button"
          onClick={() => demo.setPanelOpen(false)}
          className="grid size-8 place-items-center rounded-md hover:bg-accent"
          aria-label="Close demo panel"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      {/* Flex column so the Story block can move above the user grid (order-first) while a story is active. */}
      <div className="flex flex-col">

      {demo.error ? <InlineAlert className="mb-2">{demo.error}</InlineAlert> : null}
      {demo.usersError ? (
        <InlineAlert className="mb-2">The account list did not load. Does the API run with AUTH_DEV_BYPASS=true?</InlineAlert>
      ) : null}
      {/* With a story active the step card comes first; the user grid folds under a summary line. */}
      <details open={!demo.story} className="group">
        <summary className="mb-2 cursor-pointer list-none text-xs text-muted-foreground">
          User · signed in as {user.name}{demo.story ? ' · tap to switch by hand' : ''}
        </summary>
      {DEMO_CAST_GROUPS.map((group) => (
        <div key={group} className="mb-2">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{group}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {DEMO_CAST.filter((member) => member.group === group).map((member) => {
              const active = member.email === current;
              const known = demo.users ? activeEmails.has(member.email) : true;
              return (
                <button
                  key={member.key}
                  type="button"
                  disabled={demo.busy || active || !known}
                  aria-pressed={active}
                  onClick={() => void demo.switchTo(member.email)}
                  className={cn(PRESET_BUTTON, active && PRESET_ACTIVE)}
                  title={known ? member.hint : 'Not in the demo database'}
                >
                  <span>{member.label}</span>
                  <span className="font-normal text-muted-foreground">{known ? member.hint : 'inactive'}</span>
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
                  <span className="font-normal text-muted-foreground">{item.role}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      </details>

      <div className={demo.story ? 'order-first' : 'mt-4 border-t pt-3'}>
        <p className="mb-2 text-xs text-muted-foreground">Story · one of USER_FLOWS, step by step</p>
        <Select
          aria-label="Story"
          value={demo.story?.id ?? ''}
          onChange={(event) => void demo.selectStory(event.target.value || null)}
        >
          <option value="">None</option>
          {DEMO_JOB_IDS.map((job) => {
            const stories = DEMO_STORIES.filter((story) => story.jtbd === job);
            if (!stories.length) return null;
            return (
              <optgroup key={job} label={`${job} · ${DEMO_JTBD[job].title}`}>
                {stories.map((story) => (
                  <option key={story.id} value={story.id}>{story.id} · {story.title} ({story.steps.length} steps)</option>
                ))}
              </optgroup>
            );
          })}
          <optgroup label="Other">
            {DEMO_STORIES.filter((story) => !story.jtbd).map((story) => (
              <option key={story.id} value={story.id}>{story.id} · {story.title} ({story.steps.length} steps)</option>
            ))}
          </optgroup>
        </Select>
        {demo.story && demo.step ? (
          <div className="mt-3 rounded-lg border bg-background p-3" data-testid="demo-step">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Step {demo.stepIndex + 1} of {demo.story.steps.length} · {demo.story.role}
            </p>
            <p className="mt-1 font-semibold">{demo.step.title}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant={castMember(demo.step.user).email === current ? 'default' : 'warning'}>
                {castMember(demo.step.user).label}
              </Badge>
              <Badge variant="outline">{describeTarget(demo.step.target)}</Badge>
              {demo.step.mutates ? <Badge variant="secondary">Changes data</Badge> : null}
            </div>
            {demo.story.note && demo.stepIndex === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">{demo.story.note}</p>
            ) : null}
            <p className="mt-2"><b>Do:</b> {demo.step.do}</p>
            {demo.step.say ? <p className="mt-1 text-muted-foreground"><b className="text-foreground">Say:</b> {demo.step.say}</p> : null}
            {demo.step.expect ? <p className="mt-1 text-xs text-muted-foreground"><b>Expect:</b> {demo.step.expect}</p> : null}
            <div className="mt-3 flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={demo.busy || demo.stepIndex === 0} onClick={() => void demo.goToStep(demo.stepIndex - 1)}>
                Back
              </Button>
              {demo.stepIndex < demo.story.steps.length - 1 ? (
                <Button size="sm" disabled={demo.busy} onClick={() => void demo.goToStep(demo.stepIndex + 1)}>Next</Button>
              ) : (
                <Button size="sm" disabled={demo.busy} onClick={() => void demo.selectStory(null)}>Finish</Button>
              )}
              <Button variant="ghost" size="sm" disabled={demo.busy} onClick={() => void demo.goToScreen()}>Go to screen</Button>
            </div>
          </div>
        ) : null}
        <label className="mt-3 flex items-center justify-between gap-3 text-xs">
          <span>Switch user and screen automatically</span>
          <input
            type="checkbox"
            className="size-4 accent-[var(--primary)]"
            checked={demo.state.autoFollow}
            onChange={(event) => demo.setAutoFollow(event.target.checked)}
          />
        </label>
        {new Date().getHours() >= 17 ? (
          <p className="mt-2 text-xs text-muted-foreground">After 5 PM the day close has stopped today's clocks. Rebuild the demo in the morning.</p>
        ) : null}
      </div>

      <details className="mt-4 border-t pt-3">
        <summary className="cursor-pointer font-medium">What each button does</summary>
        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-muted-foreground">
          <li><b className="text-foreground">A user</b>: signs you in as that account and opens its home screen. No password; the page loads again.</li>
          <li><b className="text-foreground">A story</b>: one of the user stories of USER_FLOWS. Each step switches to the right user and screen (or tells you to, with auto-follow off) and says what to tap and what to explain. You tap; the app never acts by itself.</li>
          <li><b className="text-foreground">Reset demo</b>: clears the story and goes back to the Manager dashboard. It does not rebuild the data: run <code>npm run prisma:demo-local</code> for that.</li>
          <li><b className="text-foreground">Leave demo mode</b>: hides this panel and the Demo button. You stay signed in.</li>
          <li>Only on this machine: the panel needs a local build and an API with <code>AUTH_DEV_BYPASS=true</code>.</li>
        </ul>
      </details>

      <Button variant="outline" className="mt-4 w-full" disabled={demo.busy} onClick={() => void demo.resetDemo()}>
        Reset demo
      </Button>
      <button
        type="button"
        onClick={() => demo.leave()}
        className="mt-2 w-full rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        Leave demo mode
      </button>
      {castMemberByEmail(user.email) ? null : (
        <p className="mt-2 text-xs text-muted-foreground">{user.email} is not one of the demo accounts.</p>
      )}
      </div>
    </div>
  );
}
