import { describe, expect, it } from 'vitest';
import { mergeWorkOrderNotes } from './work-order-notes';

describe('mergeWorkOrderNotes', () => {
  it('returns the addition when no existing notes', () => {
    expect(mergeWorkOrderNotes(null, 'Replaced pads')).toBe('Replaced pads');
    expect(mergeWorkOrderNotes('   ', 'Replaced pads')).toBe('Replaced pads');
  });

  it('keeps existing notes when the addition is empty', () => {
    expect(mergeWorkOrderNotes('Check leak', '')).toBe('Check leak');
    expect(mergeWorkOrderNotes('Check leak', '   ')).toBe('Check leak');
  });

  it('appends a finish comment without duplicating it', () => {
    expect(mergeWorkOrderNotes('Check leak', 'Replaced pads')).toBe('Check leak\n\nReplaced pads');
    expect(mergeWorkOrderNotes('Check leak\n\nReplaced pads', 'Replaced pads')).toBe(
      'Check leak\n\nReplaced pads',
    );
  });

  it('caps merged notes at 2000 characters', () => {
    const existing = 'x'.repeat(1990);
    const merged = mergeWorkOrderNotes(existing, 'finish comment');
    expect(merged.length).toBe(2000);
  });
});
