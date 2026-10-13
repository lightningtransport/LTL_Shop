import { describe, expect, it } from 'vitest';
import { playActions } from './autoplay';
import { DEMO_CAST, castMember } from './cast';
import { DEMO_FLOW, DEMO_JOB_IDS, DEMO_STORIES, findDemoStory, storyChapters } from './scripts';
import { spotlightPhase } from './spotlight';

const KNOWN_PREFIXES = ['/admin', '/mechanic/standard', '/mechanic/pm', '/qc', '/work-orders', '/trucks'];

const ALLOWED_PREFIXES: Record<string, string[]> = {
  MS: ['/admin', '/qc'],
  AS: ['/admin', '/qc', '/mechanic'],
  MG1: ['/mechanic/standard', '/work-orders', '/trucks'],
  MG2: ['/mechanic/standard', '/work-orders', '/trucks'],
  MG3: ['/mechanic/standard', '/work-orders', '/trucks'],
  MA: ['/mechanic/standard', '/work-orders', '/trucks'],
  MD: ['/mechanic/standard', '/work-orders', '/trucks'],
  MPM: ['/mechanic/pm', '/work-orders', '/trucks'],
  QC1: ['/qc'],
  QC2: ['/qc'],
};

function routePrefix(target: (typeof DEMO_STORIES)[number]['steps'][number]['target']): string {
  switch (target.kind) {
    case 'path': return target.path;
    case 'adminTruck':
    case 'adminWorkOrder': return '/admin';
    case 'workOrder': return '/work-orders';
    case 'truckHistory': return '/trucks';
  }
}

describe('demo stories (D36)', () => {
  it('covers the 23 stories of USER_FLOWS once each, in its order', () => {
    const ids = DEMO_STORIES.map((story) => story.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      'HU-M1', 'HU-M2', 'HU-M3', 'HU-M4', 'HU-M5', 'HU-M6', 'HU-M7', 'HU-M8', 'HU-M9', 'HU-M10', 'HU-M11', 'HU-M12', 'HU-M13',
      'HU-ME1', 'HU-ME2', 'HU-ME3', 'HU-ME4', 'HU-ME5', 'HU-ME6', 'HU-PM1', 'HU-QC1', 'HU-A1', 'HU-A2',
    ]);
    expect(findDemoStory('HU-M4')?.steps.length).toBeGreaterThan(0);
    expect(findDemoStory('nope')).toBeNull();
  });

  it('gives every job to be done at least one story', () => {
    for (const job of DEMO_JOB_IDS) {
      expect(DEMO_STORIES.some((story) => story.jtbd === job), job).toBe(true);
    }
  });

  it('only uses cast members, on screens their capabilities allow', () => {
    for (const story of DEMO_STORIES) {
      expect(story.steps.length, story.id).toBeGreaterThan(0);
      for (const step of story.steps) {
        expect(DEMO_CAST.some((member) => member.key === step.user), `${story.id}: ${step.user}`).toBe(true);
        castMember(step.user);
        const prefix = routePrefix(step.target);
        expect(KNOWN_PREFIXES.some((known) => prefix.startsWith(known)), `${story.id}: ${prefix}`).toBe(true);
        expect(ALLOWED_PREFIXES[step.user].some((allowed) => prefix.startsWith(allowed)), `${story.id} · ${step.user} → ${prefix}`).toBe(true);
        expect(step.title.length, story.id).toBeGreaterThan(0);
        expect(step.do.length, story.id).toBeGreaterThan(0);
      }
    }
  });

  it('names stories in plain words, grouped by who does them', () => {
    for (const story of DEMO_STORIES) {
      expect(story.title, story.id).not.toMatch(/HU-|J\d/);
      expect(['MS', 'Mechanics', 'MPM', 'QC', 'AS']).toContain(story.who);
    }
  });

  it('has a demo flow with chapters that visits every account and reuses rehearsed steps', () => {
    const chapters = storyChapters(DEMO_FLOW);
    expect(chapters.length).toBe(15);
    expect(DEMO_FLOW.steps.length).toBe(56);
    for (const chapter of chapters) expect(chapter.to, chapter.title).toBeGreaterThanOrEqual(chapter.from);
    const users = new Set(DEMO_FLOW.steps.map((step) => step.user));
    for (const member of DEMO_CAST) expect(users.has(member.key), member.key).toBe(true);
    for (const step of DEMO_FLOW.steps) {
      expect(step.chapter, step.title).toBeTruthy();
      expect(ALLOWED_PREFIXES[step.user].some((allowed) => routePrefix(step.target).startsWith(allowed)), `${step.user} → ${step.title}`).toBe(true);
    }
    expect(findDemoStory('FLOW')).toBe(DEMO_FLOW);
    expect(DEMO_STORIES.some((story) => story.id === 'FLOW')).toBe(false);
  });

  it('lights up something on every step of the demo flow (D39, DP2)', () => {
    DEMO_FLOW.steps.forEach((step, index) => {
      for (let phase = 0, light = spotlightPhase(step.spotlight, 0); light; phase += 1, light = spotlightPhase(step.spotlight, phase)) {
        expect(light.text || light.selector, `step ${index + 1} · ${step.title}`).toBeTruthy();
        expect(light.hint.length, `step ${index + 1} · ${step.title}`).toBeGreaterThan(0);
      }
      expect(step.spotlight, `step ${index + 1} · ${step.title}`).toBeDefined();
    });
  });

  it('walks a two-tap light one tap at a time', () => {
    const light = { text: 'Resolve', hint: 'a', then: { text: 'Confirm resolve', hint: 'b' } };
    expect(spotlightPhase(light, 0)?.text).toBe('Resolve');
    expect(spotlightPhase(light, 1)?.text).toBe('Confirm resolve');
    expect(spotlightPhase(light, 2)).toBeNull();
    expect(spotlightPhase(undefined, 0)).toBeNull();
  });

  it('names the demo trucks of DEMO.md only', () => {
    const demoTrucks = new Set(['601', '602', '603', '604', '605', '606', '607', '608', '609', '610', '611', '612', '613', '614', '615', '616', '617', '905', '922', '931', '944', '957', '968', '973', '986', '991']);
    for (const story of DEMO_STORIES) {
      for (const step of story.steps) {
        if (step.target.kind !== 'path') expect(demoTrucks.has(step.target.unit), `${story.id}: ${step.target.unit}`).toBe(true);
      }
      for (const unit of story.trucks) expect(demoTrucks.has(unit), `${story.id}: ${unit}`).toBe(true);
    }
  });

  it('gives Play something to do on every step of the demo flow (D40, DA3)', () => {
    DEMO_FLOW.steps.forEach((step, index) => {
      const label = `step ${index + 1} · ${step.title}`;
      const actions = playActions(step);
      expect(actions.length, label).toBeGreaterThan(0);
      for (const action of actions) {
        if (action.do === 'wait' || action.do === 'key') continue;
        expect(action.at.text || action.at.selector || action.at.label, label).toBeTruthy();
        if (action.do === 'type') expect(action.text.length, label).toBeGreaterThan(0);
      }
      // A step that changes data does something; only a step to look at points without tapping.
      if (step.mutates) expect(step.look, label).not.toBe(true);
    });
  });
});
