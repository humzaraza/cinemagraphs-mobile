import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../src/constants/theme';

export default function ExploreScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Explore</Text>
      <Text style={styles.subtitle}>Discover films and sentiment</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 28,
    color: colors.ivory,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ivory,
    opacity: 0.6,
    marginTop: spacing.sm,
  },
});
