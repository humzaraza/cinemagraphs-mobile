import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, borderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/providers/AuthProvider';

const DELETE_CONFIRM_PHRASE = 'DELETE';

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: authUser } = useAuth();

  const [modalVisible, setModalVisible] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const canConfirm = confirmText === DELETE_CONFIRM_PHRASE && !isDeleting;

  const openModal = () => setModalVisible(true);

  const closeModal = () => {
    setModalVisible(false);
    setConfirmText('');
  };

  const handleConfirmDelete = () => {
    if (!canConfirm) return;
    // Phase 3 will replace this stub with the real delete flow.
    if (__DEV__) {
      console.log('[Account] Delete confirmed (stub). Phase 3 will wire the API call.');
    }
    closeModal();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.ivory} strokeWidth={2} />
          </Svg>
        </Pressable>
        <Text style={styles.title}>Account</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dangerSection}>
          <Pressable
            onPress={openModal}
            style={styles.destructiveRow}
            accessibilityRole="button"
            accessibilityLabel="Delete account"
          >
            <Text style={styles.destructiveRowLabel}>Delete account</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <Pressable style={styles.backdrop} onPress={closeModal}>
            <Pressable
              style={styles.modalCard}
              onPress={() => {}}
              accessibilityViewIsModal
              accessibilityRole="alert"
            >
              <Text style={styles.modalTitle}>Delete account</Text>

              <Text style={styles.modalBody}>
                This permanently deletes your account and everything in it: your reviews, lists, watchlist, banner, avatar, follows, and login. This cannot be undone.
              </Text>

              {authUser?.email ? (
                <Text style={styles.modalAccount}>
                  Account: {authUser.email}
                </Text>
              ) : null}

              <Text style={styles.modalLabel}>TYPE DELETE TO CONFIRM</Text>
              <TextInput
                value={confirmText}
                onChangeText={setConfirmText}
                style={styles.input}
                placeholder="DELETE"
                placeholderTextColor="rgba(245,240,225,0.2)"
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel="Type DELETE to confirm account deletion"
              />

              <View style={styles.actions}>
                <Pressable
                  onPress={closeModal}
                  style={styles.cancelBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleConfirmDelete}
                  disabled={!canConfirm}
                  style={[
                    styles.confirmBtn,
                    !canConfirm && styles.confirmBtnDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Delete account"
                  accessibilityState={{ disabled: !canConfirm }}
                >
                  <Text
                    style={[
                      styles.confirmBtnText,
                      !canConfirm && styles.confirmBtnTextDisabled,
                    ]}
                  >
                    Delete account
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
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
    marginBottom: 16,
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
  content: { paddingHorizontal: 14 },

  dangerSection: {
    marginTop: 24,
  },
  destructiveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  destructiveRowLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.negativeRed,
  },

  // Modal
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.background,
    borderRadius: borderRadius.xl,
    borderWidth: 0.5,
    borderColor: colors.cardBorder,
    padding: 20,
  },
  modalTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.ivory,
    letterSpacing: -0.2,
    marginBottom: 10,
  },
  modalBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  modalAccount: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 16,
  },
  modalLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ivory,
    backgroundColor: colors.inputBackground,
    borderWidth: 0.5,
    borderColor: colors.inputBorder,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 0.5,
    borderColor: 'rgba(245,240,225,0.2)',
  },
  cancelBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ivory,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.negativeRed,
  },
  confirmBtnDisabled: {
    backgroundColor: 'rgba(226,75,74,0.25)',
  },
  confirmBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ivory,
  },
  confirmBtnTextDisabled: {
    color: 'rgba(245,240,225,0.5)',
  },
});
