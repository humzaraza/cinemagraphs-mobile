import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../src/constants/theme';

export default function LiveReactScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
          <Path d="M15 18l-6-6 6-6" stroke={colors.ivory} strokeWidth={2} />
        </Svg>
      </Pressable>
      <View style={styles.center}>
        <Text style={styles.title}>Live React</Text>
        <Text style={styles.subtitle}>Coming Soon</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  back: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    marginTop: 12,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 22,
    color: colors.gold,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: 'rgba(245,240,225,0.4)',
  },
});
