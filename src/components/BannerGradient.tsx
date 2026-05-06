import React, { useId } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import {
  getBannerPreset,
  type BannerPresetKey,
} from '../constants/bannerPresets';

interface BannerGradientProps {
  presetKey: BannerPresetKey | string | null | undefined;
  width: number;
  height: number;
  // Bottom legibility scrim (fades to background). Default true for the
  // profile banner where the avatar overlaps; turn off for picker swatches.
  showScrim?: boolean;
  // Children render above the gradient (e.g. the pen icon).
  children?: React.ReactNode;
  testID?: string;
}

const SCRIM_COLORS = ['rgba(13,13,26,0)', 'rgba(13,13,26,0.4)', 'rgba(13,13,26,1)'] as const;
const SCRIM_LOCATIONS = [0, 0.7, 1] as const;

export default function BannerGradient({
  presetKey,
  width,
  height,
  showScrim = true,
  children,
  testID,
}: BannerGradientProps) {
  const preset = getBannerPreset(presetKey);

  // Per-instance id prefix so radial-gradient defs do not collide when
  // multiple BannerGradients render in the same SVG document
  // (react-native-web case; native is already isolated per-Svg).
  const rawId = useId();
  const baseId = `bg${rawId.replace(/[^a-zA-Z0-9]/g, '')}${preset.key}`;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { width, height }]}
      testID={testID}
    >
      <LinearGradient
        colors={preset.base.colors}
        locations={preset.base.locations}
        start={preset.base.start}
        end={preset.base.end}
        style={StyleSheet.absoluteFill}
      />

      {preset.radials.length > 0 && (
        <Svg
          width={width}
          height={height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            {preset.radials.map((r, i) => {
              const rx = Math.max(r.cx, 1 - r.cx);
              const ry = Math.max(r.cy, 1 - r.cy);
              const id = `${baseId}r${i}`;
              return (
                <RadialGradient
                  key={id}
                  id={id}
                  cx={`${r.cx * 100}%`}
                  cy={`${r.cy * 100}%`}
                  rx={`${rx * 100}%`}
                  ry={`${ry * 100}%`}
                  fx={`${r.cx * 100}%`}
                  fy={`${r.cy * 100}%`}
                  gradientUnits="objectBoundingBox"
                >
                  <Stop offset="0%" stopColor={r.color} stopOpacity={r.alpha} />
                  <Stop
                    offset={`${Math.round(r.fadeAt * 100)}%`}
                    stopColor={r.color}
                    stopOpacity={0}
                  />
                </RadialGradient>
              );
            })}
          </Defs>
          {preset.radials.map((_, i) => {
            const id = `${baseId}r${i}`;
            return (
              <Rect
                key={id}
                x={0}
                y={0}
                width={width}
                height={height}
                fill={`url(#${id})`}
              />
            );
          })}
        </Svg>
      )}

      {showScrim && (
        <LinearGradient
          colors={SCRIM_COLORS}
          locations={SCRIM_LOCATIONS}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.scrim, { height: height * 0.6 }]}
          pointerEvents="none"
        />
      )}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    overflow: 'hidden',
  },
  scrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
