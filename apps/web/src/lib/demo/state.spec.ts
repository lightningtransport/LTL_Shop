import { describe, expect, it } from 'vitest';
import { DEFAULT_DEMO_STATE, DEMO_STATE_KEY, demoPanelAvailable, readDemoState, writeDemoState } from './state';

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    map,
  };
}

describe('demo state (D36)', () => {
  it('round-trips through storage and removes the key when the mode is off', () => {
    const storage = memoryStorage();
    const state = { ...DEFAULT_DEMO_STATE, enabled: true, storyId: 'HU-M4', stepIndex: 2, panelOpen: true };
    writeDemoState(state, storage);
    expect(readDemoState(storage)).toEqual(state);

    writeDemoState({ ...state, enabled: false }, storage);
    expect(storage.map.has(DEMO_STATE_KEY)).toBe(false);
    expect(readDemoState(storage)).toEqual(DEFAULT_DEMO_STATE);
  });

  it('falls back to defaults on corrupt or foreign values', () => {
    expect(readDemoState(memoryStorage({ [DEMO_STATE_KEY]: '{not json' }))).toEqual(DEFAULT_DEMO_STATE);
    expect(readDemoState(memoryStorage({ [DEMO_STATE_KEY]: '{"version":2,"enabled":true}' }))).toEqual(DEFAULT_DEMO_STATE);
    expect(readDemoState(memoryStorage({ [DEMO_STATE_KEY]: '{"version":1,"enabled":true,"stepIndex":-3,"storyId":7}' })))
      .toEqual({ ...DEFAULT_DEMO_STATE, enabled: true });
    expect(readDemoState(null)).toEqual(DEFAULT_DEMO_STATE);
  });

  it('never throws when storage is unavailable', () => {
    const broken = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    expect(readDemoState(broken)).toEqual(DEFAULT_DEMO_STATE);
    expect(() => writeDemoState({ ...DEFAULT_DEMO_STATE, enabled: true }, broken)).not.toThrow();
  });

  it('keeps the panel out of builds without Dev Login, whatever storage says', () => {
    expect(demoPanelAvailable(false, { enabled: true })).toBe(false);
    expect(demoPanelAvailable(true, { enabled: false })).toBe(false);
    expect(demoPanelAvailable(true, { enabled: true })).toBe(true);
  });
});
