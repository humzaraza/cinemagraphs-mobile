import { Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors } from '../../constants/theme';
import { EyeIcon, EyeOffIcon } from '../icons/EyeIcons';

interface BlindModeToggleProps {
  blind: boolean;
  onToggle: () => void;
}

/**
 * Third action circle in the backdrop row. 44pt tap target to meet
 * the Apple HIG minimum. Eye icon when off (default gold tint), inverted
 * EyeOff over a gold fill when on. Fires a light haptic on tap before
 * delegating to the parent's onToggle (parent owns the server PUT +
 * optimistic state).
 */
export function BlindModeToggle({ blind, onToggle }: BlindModeToggleProps) {
  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onToggle();
  }

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.circle, blind && styles.circleActive]}
      accessibilityRole="button"
      accessibilityLabel={
        blind
          ? 'Blind mode, on. Double-tap to show score.'
          : 'Blind mode, off. Double-tap to hide score.'
      }
      accessibilityState={{ selected: blind }}
    >
      {blind ? (
        <EyeOffIcon color={colors.background} size={18} />
      ) : (
        <EyeIcon color={colors.gold} size={18} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(200,169,81,0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
});
