import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { colors, fonts } from '../constants/theme';

const screenWidth = Dimensions.get('window').width;

function DashedLine() {
  const lineWidth = screenWidth * 0.5;
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
    marginTop: 12,
    marginBottom: 12,
  },
  dash: {
    height: 1.5,
    backgroundColor: 'rgba(200,169,81,0.4)',
  },
});

export default function LandingScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.logoGroup}>
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

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGroup: {
    alignItems: 'center',
    marginTop: -80,
  },
  logo: {
    fontFamily: fonts.bodyBold,
    fontSize: 26,
    color: colors.gold,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.4)',
    letterSpacing: 2.5,
    textAlign: 'center',
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    paddingBottom: 32,
    gap: 10,
  },
  googleButton: {
    backgroundColor: '#F5F0E1',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: '#0D0D1A',
  },
  appleButton: {
    backgroundColor: '#000000',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  appleButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: '#FFFFFF',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 2,
  },
  orLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  orText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
  },
  emailButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  emailButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.gold,
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
