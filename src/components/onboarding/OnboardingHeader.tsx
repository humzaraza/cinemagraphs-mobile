import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, fonts } from '../../constants/theme';

type OnboardingHeaderProps = {
  title: string;
  onSkip: () => void;
  skipLabel?: string;
};

export function OnboardingHeader({ title, onSkip, skipLabel = 'Skip' }: OnboardingHeaderProps) {
  return (
    <View>
      <View style={styles.topRow}>
        <View />
        <Pressable
          testID="onboarding-skip"
          onPress={onSkip}
          hitSlop={8}
          style={({ pressed }) => [styles.skipBase, { opacity: pressed ? 0.9 : 0.5 }]}
        >
          <Text style={styles.skipText}>{skipLabel}</Text>
        </Pressable>
      </View>
      <View style={styles.stickyPrompt}>
        <Text style={styles.title}>{title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 44,
  },
  skipBase: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  skipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ivory,
  },
  stickyPrompt: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  title: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: colors.ivory,
    letterSpacing: -0.3,
    lineHeight: 22.5,
  },
});
