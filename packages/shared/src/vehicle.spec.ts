import { describe, expect, it } from 'vitest';
import { normalizeMakeModel } from './vehicle';

describe('normalizeMakeModel (LTR-113)', () => {
  it('puts swapped fields back (277: CASCADIA / Freightliner)', () => {
    expect(normalizeMakeModel('CASCADIA', 'Freightliner')).toEqual({ make: 'Freightliner', model: 'CASCADIA' });
  });

  it('splits a Make that holds make and model (600/601: Mack Anthem)', () => {
    expect(normalizeMakeModel('Mack Anthem', null)).toEqual({ make: 'Mack', model: 'Anthem' });
    expect(normalizeMakeModel('Mack Anthem', 'anthem')).toEqual({ make: 'Mack', model: 'anthem' });
    expect(normalizeMakeModel('Western Star 49X', '')).toEqual({ make: 'Western Star', model: '49X' });
  });

  it('keeps a Make with a model inside when Model says something else', () => {
    expect(normalizeMakeModel('Mack Anthem', 'Pinnacle')).toEqual({ make: 'Mack Anthem', model: 'Pinnacle' });
  });

  it('spells a known make one way', () => {
    expect(normalizeMakeModel('FREIGHTLINER', 'Cascadia')).toEqual({ make: 'Freightliner', model: 'Cascadia' });
    expect(normalizeMakeModel('  volvo ', 'VNL  860')).toEqual({ make: 'Volvo', model: 'VNL 860' });
  });

  it('leaves what it does not know as typed', () => {
    expect(normalizeMakeModel('Tesla', 'Semi')).toEqual({ make: 'Tesla', model: 'Semi' });
    expect(normalizeMakeModel(null, null)).toEqual({ make: null, model: null });
    expect(normalizeMakeModel('', '  ')).toEqual({ make: null, model: null });
  });

  it('a known make alone in Model moves to Make', () => {
    expect(normalizeMakeModel(null, 'Kenworth')).toEqual({ make: 'Kenworth', model: null });
  });
});
