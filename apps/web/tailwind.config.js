/**
 * R9 (2026-10-06): the theme colors are full colors in CSS variables (`--primary: oklch(...)`), so Tailwind
 * cannot add an opacity to them and used to drop classes like `bg-primary/10` without a word. Mixing the
 * variable with `transparent` gives the opacity back: `bg-primary/10` is 10 % primary, `bg-primary` is 100 %.
 */
const themed = (name) => `color-mix(in oklch, var(--${name}) calc(<alpha-value> * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: themed('background'),
        foreground: themed('foreground'),
        card: themed('card'),
        'card-foreground': themed('card-foreground'),
        popover: themed('popover'),
        'popover-foreground': themed('popover-foreground'),
        primary: themed('primary'),
        'primary-foreground': themed('primary-foreground'),
        secondary: themed('secondary'),
        'secondary-foreground': themed('secondary-foreground'),
        muted: themed('muted'),
        'muted-foreground': themed('muted-foreground'),
        accent: themed('accent'),
        'accent-foreground': themed('accent-foreground'),
        destructive: themed('destructive'),
        'destructive-foreground': themed('destructive-foreground'),
        // Destructive text on page, card, or a destructive/10 tint; readable in both themes (LTR-166).
        'destructive-text': themed('destructive-text'),
        border: themed('border'),
        input: themed('input'),
        ring: themed('ring'),
        success: themed('success'),
        warning: themed('warning'),
        'warning-foreground': themed('warning-foreground'),
        'warning-surface': themed('warning-surface'),
        // R6: a step below the card (table headers, folded groups).
        sunken: themed('sunken'),
        shop: {
          bg: 'oklch(var(--shop-bg) / <alpha-value>)',
          panel: 'oklch(var(--shop-panel) / <alpha-value>)',
          border: 'oklch(var(--shop-border) / <alpha-value>)',
          accent: 'oklch(var(--shop-accent) / <alpha-value>)',
          accentDark: 'oklch(var(--shop-accent-dark) / <alpha-value>)',
          muted: 'oklch(var(--shop-muted) / <alpha-value>)',
          danger: 'oklch(var(--shop-danger) / <alpha-value>)',
          success: 'oklch(var(--shop-success) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      boxShadow: {
        soft: 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
};
