import { useRef } from 'react';
import { View, StyleSheet, PanResponder, LayoutChangeEvent } from 'react-native';
import { colors } from '../constants/theme';

interface RatingSliderProps {
  value: number;
  onValueChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  trackHeight?: number;
  thumbSize?: number;
}

export default function RatingSlider({
  value,
  onValueChange,
  min = 1,
  max = 10,
  step = 0.5,
  trackHeight = 3,
  thumbSize = 12,
}: RatingSliderProps) {
  const widthRef = useRef(0);

  function clamp(v: number): number {
    const stepped = Math.round(v / step) * step;
    return Math.max(min, Math.min(max, stepped));
  }

  function valueFromX(x: number): number {
    if (widthRef.current <= 0) return value;
    const ratio = Math.max(0, Math.min(1, x / widthRef.current));
    return clamp(min + ratio * (max - min));
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        onValueChange(valueFromX(e.nativeEvent.locationX));
      },
      onPanResponderMove: (e) => {
        onValueChange(valueFromX(e.nativeEvent.locationX));
      },
    })
  ).current;

  const fraction = (value - min) / (max - min);

  return (
    <View
      style={[styles.container, { height: thumbSize, marginVertical: 2 }]}
      onLayout={(e: LayoutChangeEvent) => {
        widthRef.current = e.nativeEvent.layout.width;
      }}
      {...panResponder.panHandlers}
    >
      {/* Unfilled track */}
      <View
        style={[
          styles.track,
          {
            height: trackHeight,
            top: (thumbSize - trackHeight) / 2,
          },
        ]}
      />
      {/* Filled track */}
      <View
        style={[
          styles.trackFilled,
          {
            height: trackHeight,
            top: (thumbSize - trackHeight) / 2,
            width: `${fraction * 100}%`,
          },
        ]}
      />
      {/* Thumb */}
      <View
        style={[
          styles.thumb,
          {
            width: thumbSize,
            height: thumbSize,
            borderRadius: thumbSize / 2,
            left: `${fraction * 100}%`,
            marginLeft: -thumbSize / 2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(245,240,225,0.08)',
    borderRadius: 2,
  },
  trackFilled: {
    position: 'absolute',
    left: 0,
    backgroundColor: colors.gold,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    backgroundColor: colors.gold,
  },
});
