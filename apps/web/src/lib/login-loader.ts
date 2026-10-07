/**
 * The animated Lightning loader before the sign-in screen (owner request, 2026-10-06). One cycle of
 * `public/lightning-loader.svg` is 3.4 s: the bolt draws, the letters land, the shine passes and the logo fades
 * out (88–96%). The loader plays the whole cycle, counted from when the logo has loaded (that is when its
 * animation starts), and then the navy fades away.
 */
export const LOGIN_LOADER_SEEN_KEY = 'ltl_login_loader_seen';
/** One full cycle of the SVG animation. */
export const LOGIN_LOADER_MS = 3_400;
/** If the logo never loads, the sign-in screen still shows. */
export const LOGIN_LOADER_MAX_WAIT_MS = 6_000;
/** Reduced motion: the logo is still, so a short look is enough. */
export const LOGIN_LOADER_REDUCED_MS = 900;
export const LOGIN_LOADER_FADE_MS = 300;

/**
 * How long the loader shows, or 0 to skip it. Once per browser session (it does not replay after a sign-out);
 * never under automation (the e2e suite signs in hundreds of times); `?loader=1` forces it, `?loader=0` skips it.
 */
export function loginLoaderDuration(input: { param: string | null; seen: boolean; webdriver: boolean; reducedMotion: boolean }) {
  if (input.param === '0') return 0;
  if (input.param !== '1' && (input.seen || input.webdriver)) return 0;
  return input.reducedMotion ? LOGIN_LOADER_REDUCED_MS : LOGIN_LOADER_MS;
}
