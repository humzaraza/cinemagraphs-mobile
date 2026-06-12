import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from '../constants/theme';

// Ticket stub overlay icon (mockup stub: 20pt chip, rect + tear line).
// App-wide "reviewed" badge: render absolutely positioned over poster
// art, gated on userHasReviewed plus the optimistic reviewed-films set.
export default function TicketStub() {
  return (
    <View style={styles.ticketStub}>
      <Svg width={11} height={11} viewBox="0 0 24 24">
        <Rect x={2} y={4} width={20} height={14} rx={2} fill="none" stroke={colors.gold} strokeWidth={1.5} />
        <Path d="M2 8h20" fill="none" stroke={colors.gold} strokeWidth={1.5} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  ticketStub: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    backgroundColor: 'rgba(13,13,26,0.7)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.25)',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
