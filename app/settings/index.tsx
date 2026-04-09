import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, borderRadius } from '../../src/constants/theme';
import { useAuth } from '../../src/providers/AuthProvider';
import { fetchUserSettings, updateUserSettings } from '../../src/lib/api';

function ChevronRight() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke="rgba(245,240,225,0.2)" strokeWidth={2} />
    </Svg>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function Row({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <ChevronRight />
    </Pressable>
  );
}

function ToggleRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{
          false: 'rgba(245,240,225,0.1)',
          true: colors.gold,
        }}
        thumbColor="#fff"
        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut, user: authUser } = useAuth();

  const [publicProfile, setPublicProfile] = useState(true);
  const [allowFollowers, setAllowFollowers] = useState(true);
  const [privateGraphs, setPrivateGraphs] = useState(false);

  useEffect(() => {
    fetchUserSettings()
      .then((s) => {
        if (!s) return;
        if (s.publicProfile !== undefined) setPublicProfile(s.publicProfile);
        if (s.allowFollowers !== undefined) setAllowFollowers(s.allowFollowers);
        if (s.privateGraphs !== undefined) setPrivateGraphs(s.privateGraphs);
      })
      .catch(() => {});
  }, []);

  const toggleSetting = (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    updateUserSettings({ [key]: value }).catch(() => setter(!value));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.ivory} strokeWidth={2} />
          </Svg>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* User card */}
        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userInitial}>
              {(authUser?.name ?? 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{authUser?.name ?? 'User'}</Text>
            <Text style={styles.userEmail}>{authUser?.email ?? ''}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/settings/edit-profile' as any)}
            hitSlop={8}
          >
            <Text style={styles.editLink}>Edit</Text>
          </Pressable>
        </View>

        {/* Account */}
        <SectionLabel label="ACCOUNT" />
        <View style={styles.section}>
          <Row
            label="Edit profile"
            onPress={() => router.push('/settings/edit-profile' as any)}
          />
          <View style={styles.divider} />
          <Row
            label="Change password"
            onPress={() => router.push('/settings/change-password' as any)}
          />
          <View style={styles.divider} />
          <Row
            label="Notifications"
            onPress={() => router.push('/settings/notifications' as any)}
          />
        </View>

        {/* Privacy */}
        <SectionLabel label="PRIVACY" />
        <View style={styles.section}>
          <ToggleRow
            label="Public profile"
            value={publicProfile}
            onToggle={(v) => toggleSetting('publicProfile', v, setPublicProfile)}
          />
          <View style={styles.divider} />
          <ToggleRow
            label="Allow followers"
            value={allowFollowers}
            onToggle={(v) => toggleSetting('allowFollowers', v, setAllowFollowers)}
          />
          <View style={styles.divider} />
          <ToggleRow
            label="Private graphs"
            value={privateGraphs}
            onToggle={(v) => toggleSetting('privateGraphs', v, setPrivateGraphs)}
          />
        </View>

        {/* About */}
        <SectionLabel label="ABOUT" />
        <View style={styles.section}>
          <Row
            label="How Cinemagraphs works"
            onPress={() => router.push('/settings/about' as any)}
          />
          <View style={styles.divider} />
          <Row
            label="Contact us"
            onPress={() => router.push('/settings/contact' as any)}
          />
          <View style={styles.divider} />
          <Row
            label="Terms & privacy"
            onPress={() => router.push('/settings/terms' as any)}
          />
        </View>

        {/* Sign out */}
        <Pressable style={styles.signOutBtn} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        {/* Version */}
        <Text style={styles.version}>Cinemagraphs v1.0.0</Text>
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
    marginBottom: 16,
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center' },
  title: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.ivory,
    textAlign: 'center',
    marginRight: -32,
  },
  content: { paddingHorizontal: 14 },

  // User card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(200,169,81,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInitial: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.gold,
  },
  userName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ivory,
  },
  userEmail: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.4)',
    marginTop: 1,
  },
  editLink: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.gold,
  },

  // Sections
  sectionLabel: {
    fontSize: 9,
    color: 'rgba(245,240,225,0.3)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontFamily: fonts.body,
    marginBottom: 8,
  },
  section: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rowLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ivory,
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(245,240,225,0.04)',
  },

  // Sign out
  signOutBtn: {
    borderWidth: 0.5,
    borderColor: 'rgba(226,75,74,0.3)',
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#E24B4A',
  },

  // Version
  version: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(245,240,225,0.15)',
    textAlign: 'center',
    marginTop: 20,
  },
});
