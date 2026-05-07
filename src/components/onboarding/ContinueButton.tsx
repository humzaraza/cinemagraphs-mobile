import * as React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import { colors, fonts } from '../../constants/theme';

type ContinueButtonProps = {
  visible: boolean;
  onPress: () => void;
  label?: string;
};

const SPRING_CONFIG = { damping: 16, stiffness: 200 } as const;

export function ContinueButton({ visible, onPress, label = 'Continue' }: ContinueButtonProps) {
  const opacity = useSharedValue(visible ? 1 : 0);
  const translateY = useSharedValue(visible ? 0 : 20);

  React.useEffect(() => {
    opacity.value = withSpring(visible ? 1 : 0, SPRING_CONFIG);
    translateY.value = withSpring(visible ? 0 : 20, SPRING_CONFIG);
  }, [visible, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const handlePress = () => {
    if (!visible) return;
    onPress();
  };

  return (
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={animatedStyle}>
      <Pressable testID="continue-button" onPress={handlePress} style={styles.button}>
        <Text style={styles.label}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.background,
  },
});
