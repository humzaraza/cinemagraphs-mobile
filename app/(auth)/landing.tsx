import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, spacing, borderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/lib/auth';

export default function LandingScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Text style={styles.logo}>CINEMAGRAPHS</Text>
        <View style={styles.dashedLine} />
        <Text style={styles.tagline}>movie reviews, visualized</Text>
      </View>

      <View style={styles.bottomSection}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => router.push('/(auth)/signup')}
        >
          <Text style={styles.primaryButtonText}>Create Account</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => router.push('/(auth)/signin')}
        >
          <Text style={styles.secondaryButtonText}>Sign In</Text>
        </Pressable>

        {__DEV__ && (
          <Pressable
            style={({ pressed }) => [
              styles.devSkip,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => signIn('dev-token')}
          >
            <Text style={styles.devSkipText}>Skip to tabs</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 160,
    paddingBottom: 60,
  },
  topSection: {
    alignItems: 'center',
  },
  logo: {
    fontFamily: fonts.heading,
    fontSize: 32,
    color: colors.gold,
    letterSpacing: 4,
    textAlign: 'center',
  },
  dashedLine: {
    width: 60,
    height: 1,
    marginTop: spacing.md,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(200,169,81,0.4)',
    borderStyle: 'dashed',
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ivory,
    opacity: 0.45,
    marginTop: spacing.sm,
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  bottomSection: {
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.gold,
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.background,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.gold,
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.gold,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  devSkip: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: spacing.xs,
  },
  devSkipText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.ivory,
    opacity: 0.25,
  },
});
