import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Line, Circle, Polyline, Rect } from 'react-native-svg';
import { colors, fonts, borderRadius } from '../../src/constants/theme';

function ArcIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <Polyline
        points="2,22 7,16 12,18 17,8 22,12 26,6"
        stroke={colors.gold}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={17} cy={8} r={2.5} fill={colors.teal} />
    </Svg>
  );
}

function TicketIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <Rect x={3} y={6} width={22} height={16} rx={2} stroke={colors.gold} strokeWidth={1.5} />
      <Line x1={3} y1={10} x2={25} y2={10} stroke={colors.gold} strokeWidth={1.5} />
      <Line x1={10} y1={14} x2={18} y2={14} stroke="rgba(200,169,81,0.4)" strokeWidth={1} />
      <Line x1={10} y1={17} x2={16} y2={17} stroke="rgba(200,169,81,0.4)" strokeWidth={1} />
    </Svg>
  );
}

function SliderIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <Line x1={4} y1={14} x2={24} y2={14} stroke="rgba(200,169,81,0.3)" strokeWidth={3} strokeLinecap="round" />
      <Line x1={4} y1={14} x2={16} y2={14} stroke={colors.gold} strokeWidth={3} strokeLinecap="round" />
      <Circle cx={16} cy={14} r={4} fill={colors.gold} />
    </Svg>
  );
}

function PlayIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <Circle cx={14} cy={14} r={10} stroke={colors.gold} strokeWidth={1.5} />
      <Path d="M11 9.5l8.5 4.5-8.5 4.5z" fill={colors.gold} />
    </Svg>
  );
}

function GridIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <Rect x={3} y={3} width={9} height={9} rx={1.5} stroke={colors.gold} strokeWidth={1.5} />
      <Rect x={16} y={3} width={9} height={9} rx={1.5} stroke={colors.gold} strokeWidth={1.5} />
      <Rect x={3} y={16} width={9} height={9} rx={1.5} stroke={colors.gold} strokeWidth={1.5} />
      <Rect x={16} y={16} width={9} height={9} rx={1.5} stroke={colors.gold} strokeWidth={1.5} />
    </Svg>
  );
}

const INFO_CARDS = [
  {
    icon: ArcIcon,
    title: 'Sentiment arcs',
    body: 'Every film has a sentiment arc showing how emotions shift scene by scene. Generated from hundreds of reviews using AI analysis.',
  },
  {
    icon: TicketIcon,
    title: 'The ticket stub',
    body: 'Tap the ticket stub on any poster to mark a film as watched. Set the date. Once you review it, it moves from Watched to Reviewed.',
  },
  {
    icon: SliderIcon,
    title: 'Write a review',
    body: 'Rate 8 story beats on sliders to create your personal sentiment arc. Your arc overlays on the main graph.',
  },
  {
    icon: PlayIcon,
    title: 'Live react',
    body: 'Start a session while watching. Use the slider and reaction buttons to capture how you feel in real-time. Rate beats after to create a combined arc.',
  },
  {
    icon: GridIcon,
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
          <Text style={styles.wordmark}>Cinemagraphs</Text>
          <Text style={styles.subtitle}>How it works</Text>
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
        {INFO_CARDS.map((card, i) => {
          const Icon = card.icon;
          return (
            <View
              key={card.title}
              style={[styles.card, i < INFO_CARDS.length - 1 && { marginBottom: 12 }]}
            >
              <View style={styles.iconWrap}>
                <Icon />
              </View>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardBody}>{card.body}</Text>
            </View>
          );
        })}
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
  wordmark: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.gold,
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
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(200,169,81,0.3)',
    borderRadius: borderRadius.lg,
    padding: 14,
  },
  iconWrap: {
    marginBottom: 8,
  },
  cardTitle: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.gold,
    marginBottom: 6,
  },
  cardBody: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.5)',
    lineHeight: 18,
  },
});
