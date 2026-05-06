import { describe, it, expect } from 'vitest';
import {
  BANNER_PRESETS,
  BANNER_PRESET_KEYS,
  BANNER_DEFAULT_KEY,
  getBannerPreset,
  isBannerPresetKey,
} from './bannerPresets';

describe('bannerPresets', () => {
  it('exposes the locked 8-key tuple in the agreed order', () => {
    expect(BANNER_PRESET_KEYS).toEqual([
      'midnight',
      'ember',
      'ocean',
      'dusk',
      'forest',
      'gold',
      'rose',
      'steel',
    ]);
    expect(new Set(BANNER_PRESET_KEYS).size).toBe(8);
  });

  it('every key in BANNER_PRESET_KEYS resolves to a matching preset', () => {
    for (const key of BANNER_PRESET_KEYS) {
      const preset = BANNER_PRESETS[key];
      expect(preset).toBeDefined();
      expect(preset.key).toBe(key);
      expect(preset.label.length).toBeGreaterThan(0);
    }
  });

  it('each preset has at least one radial and a 2+ stop linear base', () => {
    for (const key of BANNER_PRESET_KEYS) {
      const preset = BANNER_PRESETS[key];
      expect(preset.radials.length).toBeGreaterThan(0);
      expect(preset.base.colors.length).toBeGreaterThanOrEqual(2);
      expect(preset.base.colors.length).toBe(preset.base.locations.length);
    }
  });

  it('radial alpha and fadeAt are within bounds', () => {
    for (const key of BANNER_PRESET_KEYS) {
      for (const r of BANNER_PRESETS[key].radials) {
        expect(r.alpha).toBeGreaterThan(0);
        expect(r.alpha).toBeLessThanOrEqual(1);
        expect(r.fadeAt).toBeGreaterThan(0);
        expect(r.fadeAt).toBeLessThanOrEqual(1);
        expect(r.cx).toBeGreaterThanOrEqual(0);
        expect(r.cx).toBeLessThanOrEqual(1);
        expect(r.cy).toBeGreaterThanOrEqual(0);
        expect(r.cy).toBeLessThanOrEqual(1);
      }
    }
  });

  it('linear base locations are ascending and within [0,1]', () => {
    for (const key of BANNER_PRESET_KEYS) {
      const locs = BANNER_PRESETS[key].base.locations;
      for (let i = 0; i < locs.length; i++) {
        expect(locs[i]).toBeGreaterThanOrEqual(0);
        expect(locs[i]).toBeLessThanOrEqual(1);
        if (i > 0) expect(locs[i]).toBeGreaterThanOrEqual(locs[i - 1]);
      }
    }
  });

  it('getBannerPreset returns the requested preset for a known key', () => {
    expect(getBannerPreset('ember').key).toBe('ember');
    expect(getBannerPreset('midnight').key).toBe('midnight');
    expect(getBannerPreset('rose').key).toBe('rose');
    expect(getBannerPreset('steel').key).toBe('steel');
  });

  it('getBannerPreset falls back to the default for unknown / null / empty input', () => {
    expect(getBannerPreset('unknown').key).toBe(BANNER_DEFAULT_KEY);
    expect(getBannerPreset('').key).toBe(BANNER_DEFAULT_KEY);
    expect(getBannerPreset(null).key).toBe(BANNER_DEFAULT_KEY);
    expect(getBannerPreset(undefined).key).toBe(BANNER_DEFAULT_KEY);
  });

  it('isBannerPresetKey narrows correctly', () => {
    expect(isBannerPresetKey('midnight')).toBe(true);
    expect(isBannerPresetKey('ember')).toBe(true);
    expect(isBannerPresetKey('not-a-key')).toBe(false);
    expect(isBannerPresetKey('')).toBe(false);
    expect(isBannerPresetKey(null)).toBe(false);
    expect(isBannerPresetKey(undefined)).toBe(false);
  });

  it('BANNER_DEFAULT_KEY points at a real preset', () => {
    expect(BANNER_PRESETS[BANNER_DEFAULT_KEY]).toBeDefined();
    expect(BANNER_PRESET_KEYS).toContain(BANNER_DEFAULT_KEY);
  });
});
