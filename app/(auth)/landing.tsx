import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, fonts, spacing, borderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/lib/auth';

function DashedLine() {
  const dashCount = 8;
  const dashWidth = 5;
  const gapWidth = 3;
  const totalWidth = dashCount * dashWidth + (dashCount - 1) * gapWidth;

  return (
    <View style={[dashedStyles.container, { width: totalWidth }]}>
      {Array.from({ length: dashCount }).map((_, i) => (
        <View
          key={i}
          style={[dashedStyles.dash, { width: dashWidth, marginRight: i < dashCount - 1 ? gapWidth : 0 }]}
        />
      ))}
    </View>
  );
}

const dashedStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dash: {
    height: 1,
    backgroundColor: 'rgba(200,169,81,0.4)',
  },
});

export default function LandingScreen() {
  const { signIn } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Text style={styles.logo}>Cinemagraphs</Text>
        <DashedLine />
        <Text style={styles.tagline}>movie reviews visualized</Text>
      </View>

      <View style={styles.bottomSection}>
        <Pressable
          style={({ pressed }) => [styles.googleButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.appleButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.appleButtonText}>Continue with Apple</Text>
        </Pressable>

        <View style={styles.orDivider}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>or</Text>
          <View style={styles.orLine} />
        </View>

        <Pressable
          style={({ pressed }) => [styles.emailButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.emailButtonText}>Continue with email</Text>
        </Pressable>

        {__DEV__ && (
          <Pressable
            style={({ pressed }) => [styles.devSkip, pressed && styles.buttonPressed]}
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
    paddingHorizontal: spacing.xxl,
    paddingTop: 180,
    paddingBottom: 60,
  },
  topSection: {
    alignItems: 'center',
  },
  logo: {
    fontFamily: fonts.heading,
    fontSize: 28,
    color: colors.gold,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(245,240,225,0.4)',
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  bottomSection: {
    gap: spacing.md,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  googleButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: '#1A1A1A',
  },
  appleButton: {
    backgroundColor: '#000000',
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  appleButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: '#FFFFFF',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(245,240,225,0.15)',
  },
  orText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textTertiary,
    marginHorizontal: spacing.lg,
  },
  emailButton: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  emailButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
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
