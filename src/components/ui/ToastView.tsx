import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from '../../constants/theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export type ToastVariant = 'error' | 'success';

interface ToastViewProps {
  variant: ToastVariant;
  message: string;
  exiting: boolean;
  onDismiss: () => void;
  onExitComplete: () => void;
}

const ENTER_MS = 200;
const EXIT_MS = 150;
const REDUCED_MS = 100;
const SLIDE_OFFSET = -20;

export function ToastView({
  variant,
  message,
  exiting,
  onDismiss,
  onExitComplete,
}: ToastViewProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(SLIDE_OFFSET);
  const isError = variant === 'error';

  useEffect(() => {
    if (reducedMotion) {
      translateY.value = 0;
      opacity.value = withTiming(1, { duration: REDUCED_MS });
    } else {
      const easing = Easing.out(Easing.cubic);
      translateY.value = withTiming(0, { duration: ENTER_MS, easing });
      opacity.value = withTiming(1, { duration: ENTER_MS, easing });
    }
    // Enter runs once on mount; reducedMotion change mid-toast is ignored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!exiting) return;
    if (reducedMotion) {
      opacity.value = withTiming(0, { duration: REDUCED_MS }, (finished) => {
        if (finished) runOnJS(onExitComplete)();
      });
    } else {
      const easing = Easing.in(Easing.cubic);
      translateY.value = withTiming(SLIDE_OFFSET, {
        duration: EXIT_MS,
        easing,
      });
      opacity.value = withTiming(0, { duration: EXIT_MS, easing }, (finished) => {
        if (finished) runOnJS(onExitComplete)();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exiting]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const fgColor = isError ? colors.ivory : colors.background;
  const bgColor = isError ? colors.negativeRed : colors.teal;

  return (
    <Animated.View
      style={[
        styles.toast,
        { top: insets.top + 8, backgroundColor: bgColor },
        animatedStyle,
      ]}
    >
      <Text style={[styles.text, { color: fgColor }]}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        hitSlop={8}
        onPress={onDismiss}
        style={styles.close}
      >
        <Text style={[styles.closeIcon, { color: fgColor }]}>✕</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
  },
  close: {
    marginLeft: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  closeIcon: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
});
