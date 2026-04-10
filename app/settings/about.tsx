import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, borderRadius } from '../../src/constants/theme';

const INFO_CARDS = [
  {
    title: 'Sentiment graphs',
    body: 'Every film has a sentiment arc showing how emotions shift scene by scene. Generated from hundreds of reviews using AI analysis.',
  },
  {
    title: 'The ticket stub',
    body: 'Tap the ticket stub on any poster to mark a film as watched. Set the date. Once you review it, it moves from Watched to Reviewed.',
  },
  {
    title: 'Write a review',
    body: 'Rate 8 story beats on sliders to create your personal sentiment arc. Your arc overlays on the main graph.',
  },
  {
    title: 'Live react',
    body: 'Start a session while watching. Use the slider and reaction buttons to capture how you feel in real-time. Rate beats after to create a combined arc.',
  },
  {
    title: 'Lists',
    body: 'Create custom film collections. Each list shows sentiment arcs so you can compare emotional journeys at a glance.',
  },
];

export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.ivory} strokeWidth={2} />
          </Svg>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>How it works</Text>
          <Text style={styles.subtitle}>Everything you need to know</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {INFO_CARDS.map((card, i) => (
          <View
            key={card.title}
            style={[styles.card, i < INFO_CARDS.length - 1 && { marginBottom: 10 }]}
          >
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardBody}>{card.body}</Text>
          </View>
        ))}
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
  headerCenter: { flex: 1, alignItems: 'center' },
  title: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.ivory,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.35)',
    marginTop: 2,
  },
  content: { paddingHorizontal: 14 },
  card: {
    backgroundColor: 'rgba(200,169,81,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.15)',
    borderRadius: borderRadius.xl,
    padding: 14,
  },
  cardTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ivory,
    marginBottom: 6,
  },
  cardBody: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.5)',
    lineHeight: 16.5,
  },
});
