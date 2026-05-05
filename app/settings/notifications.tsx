import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../src/constants/theme';

const TOGGLES = [
  { key: 'newFollowers', label: 'New followers' },
  { key: 'reviewLikes', label: 'Review likes' },
  { key: 'listUpdates', label: 'List updates' },
] as const;

type ToggleKey = typeof TOGGLES[number]['key'];

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<Record<ToggleKey, boolean>>({
    newFollowers: true,
    reviewLikes: true,
    listUpdates: false,
  });

  const toggle = (key: ToggleKey) => {
    setValues((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.ivory} strokeWidth={2} />
          </Svg>
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        {TOGGLES.map((t, i) => (
          <View
            key={t.key}
            style={[styles.row, i < TOGGLES.length - 1 && styles.rowBorder]}
          >
            <Text style={styles.rowLabel}>{t.label}</Text>
            <Switch
              value={values[t.key]}
              onValueChange={() => toggle(t.key)}
              trackColor={{ false: 'rgba(245,240,225,0.1)', true: 'rgba(200,169,81,0.4)' }}
              thumbColor={values[t.key] ? colors.gold : 'rgba(245,240,225,0.5)'}
            />
          </View>
        ))}
      </View>

      <Text style={styles.note}>Push notifications coming soon</Text>
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
    marginBottom: 24,
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
  sectionLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: 'rgba(245,240,225,0.5)',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(200,169,81,0.12)',
  },
  rowLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ivory,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.3)',
    textAlign: 'center',
    marginTop: 32,
  },
});
