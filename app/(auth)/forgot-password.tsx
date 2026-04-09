import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../src/constants/theme';
import { forgotPassword } from '../../src/lib/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) return;
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (e: any) {
      setError(e.message || 'Could not send reset link');
    }
    setLoading(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M15 18l-6-6 6-6" stroke={colors.ivory} strokeWidth={2} />
        </Svg>
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.heading}>Reset password</Text>
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
                />
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              onPress={handleSend}
              style={[styles.submitBtn, loading && { opacity: 0.6 }]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Text style={styles.submitText}>Send reset link</Text>
              )}
            </Pressable>
          </>
        )}
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
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.ivory,
    marginBottom: 6,
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
    alignItems: 'center',
  },
  submitText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.background,
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
