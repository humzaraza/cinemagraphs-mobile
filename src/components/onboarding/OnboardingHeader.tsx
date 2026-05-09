import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, fonts } from '../../constants/theme';

type OnboardingHeaderProps = {
  title: string;
  onSkip: () => void;
  skipLabel?: string;
  helper?: string;
  onBack?: () => void;
};

export function OnboardingHeader({
  title,
  onSkip,
  skipLabel = 'Skip',
  helper,
  onBack,
}: OnboardingHeaderProps) {
  return (
    <View>
      <View style={styles.topRow}>
        {onBack ? (
          <Pressable testID="onboarding-back-chevron" onPress={onBack} hitSlop={8}>
            <Text style={styles.backChevron}>{'‹'}</Text>
          </Pressable>
        ) : (
          <View />
        )}
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
        {helper ? (
          <Text testID="onboarding-helper" style={styles.helper}>
            {helper}
          </Text>
        ) : null}
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
  backChevron: {
    fontFamily: 'DMSans_300Light',
    fontSize: 22,
    lineHeight: 22,
    color: colors.ivory,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  title: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: colors.ivory,
    letterSpacing: -0.3,
    lineHeight: 22.5,
    marginBottom: 6,
  },
  helper: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.ivory,
    opacity: 0.4,
  },
});
