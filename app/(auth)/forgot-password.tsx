import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { buttonStates, colors, fonts } from '../../src/constants/theme';
import { forgotPassword } from '../../src/lib/api';
import { authError, authSuccess } from '../../src/lib/haptics';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);

  const canSubmit = email.trim().length > 0;
  const isSubmitDisabled = !canSubmit || isSubmitting;

  const handleSend = async () => {
    if (!email.trim()) return;
    setError('');
    setIsSubmitting(true);
    try {
      await forgotPassword(email.trim());
      authSuccess();
      setSent(true);
    } catch (e: any) {
      authError();
      setError(e.message || 'Could not send reset link');
    }
    setIsSubmitting(false);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M15 18l-6-6 6-6" stroke={colors.ivory} strokeWidth={2} />
        </Svg>
      </Pressable>

      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.heading}>
          Reset password
        </Text>
        <Text style={styles.subtitle}>
          Enter your email and we'll send you a reset link
        </Text>

        {sent ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>
              Check your email for the reset link
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Email</Text>
              <View style={[styles.inputBox, focused && styles.inputBoxFocused]}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@email.com"
                  placeholderTextColor="rgba(245,240,225,0.2)"
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  textContentType="emailAddress"
                  returnKeyType="done"
                  onSubmitEditing={handleSend}
                  accessibilityLabel="Email address"
                />
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              onPress={handleSend}
              disabled={isSubmitDisabled}
              accessibilityRole="button"
              accessibilityLabel="Send reset link"
              accessibilityState={{
                disabled: isSubmitDisabled,
                busy: isSubmitting,
              }}
              style={({ pressed }) => [
                styles.submitBtn,
                isSubmitDisabled && styles.submitBtnDisabled,
                pressed && !isSubmitDisabled && styles.submitBtnPressed,
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
                    styles.submitText,
                    isSubmitDisabled && styles.submitTextDisabled,
                  ]}
                >
                  Send reset link
                </Text>
              )}
            </Pressable>
          </>
        )}
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
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  heading: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.ivory,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(245,240,225,0.4)',
    marginBottom: 24,
  },
  fieldWrap: {
    marginBottom: 14,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.5)',
    marginBottom: 5,
  },
  inputBox: {
    backgroundColor: 'rgba(245,240,225,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.15)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputBoxFocused: {
    borderColor: colors.gold,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ivory,
    padding: 0,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#E24B4A',
    marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: buttonStates.primary.disabled.bg,
  },
  submitBtnPressed: {
    transform: [{ scale: 0.98 }],
  },
  submitText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.background,
  },
  submitTextDisabled: {
    color: buttonStates.primary.disabled.text,
  },
  successBox: {
    backgroundColor: 'rgba(45,212,168,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(45,212,168,0.2)',
    borderRadius: 8,
    padding: 14,
  },
  successText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.teal,
    textAlign: 'center',
  },
});
