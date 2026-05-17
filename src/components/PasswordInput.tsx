import { forwardRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';

import { colors, fonts } from '../constants/theme';

export interface PasswordInputProps
  extends Omit<TextInputProps, 'secureTextEntry'> {
  error?: string;
}

const ERROR_BORDER = 'rgba(224,85,85,0.6)';
const ERROR_BG = 'rgba(224,85,85,0.04)';
const ERROR_TEXT = '#E05555';
const EYE_OFF_COLOR = 'rgba(245,240,225,0.45)';
const EYE_ON_COLOR = colors.gold;

export const PasswordInput = forwardRef<TextInput, PasswordInputProps>(
  function PasswordInput({ error, style, onFocus, onBlur, ...rest }, ref) {
    const [visible, setVisible] = useState(false);
    const [focused, setFocused] = useState(false);
    const hasError = !!error && error.length > 0;

    return (
      <View>
        <View
          style={[
            styles.row,
            focused && !hasError && styles.rowFocused,
            hasError && styles.rowError,
          ]}
        >
          <TextInput
            ref={ref}
            secureTextEntry={!visible}
            placeholderTextColor="rgba(245,240,225,0.25)"
            autoCapitalize="none"
            autoCorrect={false}
            {...rest}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={[styles.input, style]}
          />
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            accessibilityState={{ checked: visible }}
            style={styles.eyeBtn}
          >
            {visible ? (
              <EyeOffIcon color={EYE_ON_COLOR} />
            ) : (
              <EyeIcon color={EYE_OFF_COLOR} />
            )}
          </Pressable>
        </View>
        {hasError && (
          <View style={styles.errorRow}>
            <AlertCircleIcon color={ERROR_TEXT} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
    );
  },
);

function EyeIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.75} />
    </Svg>
  );
}

function EyeOffIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.88 9.88a3 3 0 1 0 4.24 4.24"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.73 5.08A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.39-1.61"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M2 2 22 22"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function AlertCircleIcon({ color }: { color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} />
      <Line
        x1={12}
        y1={8}
        x2={12}
        y2={12}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Line
        x1={12}
        y1={16}
        x2={12.01}
        y2={16}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,240,225,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.15)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowFocused: {
    borderColor: colors.gold,
  },
  rowError: {
    borderWidth: 1,
    borderColor: ERROR_BORDER,
    backgroundColor: ERROR_BG,
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ivory,
    padding: 0,
  },
  eyeBtn: {
    marginLeft: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  errorText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: ERROR_TEXT,
  },
});
