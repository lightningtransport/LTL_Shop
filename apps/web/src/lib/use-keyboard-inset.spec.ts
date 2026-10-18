import { describe, expect, it } from 'vitest';
import { keyboardInset } from './use-keyboard-inset';

describe('LTR-234: how much the phone keyboard covers', () => {
  it('iPhone: the page keeps its height and the visual viewport shrinks by the keyboard', () => {
    expect(keyboardInset(844, 508, 0)).toBe(336);
  });

  it('iPhone after Safari scrolled the page to show the field: the offset counts', () => {
    expect(keyboardInset(844, 508, 120)).toBe(216);
  });

  it('Safari toolbar moving, or no keyboard: 0', () => {
    expect(keyboardInset(844, 844, 0)).toBe(0);
    expect(keyboardInset(844, 790, 0)).toBe(0);
  });

  it('Android Chrome resizes the page itself (interactive-widget): 0, never counted twice', () => {
    expect(keyboardInset(508, 508, 0)).toBe(0);
  });

  it('landscape with the keyboard', () => {
    expect(keyboardInset(390, 190, 0)).toBe(200);
  });
});
