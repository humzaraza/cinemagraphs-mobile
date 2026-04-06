import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, spacing, borderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/lib/auth';

const screenWidth = Dimensions.get('window').width;

function DashedLine() {
  const lineWidth = screenWidth * 0.6;
  const dashWidth = 6;
  const gapWidth = 4;
  const dashCount = Math.floor((lineWidth + gapWidth) / (dashWidth + gapWidth));

  return (
    <View style={[dashedStyles.container, { width: lineWidth }]}>
      {Array.from({ length: dashCount }).map((_, i) => (
        <View
          key={i}
          style={[
            dashedStyles.dash,
            { width: dashWidth, marginRight: i < dashCount - 1 ? gapWidth : 0 },
          ]}
        />
      ))}
    </View>
  );
}

const dashedStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
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
        <View style={styles.logoGroup}>
          <Text style={styles.logo}>Cinemagraphs</Text>
          <DashedLine />
          <Text style={styles.tagline}>movie reviews visualized</Text>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <Pressable
          style={({ pressed }) => [styles.googleButton, pressed && styles.buttonPressed]}
        >
          <AntDesign name="google" size={18} color="#4285F4" style={styles.buttonIcon} />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.appleButton, pressed && styles.buttonPressed]}
        >
          <Ionicons name="logo-apple" size={20} color="#FFFFFF" style={styles.buttonIcon} />
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
          <Ionicons name="mail-outline" size={18} color={colors.gold} style={styles.buttonIcon} />
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
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  topSection: {
    flex: 0.45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoGroup: {
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
    flex: 0.55,
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  buttonIcon: {
    marginRight: 10,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: '#1A1A1A',
  },
  appleButton: {
    backgroundColor: '#000000',
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  appleButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  emailButtonText: {
    fontFamily: fonts.bodyMedium,
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
