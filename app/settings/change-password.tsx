import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, borderRadius } from '../../src/constants/theme';
import { changePassword } from '../../src/lib/api';
import { PasswordInput } from '../../src/components/PasswordInput';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [current, setCurrent] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!current) errs.current = 'Current password is required';
    if (!newPw) errs.newPw = 'New password is required';
    else if (newPw.length < 8) errs.newPw = 'Must be at least 8 characters';
    if (!confirm) errs.confirm = 'Please confirm your new password';
    else if (confirm !== newPw) errs.confirm = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setErrors({});
    try {
      await changePassword(current, newPw);
      setSuccess(true);
      setTimeout(() => router.back(), 800);
    } catch (e: any) {
      if (e.status === 401) {
        setErrors({ current: 'Current password is incorrect' });
      } else {
        setErrors({ general: e.message || 'Something went wrong' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.ivory} strokeWidth={2} />
          </Svg>
        </Pressable>
        <Text style={styles.title}>Change password</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>CURRENT PASSWORD</Text>
        <PasswordInput
          value={current}
          onChangeText={(t) => { setCurrent(t); setErrors((e) => ({ ...e, current: '' })); }}
          placeholder="Enter current password"
          error={errors.current || undefined}
        />

        <Text style={styles.label}>NEW PASSWORD</Text>
        <PasswordInput
          value={newPw}
          onChangeText={(t) => { setNewPw(t); setErrors((e) => ({ ...e, newPw: '' })); }}
          placeholder="At least 8 characters"
          textContentType="newPassword"
          error={errors.newPw || undefined}
        />

        <Text style={styles.label}>CONFIRM NEW PASSWORD</Text>
        <PasswordInput
          value={confirm}
          onChangeText={(t) => { setConfirm(t); setErrors((e) => ({ ...e, confirm: '' })); }}
          placeholder="Re-enter new password"
          textContentType="newPassword"
          error={errors.confirm || undefined}
        />

        {!!errors.general && <Text style={[styles.error, { marginTop: 12 }]}>{errors.general}</Text>}

        {success && <Text style={styles.successText}>Password updated</Text>}

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        >
          {saving ? (
            <ActivityIndicator color={colors.background} size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Update password</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginTop: 12,
    marginBottom: 20,
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center' },
  title: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.ivory,
    textAlign: 'center',
    marginRight: -32,
    letterSpacing: -0.2,
  },
  content: { paddingHorizontal: 16 },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: 'rgba(245,240,225,0.5)',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 16,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#E24B4A',
    marginTop: 4,
  },
  successText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: '#2DD4A8',
    textAlign: 'center',
    marginTop: 16,
  },
  saveBtn: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.background,
  },
});
