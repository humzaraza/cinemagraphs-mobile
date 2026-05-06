// Banner gradient presets for the Profile header (PR 1a).
//
// PR 1a is gradient-only. PR 1b will add a 'photo' banner type.
// MockUser.bannerType is the discriminant; for now it is always 'gradient'
// and bannerValue is one of BANNER_PRESET_KEYS.
//
// Each preset stacks 1-3 SVG radial blobs over a base linear gradient.
// Render via BannerGradient (src/components/BannerGradient.tsx).

export const BANNER_PRESET_KEYS = [
  'midnight',
  'ember',
  'ocean',
  'dusk',
  'forest',
  'gold',
  'rose',
  'steel',
] as const;

export type BannerPresetKey = (typeof BANNER_PRESET_KEYS)[number];

export const BANNER_DEFAULT_KEY: BannerPresetKey = 'midnight';

type AtLeastTwo<T> = readonly [T, T, ...T[]];

export interface BannerRadial {
  cx: number;        // 0..1, horizontal center as fraction of width
  cy: number;        // 0..1, vertical center as fraction of height
  color: string;     // 'rgb(r,g,b)' or '#rrggbb'
  alpha: number;     // 0..1, peak alpha at center
  fadeAt: number;    // 0..1, position along the ray where alpha reaches 0
}

export interface BannerLinearBase {
  // expo-linear-gradient start/end in box coords (0..1).
  // For a CSS 135deg gradient, use start={x:0,y:0} end={x:1,y:1}.
  start: { x: number; y: number };
  end: { x: number; y: number };
  colors: AtLeastTwo<string>;
  locations: AtLeastTwo<number>;
}

export interface BannerPreset {
  key: BannerPresetKey;
  label: string;
  base: BannerLinearBase;
  radials: BannerRadial[];
}

const DIAG_135: Pick<BannerLinearBase, 'start' | 'end'> = {
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

export const BANNER_PRESETS: Record<BannerPresetKey, BannerPreset> = {
  midnight: {
    key: 'midnight',
    label: 'Midnight',
    base: {
      ...DIAG_135,
      colors: ['#1a1f3a', '#0d1224', '#0a0f1f'],
      locations: [0, 0.5, 1],
    },
    radials: [
      { cx: 0.25, cy: 0.30, color: 'rgb(45,90,130)',  alpha: 0.55, fadeAt: 0.55 },
      { cx: 0.75, cy: 0.70, color: 'rgb(120,50,100)', alpha: 0.40, fadeAt: 0.55 },
    ],
  },
  ember: {
    key: 'ember',
    label: 'Ember',
    base: {
      ...DIAG_135,
      colors: ['#2a1410', '#1a0a08', '#0d0604'],
      locations: [0, 0.6, 1],
    },
    radials: [
      { cx: 0.30, cy: 0.30, color: 'rgb(220,90,40)', alpha: 0.55, fadeAt: 0.55 },
      { cx: 0.70, cy: 0.70, color: 'rgb(180,40,30)', alpha: 0.45, fadeAt: 0.55 },
    ],
  },
  ocean: {
    key: 'ocean',
    label: 'Ocean',
    base: {
      ...DIAG_135,
      colors: ['#0d1a2a', '#08141f', '#050a14'],
      locations: [0, 0.6, 1],
    },
    radials: [
      { cx: 0.25, cy: 0.30, color: 'rgb(40,120,180)', alpha: 0.55, fadeAt: 0.55 },
      { cx: 0.75, cy: 0.70, color: 'rgb(60,160,200)', alpha: 0.40, fadeAt: 0.55 },
    ],
  },
  dusk: {
    key: 'dusk',
    label: 'Dusk',
    base: {
      ...DIAG_135,
      colors: ['#1f0d2a', '#15081f', '#0a0414'],
      locations: [0, 0.6, 1],
    },
    radials: [
      { cx: 0.25, cy: 0.30, color: 'rgb(140,80,200)', alpha: 0.50, fadeAt: 0.55 },
      { cx: 0.75, cy: 0.70, color: 'rgb(180,80,120)', alpha: 0.45, fadeAt: 0.55 },
    ],
  },
  forest: {
    key: 'forest',
    label: 'Forest',
    base: {
      ...DIAG_135,
      colors: ['#0d1f1a', '#08140f', '#050d08'],
      locations: [0, 0.6, 1],
    },
    radials: [
      { cx: 0.25, cy: 0.35, color: 'rgb(40,130,95)',  alpha: 0.50, fadeAt: 0.55 },
      { cx: 0.75, cy: 0.65, color: 'rgb(70,160,110)', alpha: 0.40, fadeAt: 0.55 },
    ],
  },
  gold: {
    key: 'gold',
    label: 'Gold',
    base: {
      ...DIAG_135,
      colors: ['#2a1c0a', '#1a1006', '#0d0804'],
      locations: [0, 0.6, 1],
    },
    radials: [
      { cx: 0.25, cy: 0.30, color: 'rgb(200,160,80)',  alpha: 0.50, fadeAt: 0.55 },
      { cx: 0.75, cy: 0.70, color: 'rgb(200,100,120)', alpha: 0.40, fadeAt: 0.55 },
    ],
  },
  rose: {
    key: 'rose',
    label: 'Rose',
    base: {
      ...DIAG_135,
      colors: ['#2a1018', '#1a0810', '#0a0a14'],
      locations: [0, 0.6, 1],
    },
    radials: [
      { cx: 0.25, cy: 0.30, color: 'rgb(220,140,160)', alpha: 0.50, fadeAt: 0.55 },
      { cx: 0.75, cy: 0.70, color: 'rgb(180,40,60)',   alpha: 0.45, fadeAt: 0.55 },
    ],
  },
  steel: {
    key: 'steel',
    label: 'Steel',
    base: {
      ...DIAG_135,
      colors: ['#1a2028', '#10141a', '#080b10'],
      locations: [0, 0.6, 1],
    },
    radials: [
      { cx: 0.30, cy: 0.30, color: 'rgb(120,140,160)', alpha: 0.30, fadeAt: 0.55 },
      { cx: 0.70, cy: 0.70, color: 'rgb(60,180,200)',  alpha: 0.30, fadeAt: 0.55 },
    ],
  },
};

export function getBannerPreset(key: string | null | undefined): BannerPreset {
  if (key && (BANNER_PRESET_KEYS as readonly string[]).includes(key)) {
    return BANNER_PRESETS[key as BannerPresetKey];
  }
  return BANNER_PRESETS[BANNER_DEFAULT_KEY];
}

export function isBannerPresetKey(key: string | null | undefined): key is BannerPresetKey {
  return !!key && (BANNER_PRESET_KEYS as readonly string[]).includes(key);
}
