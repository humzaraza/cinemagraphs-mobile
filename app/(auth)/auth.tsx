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
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { buttonStates, colors, fonts, borderRadius } from '../../src/constants/theme';
import { TERMS_URL, PRIVACY_URL } from '../../src/constants/legal';
import { useAuth } from '../../src/providers/AuthProvider';
import { authError, authSuccess } from '../../src/lib/haptics';
import FieldError from '../../src/components/ui/FieldError';
import { PasswordInput } from '../../src/components/PasswordInput';
import { useToast } from '../../src/components/ui/Toast';

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD_LENGTH = 8;

type Tab = 'signin' | 'create';

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const { showError, showSuccess } = useToast();

  const [tab, setTab] = useState<Tab>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const emailRef = useRef<TextInput | null>(null);
  const passwordRef = useRef<TextInput | null>(null);

  const canSubmit =
    tab === 'signin'
      ? email.trim().length > 0 && password.length > 0
      : name.trim().length > 0 &&
        email.trim().length > 0 &&
        password.length >= MIN_PASSWORD_LENGTH &&
        termsAccepted;
  const isSubmitDisabled = !canSubmit || isSubmitting;

  // Tab switch clears any field-level errors from the previous tab so
  // the user does not see stale "Profile name is required" carrying
  // over into the Sign in flow.
  const switchTab = (next: Tab) => {
    setTab(next);
    setNameError(null);
    setEmailError(null);
    setPasswordError(null);
  };

  const validate = (mode: Tab) => {
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    const result = {
      name: null as string | null,
      email: null as string | null,
      password: null as string | null,
    };
    if (mode === 'create' && !trimmedName) {
      result.name = 'Profile name is required';
    }
    if (!trimmedEmail) {
      result.email = 'Email is required';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      result.email = 'Enter a valid email address';
    }
    if (!password) {
      result.password = 'Password is required';
    } else if (mode === 'create' && password.length < MIN_PASSWORD_LENGTH) {
      result.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    return result;
  };

  const handleSignIn = async () => {
    const errs = validate('signin');
    setEmailError(errs.email);
    setPasswordError(errs.password);
    if (errs.email || errs.password) return;

    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);
      authSuccess();
      showSuccess('Signed in');
    } catch (e: any) {
      authError();
      const message = e.message || 'Sign in failed. Please check your credentials.';
      setPasswordError(message);
      showError(message);
    }
    setIsSubmitting(false);
  };

  const handleCreate = async () => {
    const errs = validate('create');
    setNameError(errs.name);
    setEmailError(errs.email);
    setPasswordError(errs.password);
    if (errs.name || errs.email || errs.password) return;

    setIsSubmitting(true);
    try {
      await signUp(email.trim(), password, name.trim());
      authSuccess();
      showSuccess('Account created');
      router.push({ pathname: '/(auth)/otp', params: { email: email.trim() } } as any);
    } catch (e: any) {
      authError();
      showError(e.message || 'Account creation failed. Please try again.');
    }
    setIsSubmitting(false);
  };

  return (
    <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
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

        {/* Header */}
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.heading}>
            {tab === 'signin' ? 'Welcome back' : 'Create your account'}
          </Text>
          <Text style={styles.subtitle}>
            {tab === 'signin' ? 'Sign in to your account' : 'Join the community'}
          </Text>
        </View>

        {/* Tab toggle */}
        <View style={styles.tabToggle}>
          <Pressable
            onPress={() => switchTab('signin')}
            style={[styles.tabBtn, tab === 'signin' && styles.tabBtnActive]}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            accessibilityState={{ selected: tab === 'signin' }}
          >
            <Text style={[styles.tabText, tab === 'signin' && styles.tabTextActive]}>
              Sign in
            </Text>
          </Pressable>
          <Pressable
            onPress={() => switchTab('create')}
            style={[styles.tabBtn, tab === 'create' && styles.tabBtnActive]}
            accessibilityRole="button"
            accessibilityLabel="Create account"
            accessibilityState={{ selected: tab === 'create' }}
          >
            <Text style={[styles.tabText, tab === 'create' && styles.tabTextActive]}>
              Create account
            </Text>
          </Pressable>
        </View>

        {/* Fields */}
        {tab === 'create' && (
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Profile name</Text>
            <View style={[styles.inputBox, focusedField === 'name' && styles.inputBoxFocused]}>
              <TextInput
                value={name}
                onChangeText={(t) => { setName(t); setNameError(null); }}
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
                accessibilityLabel="Profile name"
              />
            </View>
            <FieldError message={nameError} />
          </View>
        )}

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Email</Text>
          <View style={[styles.inputBox, focusedField === 'email' && styles.inputBoxFocused]}>
            <TextInput
              ref={emailRef}
              value={email}
              onChangeText={(t) => { setEmail(t); setEmailError(null); }}
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
              accessibilityLabel="Email address"
            />
          </View>
          <FieldError message={emailError} />
        </View>

        <View style={[styles.fieldWrap, { marginBottom: tab === 'signin' ? 8 : 20 }]}>
          <Text style={styles.label}>Password</Text>
          <PasswordInput
            ref={passwordRef}
            value={password}
            onChangeText={(t) => { setPassword(t); setPasswordError(null); }}
            placeholder={tab === 'signin' ? 'Enter your password' : 'Create a password'}
            textContentType={tab === 'create' ? 'newPassword' : 'password'}
            returnKeyType="done"
            onSubmitEditing={tab === 'signin' ? handleSignIn : handleCreate}
            accessibilityLabel="Password"
            error={passwordError ?? undefined}
          />
        </View>

        {tab === 'create' && (
          <View style={styles.termsRow}>
            <Pressable
              onPress={() => setTermsAccepted((v) => !v)}
              style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
              accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
              hitSlop={8}
            >
              {termsAccepted && (
                <Svg width={12} height={12} viewBox="0 0 24 24">
                  <Path
                    d="M5 13l4 4L19 7"
                    stroke={colors.background}
                    strokeWidth={3}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              )}
            </Pressable>
            <Text style={styles.termsLabel}>
              I agree to the{' '}
              <Text style={styles.termsLink} onPress={() => Linking.openURL(TERMS_URL)}>
                Terms of Service
              </Text>
              {' '}and{' '}
              <Text style={styles.termsLink} onPress={() => Linking.openURL(PRIVACY_URL)}>
                Privacy Policy
              </Text>
              .
            </Text>
          </View>
        )}

        {tab === 'signin' && (
          <Pressable
            onPress={() => router.push('/(auth)/forgot-password' as any)}
            style={styles.forgotWrap}
            accessibilityRole="button"
            accessibilityLabel="Forgot password"
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
          accessibilityRole="button"
          accessibilityLabel={tab === 'signin' ? 'Sign in' : 'Create account'}
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

  // Terms checkbox (Create tab only)
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 20,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderRadius: 4,
    borderColor: colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  termsLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  termsLink: {
    color: colors.gold,
    textDecorationLine: 'underline',
  },
});
