import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../src/constants/theme';

export default function SignUpScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join the community</Text>
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
