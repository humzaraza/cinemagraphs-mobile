import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../src/constants/theme';
import { useAuth } from '../../src/providers/AuthProvider';
import { resendOTP } from '../../src/lib/api';

const CODE_LENGTH = 6;

export default function OTPScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { verifyOtp } = useAuth();

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const refs = useRef<(TextInput | null)[]>([]);

  const allFilled = digits.every((d) => d.length === 1);

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError('');
    if (digit && index < CODE_LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (!allFilled || !email) return;
    setError('');
    setLoading(true);
    try {
      await verifyOtp(email, digits.join(''));
    } catch (e: any) {
      setError(e.message || 'Verification failed');
    }
    setLoading(false);
  };

  const handleResend = async () => {
    if (!email) return;
    try {
      await resendOTP(email);
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch {
      // silently fail
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Back */}
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M15 18l-6-6 6-6" stroke={colors.ivory} strokeWidth={2} />
        </Svg>
      </Pressable>

      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconCircle}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
              stroke={colors.gold}
              strokeWidth={1.5}
            />
            <Path d="M22 6l-10 7L2 6" stroke={colors.gold} strokeWidth={1.5} />
          </Svg>
        </View>

        <Text style={styles.heading}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a verification code to{'\n'}
          <Text style={styles.emailHighlight}>{email}</Text>
        </Text>

        {/* OTP digits */}
        <View style={styles.otpRow}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={(r) => { refs.current[i] = r; }}
              value={d}
              onChangeText={(t) => handleChange(t, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={1}
              style={[
                styles.otpBox,
                d ? styles.otpBoxFilled : null,
              ]}
              textAlign="center"
              selectTextOnFocus
            />
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Verify */}
        <Pressable
          onPress={handleVerify}
          style={[styles.verifyBtn, !allFilled && styles.verifyBtnDisabled]}
          disabled={!allFilled || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Text
              style={[styles.verifyText, !allFilled && styles.verifyTextDisabled]}
            >
              Verify
            </Text>
          )}
        </Pressable>

        {/* Resend */}
        <View style={styles.resendRow}>
          <Text style={styles.resendLabel}>
            {resent ? 'Code sent! ' : "Didn't receive a code? "}
          </Text>
          {!resent && (
            <Pressable onPress={handleResend}>
              <Text style={styles.resendLink}>Resend</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    marginLeft: 14,
    marginTop: 8,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(200,169,81,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.ivory,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(245,240,225,0.4)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 28,
  },
  emailHighlight: {
    color: colors.gold,
  },

  // OTP
  otpRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
  },
  otpBox: {
    width: 42,
    height: 50,
    backgroundColor: 'rgba(245,240,225,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.15)',
    borderRadius: 8,
    fontFamily: fonts.bodyMedium,
    fontSize: 20,
    color: colors.ivory,
  },
  otpBoxFilled: {
    borderColor: 'rgba(200,169,81,0.3)',
  },

  errorText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#E24B4A',
    marginBottom: 12,
  },

  // Verify
  verifyBtn: {
    width: '100%',
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  verifyBtnDisabled: {
    backgroundColor: 'rgba(200,169,81,0.3)',
  },
  verifyText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.background,
  },
  verifyTextDisabled: {
    color: 'rgba(13,13,26,0.5)',
  },

  // Resend
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(245,240,225,0.4)',
  },
  resendLink: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.gold,
  },
});
