import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { buttonStates, colors, fonts } from '../../src/constants/theme';
import { useAuth } from '../../src/providers/AuthProvider';
import { resendOTP } from '../../src/lib/api';
import { authError, authSuccess } from '../../src/lib/haptics';
import { useToast } from '../../src/components/ui/Toast';

const CODE_LENGTH = 6;

export default function OTPScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { verifyOtp } = useAuth();
  const { showError, showSuccess } = useToast();

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resent, setResent] = useState(false);
  const refs = useRef<(TextInput | null)[]>([]);

  const allFilled = digits.every((d) => d.length === 1);
  const canSubmit = allFilled;
  const isSubmitDisabled = !canSubmit || isSubmitting;

  const handleChange = (text: string, index: number) => {
    const sanitized = text.replace(/[^0-9]/g, '');

    // Paste or iOS one-time-code autofill. Distribute the first CODE_LENGTH
    // digits across cells 0..5 regardless of which cell received the input;
    // a paste is treated as the full code, not as input local to one cell.
    if (sanitized.length > 1) {
      const chars = sanitized.slice(0, CODE_LENGTH).split('');
      const next = Array<string>(CODE_LENGTH).fill('');
      for (let i = 0; i < chars.length; i++) {
        next[i] = chars[i];
      }
      setDigits(next);
      if (chars.length >= CODE_LENGTH) {
        refs.current[CODE_LENGTH - 1]?.blur();
        Keyboard.dismiss();
      } else {
        refs.current[chars.length - 1]?.focus();
      }
      return;
    }

    // Single-digit typing path.
    const next = [...digits];
    next[index] = sanitized;
    setDigits(next);
    if (sanitized && index < CODE_LENGTH - 1) {
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
    setIsSubmitting(true);
    try {
      await verifyOtp(email, digits.join(''));
      authSuccess();
      showSuccess('Verified');
    } catch (e: any) {
      authError();
      showError(e.message || 'Invalid or expired code. Please try again.');
    }
    setIsSubmitting(false);
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
    <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Back */}
      <Pressable
        onPress={() => router.back()}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
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

        <Text accessibilityRole="header" style={styles.heading}>
          Check your email
        </Text>
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
              textContentType="oneTimeCode"
              style={[
                styles.otpBox,
                d ? styles.otpBoxFilled : null,
              ]}
              textAlign="center"
              selectTextOnFocus
              accessibilityLabel={`Digit ${i + 1} of ${CODE_LENGTH}`}
            />
          ))}
        </View>

        {/* Verify */}
        <Pressable
          onPress={handleVerify}
          disabled={isSubmitDisabled}
          accessibilityRole="button"
          accessibilityLabel="Verify"
          accessibilityState={{ disabled: isSubmitDisabled, busy: isSubmitting }}
          style={({ pressed }) => [
            styles.verifyBtn,
            isSubmitDisabled && styles.verifyBtnDisabled,
            pressed && !isSubmitDisabled && styles.verifyBtnPressed,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator
              size="small"
              color={buttonStates.primary.loading.spinner}
            />
          ) : (
            <Text
              style={[
                styles.verifyText,
                isSubmitDisabled && styles.verifyTextDisabled,
              ]}
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
            <Pressable
              onPress={handleResend}
              accessibilityRole="button"
              accessibilityLabel="Resend code"
            >
              {({ pressed }) => (
                <Text
                  style={[
                    styles.resendLink,
                    pressed && styles.resendLinkPressed,
                  ]}
                >
                  Resend
                </Text>
              )}
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
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
    fontFamily: fonts.bodyBold,
    fontSize: 20,
    color: colors.ivory,
    marginBottom: 6,
    letterSpacing: -0.4,
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

  // Verify
  verifyBtn: {
    width: '100%',
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  verifyBtnDisabled: {
    backgroundColor: buttonStates.primary.disabled.bg,
  },
  verifyBtnPressed: {
    transform: [{ scale: 0.98 }],
  },
  verifyText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.background,
  },
  verifyTextDisabled: {
    color: buttonStates.primary.disabled.text,
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
  resendLinkPressed: {
    color: buttonStates.tertiary.pressed.text,
  },
});
