/**
 * The Reserve — Design System Theme
 *
 * Design tokens transcribed directly from /design-reference:
 *   01 Foundations.pdf          — color palette, typography, spacing, radius, elevation, glass
 *   04 Icons.pdf                — iconography color + stroke conventions
 *   05 Core Components.pdf      — button/input/nav/feedback component color usage
 *   06 App Components.pdf       — map/listing/inventory/social component color usage
 *
 * This file only defines tokens — no screens or components are built here.
 */

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const colors = {
  // Core brand
  primaryNavy: '#0a1128',
  secondarySilver: '#c0c0c0',
  accentGold: '#eab308',
  background: '#050a18',

  // Neutrals & text
  white: '#ffffff',
  gray: '#a9a9a9',
  mutedGray: '#8e8e8e',
  surfaceNavy: '#121e3f',

  // Semantic
  success: '#22c55e',
  warning: '#eab308',
  danger: '#ef4444',
  info: '#a9a9a9',

  // Iconography (04 Icons.pdf) — primary icon color, monochromatic silver
  iconPrimary: '#c0c0c0',
  iconVerified: '#eab308',
  iconRating: '#eab308',
  iconSuccess: '#22c55e',
  iconError: '#ef4444',
  iconInfo: '#a9a9a9',
  iconRecent: '#a9a9a9',

  // Map & status pills (06 App Components.pdf)
  premiumPin: '#eab308',
  inStock: '#22c55e',
  outOfStock: '#ef4444',
  openNow: '#22c55e',
  closed: '#8e8e8e',
} as const;

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
  overlay: 'rgba(18, 30, 63, 0.6)',
  blurRadius: 12,
  borderColor: 'rgba(192, 192, 192, 0.2)',
};

// ---------------------------------------------------------------------------
// Asset guidelines
// ---------------------------------------------------------------------------

const assets = {
  profileImagery: {
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.3)', // #c0c0c0 @ 30% opacity
    borderRadius: radius.full,
  },
  mapSymbols: {
    activeBackground: colors.white,
    inactiveBackground: colors.surfaceNavy,
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
