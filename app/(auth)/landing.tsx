import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import * as AppleAuthentication from 'expo-apple-authentication';
import { colors, fonts } from '../../src/constants/theme';
import { useAuth } from '../../src/providers/AuthProvider';

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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, signInWithApple } = useAuth();

  // Entrance animations
  const logoOpacity = useSharedValue(0);
  const lineOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const buttonsTranslateY = useSharedValue(40);
  const buttonsOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 300 });
    lineOpacity.value = withDelay(400, withTiming(1, { duration: 300 }));
    taglineOpacity.value = withDelay(600, withTiming(1, { duration: 300 }));
    buttonsOpacity.value = withDelay(800, withTiming(1, { duration: 400 }));
    buttonsTranslateY.value = withDelay(800, withTiming(0, { duration: 400 }));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value }));
  const lineStyle = useAnimatedStyle(() => ({ opacity: lineOpacity.value }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));
  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
    transform: [{ translateY: buttonsTranslateY.value }],
  }));

  const handleGoogle = async () => {
    // Google OAuth handled in a dedicated hook. For now navigate to email.
    // The actual Google ID token flow requires expo-auth-session setup
    // which needs the client IDs. This will be wired after Humza adds them.
    router.push('/(auth)/auth' as any);
  };

  const handleApple = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        const fullName = credential.fullName
          ? `${credential.fullName.givenName ?? ''} ${credential.fullName.familyName ?? ''}`.trim()
          : null;
        await signInWithApple(credential.identityToken, fullName || null);
      }
    } catch {
      // User cancelled
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoGroup}>
        <Animated.View style={logoStyle}>
          <Text style={styles.logo}>Cinemagraphs</Text>
        </Animated.View>
        <Animated.View style={lineStyle}>
          <DashedLine />
        </Animated.View>
        <Animated.View style={taglineStyle}>
          <Text style={styles.tagline}>movie reviews visualized</Text>
        </Animated.View>
      </View>

      <Animated.View
        style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }, buttonsStyle]}
      >
        <Pressable
          onPress={handleGoogle}
          style={({ pressed }) => [styles.googleButton, pressed && styles.buttonPressed]}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <Path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <Path
              d="M5.84 14.09A6.97 6.97 0 015.47 12c0-.72.13-1.43.37-2.09V7.07H2.18A11.96 11.96 0 001 12c0 1.94.46 3.77 1.18 5.07l3.66-2.98z"
              fill="#FBBC05"
            />
            <Path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </Svg>
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </Pressable>

        {Platform.OS === 'ios' && (
          <Pressable
            onPress={handleApple}
            style={({ pressed }) => [styles.appleButton, pressed && styles.buttonPressed]}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="#fff">
              <Path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-2.11 4.45-3.74 4.25z" />
            </Svg>
            <Text style={styles.appleButtonText}>Continue with Apple</Text>
          </Pressable>
        )}

        <View style={styles.orDivider}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>or</Text>
          <View style={styles.orLine} />
        </View>

        <Pressable
          onPress={() => router.push('/(auth)/auth' as any)}
          style={({ pressed }) => [styles.emailButton, pressed && styles.buttonPressed]}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
              stroke={colors.gold}
              strokeWidth={1.5}
            />
            <Path d="M22 6l-10 7L2 6" stroke={colors.gold} strokeWidth={1.5} />
          </Svg>
          <Text style={styles.emailButtonText}>Continue with email</Text>
        </Pressable>
      </Animated.View>
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
    fontFamily: fonts.heading,
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
    gap: 10,
  },
  googleButton: {
    backgroundColor: '#F5F0E1',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
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
    flexDirection: 'row',
    gap: 8,
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
    flexDirection: 'row',
    gap: 8,
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
