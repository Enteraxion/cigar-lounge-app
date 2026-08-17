/**
 * Design System Theme
 *
 * Typography, spacing, radius, elevation and glass come from
 * /design-reference:
 *   01 Foundations.pdf          — typography, spacing, radius, elevation, glass
 *   04 Icons.pdf                — iconography color + stroke conventions
 *   05 Core Components.pdf      — button/input/nav/feedback component usage
 *   06 App Components.pdf       — map/listing/inventory/social component usage
 *
 * The **colour palette no longer comes from those files.** They specify the
 * original navy scheme; the palette below is black/gold/silver, taken from the
 * Lounge Locator logo and the Kiosk V1 export (design-reference/kiosk-v1/) per
 * Dr. Brinkley 2026-08-17. Where the two disagree about colour, this file
 * wins — see the note on `colors` for exactly what moved.
 *
 * This file only defines tokens — no screens or components are built here.
 */

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

/**
 * Black, gold and silver — the Lounge Locator logo's palette, confirmed by
 * Dr. Brinkley 2026-08-17 as the direction for the app ("only the theme, logo
 * and theme").
 *
 * The previous palette was navy-based, from the original design reference.
 * Silver and gold carried over unchanged in spirit; what actually moved is:
 *
 *   background   #050a18 -> #0a0a0c   navy-black  -> neutral near-black
 *   surface      #121e3f -> #18181c   clearly navy -> neutral dark gray
 *   accentGold   #eab308 -> #c8a868   yellow gold  -> warm champagne gold
 *
 * Those values are not invented: they were sampled from the Kiosk V1 design
 * export (design-reference/kiosk-v1/) so the app, the kiosk and the logo agree.
 * The old navy had a strong blue bias — its surface was rgb(16,24,56), blue
 * over three times red — and removing that bias *is* the change.
 *
 * `primaryBlack` and `surface` were `primaryNavy` and `surfaceNavy`. Renamed
 * rather than quietly repointed: a token called `surfaceNavy` holding a
 * neutral gray is the same stale-name trap that has already caused real bugs
 * in this codebase (a "few dozen lounges" comment guarding a query against a
 * collection that had grown to 8,294).
 */
const colors = {
  // Core brand
  /** Darkest ink. Used only as a foreground — text and icons sitting on gold
   * or silver — never as a page background. */
  primaryBlack: '#050506',
  secondarySilver: '#c0c0c0',
  accentGold: '#c8a868',
  background: '#0a0a0c',

  // Neutrals & text
  white: '#ffffff',
  gray: '#a9a9a9',
  mutedGray: '#8e8e8e',
  /** Cards, sheets and the tab bar — one step lighter than the background. */
  surface: '#18181c',

  // Semantic
  success: '#22c55e',
  /** Deliberately still a true yellow, not the brand gold. A warning that
   * matches the accent colour stops reading as a warning. */
  warning: '#eab308',
  danger: '#ef4444',
  info: '#a9a9a9',

  // Iconography (04 Icons.pdf) — primary icon color, monochromatic silver
  iconPrimary: '#c0c0c0',
  iconVerified: '#c8a868',
  iconRating: '#c8a868',
  iconSuccess: '#22c55e',
  iconError: '#ef4444',
  iconInfo: '#a9a9a9',
  iconRecent: '#a9a9a9',

  // Map & status pills (06 App Components.pdf)
  premiumPin: '#c8a868',
  inStock: '#22c55e',
  outOfStock: '#ef4444',
  openNow: '#22c55e',
  closed: '#8e8e8e',
} as const;

/**
 * A theme colour at partial opacity.
 *
 * Exists because the palette was previously unchangeable in practice. Screens
 * wrote translucent shades as raw literals — `rgba(5, 10, 24, 0.7)` was the
 * background at 70%, spelled out in 26 files — so changing the background
 * meant finding and rewriting every one of them, and any that were missed
 * stayed navy against a black app. 93 such literals existed when this landed.
 *
 * Takes a 6-digit hex (every token above is one) and returns an `rgba()`
 * string, so a future palette change is this file only.
 */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------
// Font family: Inter (Regular / Medium / Semibold / Bold — see assets/fonts)

const fontFamily = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
} as const;

const typography = {
  displayHeading: {
    fontFamily: fontFamily.bold,
    fontSize: 64,
    letterSpacing: 2,
  },
  headingLarge: {
    fontFamily: fontFamily.regular,
    fontSize: 36,
    letterSpacing: 0,
  },
  headingMedium: {
    fontFamily: fontFamily.semibold,
    fontSize: 24,
    letterSpacing: 0,
  },
  headingSmall: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    letterSpacing: 0,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 16,
    letterSpacing: 0,
  },
  medium: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: fontFamily.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
} as const;

// ---------------------------------------------------------------------------
// Spacing scale — strict 4pt/8pt grid
// ---------------------------------------------------------------------------

const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ---------------------------------------------------------------------------
// Radius scale
// ---------------------------------------------------------------------------

const radius = {
  small: 8, // R8
  medium: 12, // R12
  large: 16, // R16
  xl: 24, // R24
  hero: 32, // R32
  full: 9999, // Full (pill / circle)
} as const;

// ---------------------------------------------------------------------------
// Elevation (shadow styles)
// ---------------------------------------------------------------------------
// Shadow Soft — standard cards and buttons
// Shadow Deep — modals and elevated floating elements

const shadows = {
  soft: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  deep: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 8,
  },
} as const;

// ---------------------------------------------------------------------------
// Glassmorphism
// ---------------------------------------------------------------------------

const glass = {
  overlay: withAlpha(colors.surface, 0.6),
  blurRadius: 12,
  borderColor: withAlpha(colors.secondarySilver, 0.2),
};

// ---------------------------------------------------------------------------
// Asset guidelines
// ---------------------------------------------------------------------------

const assets = {
  profileImagery: {
    borderWidth: 1,
    borderColor: withAlpha(colors.secondarySilver, 0.3),
    borderRadius: radius.full,
  },
  mapSymbols: {
    activeBackground: colors.white,
    inactiveBackground: colors.surface,
  },
};

export const theme = {
  colors,
  fontFamily,
  typography,
  spacing,
  radius,
  shadows,
  glass,
  assets,
} as const;

export type Theme = typeof theme;

export default theme;
