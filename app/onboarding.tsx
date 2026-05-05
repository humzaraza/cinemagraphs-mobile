import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  FlatList,
  ViewToken,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, Line, Circle, Rect } from 'react-native-svg';
import { colors, fonts } from '../src/constants/theme';
import { useAuth } from '../src/providers/AuthProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Slide illustrations (react-native-svg, no images)
// ---------------------------------------------------------------------------

function ArcIllustration() {
  return (
    <Svg width={120} height={80} viewBox="0 0 120 80" fill="none">
      <Polyline
        points="10,60 25,45 40,50 55,25 70,30 85,15 100,35 115,20"
        stroke={colors.gold}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={85} cy={15} r={4} fill={colors.teal} />
      <Circle cx={40} cy={50} r={4} fill="#E24B4A" />
      <Line
        x1={10} y1={40} x2={115} y2={40}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={1}
        strokeDasharray="4,4"
      />
    </Svg>
  );
}

function SliderIllustration() {
  return (
    <Svg width={120} height={80} viewBox="0 0 120 80" fill="none">
      <Line x1={15} y1={40} x2={105} y2={40} stroke="rgba(245,240,225,0.15)" strokeWidth={3} strokeLinecap="round" />
      <Line x1={15} y1={40} x2={72} y2={40} stroke={colors.gold} strokeWidth={3} strokeLinecap="round" />
      <Circle cx={72} cy={40} r={8} fill={colors.gold} />
      <Line x1={15} y1={58} x2={105} y2={58} stroke="rgba(245,240,225,0.08)" strokeWidth={3} strokeLinecap="round" />
      <Line x1={15} y1={58} x2={50} y2={58} stroke="rgba(200,169,81,0.5)" strokeWidth={3} strokeLinecap="round" />
      <Circle cx={50} cy={58} r={6} fill="rgba(200,169,81,0.6)" />
      <Line x1={15} y1={22} x2={105} y2={22} stroke="rgba(245,240,225,0.08)" strokeWidth={3} strokeLinecap="round" />
      <Line x1={15} y1={22} x2={90} y2={22} stroke="rgba(200,169,81,0.5)" strokeWidth={3} strokeLinecap="round" />
      <Circle cx={90} cy={22} r={6} fill="rgba(200,169,81,0.6)" />
    </Svg>
  );
}

function GridIllustration() {
  const gap = 6;
  const size = 30;
  const startX = 60 - (size * 3 + gap * 2) / 2;
  return (
    <Svg width={120} height={80} viewBox="0 0 120 80" fill="none">
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => (
          <Rect
            key={`${row}-${col}`}
            x={startX + col * (size + gap)}
            y={7 + row * (size - 4)}
            width={size}
            height={size - 8}
            rx={4}
            stroke={colors.gold}
            strokeWidth={1.5}
            fill="rgba(200,169,81,0.08)"
          />
        ))
      )}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Slide data
// ---------------------------------------------------------------------------

interface Slide {
  id: string;
  illustration: () => React.JSX.Element;
  heading: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    id: '1',
    illustration: ArcIllustration,
    heading: 'See how films feel',
    body: 'Every film has a sentiment arc showing how emotions shift scene by scene. Generated from hundreds of reviews using AI analysis.',
  },
  {
    id: '2',
    illustration: SliderIllustration,
    heading: 'Rate the story beats',
    body: 'Use sliders to rate up to 8 key moments in the film. Your scores create a personal arc that overlays on the main graph.',
  },
  {
    id: '3',
    illustration: GridIllustration,
    heading: 'Build your collection',
    body: 'Create custom lists, save films to your watchlist, and track every film you watch with sentiment arcs.',
  },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { clearOnboarding } = useAuth();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const done = async () => {
    await clearOnboarding();
    router.replace('/(tabs)/explore' as any);
  };

  const next = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  };

  const renderSlide = ({ item }: { item: Slide }) => {
    const Illustration = item.illustration;
    return (
      <View style={[slideStyles.slide, { width: SCREEN_WIDTH }]}>
        <View style={slideStyles.illustrationWrap}>
          <Illustration />
        </View>
        <Text style={slideStyles.heading}>{item.heading}</Text>
        <Text style={slideStyles.body}>{item.body}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Skip */}
      <View style={styles.skipRow}>
        <Pressable onPress={done} hitSlop={12}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={styles.flatList}
      />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === activeIndex && styles.dotActive]}
          />
        ))}
      </View>

      {/* Button */}
      <Pressable onPress={activeIndex === SLIDES.length - 1 ? done : next} style={styles.button}>
        <Text style={styles.buttonText}>
          {activeIndex === SLIDES.length - 1 ? 'Get started' : 'Next'}
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const slideStyles = StyleSheet.create({
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  illustrationWrap: {
    width: 160,
    height: 120,
    borderRadius: 20,
    backgroundColor: 'rgba(200,169,81,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  heading: {
    fontFamily: fonts.bodyBold,
    fontSize: 22,
    color: colors.ivory,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: 'rgba(245,240,225,0.6)',
    textAlign: 'center',
    lineHeight: 21,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skipRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  skipText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: 'rgba(245,240,225,0.4)',
  },
  flatList: {
    flex: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(245,240,225,0.15)',
  },
  dotActive: {
    backgroundColor: colors.gold,
  },
  button: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 14,
    marginHorizontal: 28,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.background,
  },
});
