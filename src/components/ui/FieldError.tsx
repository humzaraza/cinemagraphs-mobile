import { useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';

import { fonts } from '../../constants/theme';

interface FieldErrorProps {
  message: string | null | undefined;
  testID?: string;
}

/**
 * Inline form-field error text. Renders nothing when message is empty so
 * there is no layout placeholder. On the empty-to-non-empty transition,
 * announces the message via VoiceOver so screen-reader users hear the
 * validation result without needing to re-focus the field.
 */
export default function FieldError({ message, testID }: FieldErrorProps) {
  const prev = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const wasEmpty = !prev.current;
    const isNonEmpty = !!message;
    if (wasEmpty && isNonEmpty && message) {
      AccessibilityInfo.announceForAccessibility(message);
    }
    prev.current = message;
  }, [message]);

  if (!message) return null;

  return (
    <Text
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID={testID}
      style={styles.text}
    >
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    marginTop: 6,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: '#E05555',
  },
});
