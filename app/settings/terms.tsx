import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, borderRadius } from '../../src/constants/theme';

export default function TermsScreen() {
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
        <Text style={styles.title}>Terms & privacy</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Terms of Service</Text>

        <Text style={styles.body}>
          By using Cinemagraphs, you agree to these terms. Cinemagraphs provides a platform for tracking, reviewing, and discussing films through sentiment analysis and visual graphs. You may create an account, submit reviews, build lists, and interact with content shared by other users.
        </Text>

        <Text style={styles.body}>
          You are responsible for the content you submit, including reviews, ratings, and list descriptions. Content that is abusive, hateful, or violates the rights of others may be removed at our discretion. We reserve the right to suspend or terminate accounts that violate these terms.
        </Text>

        <Text style={styles.body}>
          Cinemagraphs is provided as-is. We make no guarantees about uptime, data retention, or the accuracy of sentiment analysis. Film data, including posters and metadata, is sourced from third-party providers and may change without notice.
        </Text>

        <Text style={styles.heading}>Privacy Policy</Text>

        <Text style={styles.body}>
          We collect information you provide when creating an account (name, email, password) and information generated through your use of the app (reviews, ratings, watchlist, viewing history). This data is used to personalize your experience and generate sentiment graphs.
        </Text>

        <Text style={styles.body}>
          Your email address is used for account authentication and password recovery. We do not sell your personal information to third parties. Aggregated, anonymized data may be used to improve our sentiment analysis models.
        </Text>

        <Text style={styles.body}>
          You can request deletion of your account and associated data by contacting us at cinemagraphs.corp@gmail.com. Upon deletion, your reviews and ratings will be anonymized and may continue to contribute to aggregate scores.
        </Text>

        <Text style={styles.updated}>Last updated: April 2026</Text>
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
  content: { paddingHorizontal: 16 },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.ivory,
    marginTop: 20,
    marginBottom: 12,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(245,240,225,0.55)',
    lineHeight: 19,
    marginBottom: 14,
  },
  updated: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: 'rgba(245,240,225,0.25)',
    marginTop: 20,
    textAlign: 'center',
  },
});
