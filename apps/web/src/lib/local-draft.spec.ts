import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { draftKeys, readDraftJson, writeDraftJson } from './local-draft';

describe('readDraftJson / writeDraftJson (LTR-293 §2)', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps a form with several fields until it is cleared', () => {
    const key = draftKeys.truckForm(null);
    writeDraftJson(key, { truckNumber: '966', make: 'Kenworth' });
    expect(readDraftJson(key)).toEqual({ truckNumber: '966', make: 'Kenworth' });
    writeDraftJson(key, null);
    expect(readDraftJson(key)).toBeNull();
  });

  it('a draft that is not JSON reads as none', () => {
    window.localStorage.setItem(draftKeys.qcFindings('wo-1'), '{not json');
    expect(readDraftJson(draftKeys.qcFindings('wo-1'))).toBeNull();
  });

  it('each truck has its own new Work Order note and its own form', () => {
    expect(draftKeys.newWorkOrderNote('t1')).not.toBe(draftKeys.newWorkOrderNote('t2'));
    expect(draftKeys.truckForm('t1')).not.toBe(draftKeys.truckForm(null));
  });
});
