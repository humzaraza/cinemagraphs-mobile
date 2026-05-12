export const colors = {
  background: '#0D0D1A',
  gold: '#C8A951',
  teal: '#2DD4A8',
  ivory: '#F5F0E1',
  positiveGreen: '#00E676',
  negativeRed: '#E24B4A',

  // Derived
  cardBorder: 'rgba(200,169,81,0.12)',
  cardBackground: 'rgba(245,240,225,0.04)',
  textPrimary: '#F5F0E1',
  textSecondary: 'rgba(245,240,225,0.5)',
  textTertiary: 'rgba(245,240,225,0.3)',
  textMuted: 'rgba(245,240,225,0.15)',

  // Tab bar
  tabBarBackground: 'rgba(13,13,26,0.95)',
  tabBarBorder: 'rgba(200,169,81,0.15)',
  tabActive: '#C8A951',
  tabInactive: 'rgba(255,255,255,0.35)',

  // Dashed midline
  dashedLine: 'rgba(255,255,255,0.08)',

  // Input fields
  inputBackground: 'rgba(245,240,225,0.06)',
  inputBorder: 'rgba(200,169,81,0.15)',

  // Subtle white border (mockup hairline dividers at 0.04 alpha)
  borderSubtle: 'rgba(255,255,255,0.04)',
  // Gold glow ring around selected mosaic blocks
  goldHalo: 'rgba(200,169,81,0.15)',

  // Accumulation band (translucent overlay strip in onboarding)
  bandBackground: 'rgba(13,13,26,0.6)',
  bandBorder: 'rgba(200,169,81,0.1)',
  // Tiny uppercase eyebrow labels (e.g., the band's "YOUR ERAS")
  labelGold: 'rgba(200,169,81,0.6)',
} as const;

export const fonts = {
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemiBold: 'DMSans_600SemiBold',
  bodyBold: 'DMSans_700Bold',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  pill: 16,
  full: 9999,
} as const;

// Button-state tokens. Consumed inline by auth screens (PR-B) and by any
// future shared Button extraction. Three variants, each with its valid
// states. Loading text is rendered invisible by the consumer; the spinner
// color is provided so it lives over the (hidden) label area.
export const buttonStates = {
  primary: {
    default: { bg: '#C8A951', text: '#0D0D1A' },
    pressed: { bg: '#C8A951', text: '#0D0D1A', scale: 0.98 },
    disabled: { bg: 'rgba(200,169,81,0.3)', text: 'rgba(245,240,225,0.5)' },
    loading: { bg: 'rgba(200,169,81,0.3)', spinner: '#F5F0E1' },
  },
  secondary: {
    default: { bg: 'transparent', border: 'rgba(245,240,225,0.3)', text: '#F5F0E1' },
    pressed: { bg: 'rgba(245,240,225,0.05)', border: 'rgba(245,240,225,0.5)', text: '#F5F0E1' },
    disabled: { bg: 'transparent', border: 'rgba(245,240,225,0.1)', text: 'rgba(245,240,225,0.3)' },
  },
  tertiary: {
    default: { text: '#C8A951' },
    pressed: { text: 'rgba(200,169,81,0.7)' },
    disabled: { text: 'rgba(200,169,81,0.3)' },
  },
} as const;
