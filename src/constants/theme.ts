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
