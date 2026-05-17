import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../constants/theme';

const TOOLTIP_TEXT =
  'Blind mode is on. Scores on this page are hidden. The arc still shows the shape.';

const AUTO_DISMISS_MS = 4000;

interface BlindModeTooltipProps {
  visible: boolean;
  onDismiss: () => void;
  /**
   * Vertical position of the tooltip body. Anchored to the action-circle
   * row in the backdrop — passed in by the film detail screen so the
   * tooltip can sit just below the toggle without re-measuring layout.
   */
  topInset: number;
  /**
   * Horizontal inset from the right edge. Mirrors the toggle's position
   * so the caret-style tail (rendered as a top-right corner) points at
   * the eye icon.
   */
  rightInset: number;
}

/**
 * First-encounter educational tooltip for the blind-mode toggle. The
 * parent owns the "should we show this" decision (based on
 * hasSeenBlindModeTooltip); this component just handles the appearance,
 * auto-dismiss, and tap-anywhere-to-dismiss behaviors.
 *
 * Renders a full-screen invisible overlay so any tap dismisses. The
 * tradeoff: while the tooltip is up, other interactions are swallowed.
 * Acceptable for a 4-second educational hint that fires once per user.
 */
export function BlindModeTooltip({
  visible,
  onDismiss,
  topInset,
  rightInset,
}: BlindModeTooltipProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      dismissedRef.current = false;
      opacity.setValue(0);
      scale.setValue(0.95);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 14,
        stiffness: 220,
      }),
    ]).start();

    const timeout = setTimeout(() => {
      handleDismiss();
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timeout);
    // handleDismiss is stable (uses refs) — re-running this effect
    // only on `visible` is the intended behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function handleDismiss() {
    // Guard against the auto-dismiss timer and the tap handler both
    // firing within the same animation window. Without this, two
    // simultaneous fade-outs would race and the parent's onDismiss
    // would fire twice.
    if (dismissedRef.current) return;
    dismissedRef.current = true;

    Animated.timing(opacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  }

  if (!visible) return null;

  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={handleDismiss}
      accessible={false}
    >
      <Animated.View
        style={[
          styles.tooltip,
          {
            top: topInset,
            right: rightInset,
            opacity,
            transform: [{ scale }],
          },
        ]}
        accessibilityRole="alert"
        accessibilityLabel={TOOLTIP_TEXT}
        accessibilityLiveRegion="polite"
      >
        <View style={styles.caret} />
        <Text style={styles.text}>{TOOLTIP_TEXT}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    maxWidth: 260,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(13,13,26,0.95)',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.4)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  caret: {
    position: 'absolute',
    top: -6,
    right: 18,
    width: 12,
    height: 12,
    backgroundColor: 'rgba(13,13,26,0.95)',
    borderTopWidth: 0.5,
    borderLeftWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.4)',
    transform: [{ rotate: '45deg' }],
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ivory,
  },
});
