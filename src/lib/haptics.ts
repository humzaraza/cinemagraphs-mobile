import * as Haptics from 'expo-haptics';

/** Auth success outcomes (sign in, sign up complete, OTP verify). */
export function authSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Auth error outcomes (invalid creds, OTP fail, submit error). */
export function authError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

/** Toggle interactions (show password, accept terms, segmented controls). */
export function toggle() {
  Haptics.selectionAsync().catch(() => {});
}
