import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, borderRadius } from '../../src/constants/theme';

const LINKS = [
  {
    label: 'Email',
    detail: 'cinemagraphs.corp@gmail.com',
    url: 'mailto:cinemagraphs.corp@gmail.com',
  },
  {
    label: 'Twitter / X',
    detail: '@cinemagraphsco',
    url: 'https://x.com/cinemagraphsco',
  },
  {
    label: 'Instagram',
    detail: '@cinemagraphsco',
    url: 'https://www.instagram.com/cinemagraphsco/',
  },
];

export default function ContactScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.ivory} strokeWidth={2} />
          </Svg>
        </Pressable>
        <Text style={styles.title}>Contact us</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionLabel}>GET IN TOUCH</Text>
        {LINKS.map((link, i) => (
          <Pressable
            key={link.label}
            onPress={() => Linking.openURL(link.url)}
            style={[styles.row, i < LINKS.length - 1 && styles.rowBorder]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{link.label}</Text>
              <Text style={styles.rowDetail}>{link.detail}</Text>
            </View>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M9 6l6 6-6 6" stroke="rgba(245,240,225,0.3)" strokeWidth={2} />
            </Svg>
          </Pressable>
        ))}
      </View>
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
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.ivory,
    textAlign: 'center',
    marginRight: -32,
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
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(200,169,81,0.12)',
  },
  rowLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ivory,
  },
  rowDetail: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(245,240,225,0.4)',
    marginTop: 2,
  },
});
