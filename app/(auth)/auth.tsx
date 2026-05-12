import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { buttonStates, colors, fonts, borderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/providers/AuthProvider';
import { authError, authSuccess } from '../../src/lib/haptics';

type Tab = 'signin' | 'create';

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();

  const [tab, setTab] = useState<Tab>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState('');

  const emailRef = useRef<TextInput | null>(null);
  const passwordRef = useRef<TextInput | null>(null);

  const canSubmit =
    tab === 'signin'
      ? email.trim().length > 0 && password.length > 0
      : name.trim().length > 0 &&
        email.trim().length > 0 &&
        password.length >= 8;
  const isSubmitDisabled = !canSubmit || isSubmitting;

  const handleSignIn = async () => {
    if (!email.trim() || !password) return;
    setError('');
    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);
      authSuccess();
    } catch (e: any) {
      authError();
      setError(e.message || 'Sign in failed');
    }
    setIsSubmitting(false);
  };

  const handleCreate = async () => {
    if (!name.trim() || !email.trim() || !password) return;
    setError('');
    setIsSubmitting(true);
    try {
      await signUp(email.trim(), password, name.trim());
      authSuccess();
      router.push({ pathname: '/(auth)/otp', params: { email: email.trim() } } as any);
    } catch (e: any) {
      authError();
      setError(e.message || 'Registration failed');
    }
    setIsSubmitting(false);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back */}
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.ivory} strokeWidth={2} />
          </Svg>
        </Pressable>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.heading}>
            {tab === 'signin' ? 'Welcome back' : 'Create your account'}
          </Text>
          <Text style={styles.subtitle}>
            {tab === 'signin' ? 'Sign in to your account' : 'Join the community'}
          </Text>
        </View>

        {/* Tab toggle */}
        <View style={styles.tabToggle}>
          <Pressable
            onPress={() => { setTab('signin'); setError(''); }}
            style={[styles.tabBtn, tab === 'signin' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === 'signin' && styles.tabTextActive]}>
              Sign in
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { setTab('create'); setError(''); }}
            style={[styles.tabBtn, tab === 'create' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === 'create' && styles.tabTextActive]}>
              Create account
            </Text>
          </Pressable>
        </View>

        {/* Error banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Fields */}
        {tab === 'create' && (
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Profile name</Text>
            <View style={[styles.inputBox, focusedField === 'name' && styles.inputBoxFocused]}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your display name"
                placeholderTextColor="rgba(245,240,225,0.2)"
                style={styles.input}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField('')}
                autoCapitalize="words"
                textContentType="name"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>
          </View>
        )}

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Email</Text>
          <View style={[styles.inputBox, focusedField === 'email' && styles.inputBoxFocused]}>
            <TextInput
              ref={emailRef}
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor="rgba(245,240,225,0.2)"
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField('')}
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>
        </View>

        <View style={[styles.fieldWrap, { marginBottom: tab === 'signin' ? 8 : 20 }]}>
          <Text style={styles.label}>Password</Text>
          <View style={[styles.inputBox, focusedField === 'password' && styles.inputBoxFocused]}>
            <TextInput
              ref={passwordRef}
              value={password}
              onChangeText={setPassword}
              placeholder={tab === 'signin' ? 'Enter your password' : 'Create a password'}
              placeholderTextColor="rgba(245,240,225,0.2)"
              style={styles.input}
              secureTextEntry
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField('')}
              textContentType={tab === 'create' ? 'newPassword' : 'password'}
              returnKeyType="done"
              onSubmitEditing={tab === 'signin' ? handleSignIn : handleCreate}
            />
          </View>
        </View>

        {tab === 'signin' && (
          <Pressable
            onPress={() => router.push('/(auth)/forgot-password' as any)}
            style={styles.forgotWrap}
          >
            {({ pressed }) => (
              <Text
                style={[styles.forgotText, pressed && styles.forgotTextPressed]}
              >
                Forgot password?
              </Text>
            )}
          </Pressable>
        )}

        {/* Submit */}
        <Pressable
          onPress={tab === 'signin' ? handleSignIn : handleCreate}
          disabled={isSubmitDisabled}
          accessibilityState={{ disabled: isSubmitDisabled, busy: isSubmitting }}
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
              {tab === 'signin' ? 'Sign in' : 'Create account'}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20 },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    marginTop: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  heading: {
    fontFamily: fonts.bodyBold,
    fontSize: 20,
    color: colors.ivory,
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(245,240,225,0.4)',
  },

  // Tab toggle
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245,240,225,0.06)',
    borderRadius: 8,
    padding: 3,
    marginBottom: 24,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: colors.gold,
  },
  tabText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: 'rgba(245,240,225,0.5)',
  },
  tabTextActive: {
    color: colors.background,
  },

  // Error
  errorBanner: {
    backgroundColor: 'rgba(226,75,74,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(226,75,74,0.3)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#E24B4A',
    textAlign: 'center',
  },

  // Fields
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

  // Forgot
  forgotWrap: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.gold,
  },

  // Submit
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
  forgotTextPressed: {
    color: buttonStates.tertiary.pressed.text,
  },
});
