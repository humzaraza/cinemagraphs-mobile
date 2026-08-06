import { useEffect } from 'react';
import { Tabs, Redirect, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import { AppState, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts } from '../../src/constants/theme';
import { useAuth } from '../../src/providers/AuthProvider';
import { fetchUnreadActivity } from '../../src/lib/api';
import { setUnreadActivity, useUnreadActivity } from '../../src/lib/unread-activity';

// Foreground poll cadence for the unread-activity flag. 60s keeps the dot
// at most a minute stale for a user who leaves the app open, while capping
// the cost at one request per minute per foregrounded client; shorter
// intervals buy little perceived freshness for a strictly boolean dot but
// multiply server load across every open app.
const UNREAD_POLL_INTERVAL_MS = 60_000;

// Icon plus a self-rendered unread dot. Deliberately not tabBarBadge: the
// server only exposes a boolean, so a numbered badge would be wrong.
function ActivityTabIcon({ color }: { color: string }) {
  const unread = useUnreadActivity();
  return (
    <View style={styles.activityIconWrap}>
      <Ionicons name="pulse" size={22} color={color} />
      {unread && <View style={styles.unreadDot} />}
    </View>
  );
}

export default function TabLayout() {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  // Suspend polling while the Activity screen is focused: visiting it marks
  // everything seen, so a dot appearing mid-visit would contradict what the
  // user is looking at. Polling resumes when they navigate away.
  const activityFocused = pathname === '/activity';

  // Seed the unread dot once the tab bar is up. Fire-and-forget: a null
  // (failed) check just leaves the dot off until the next app open.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    fetchUnreadActivity().then((unread) => {
      if (!cancelled && unread !== null) setUnreadActivity(unread);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Keep the dot fresh after the mount seed: poll while foregrounded and
  // re-fetch on every return to the foreground. Deliberately a separate
  // AppState listener from AuthProvider's - that one refreshes the auth
  // token, this one refreshes the unread flag; coupling them would tie the
  // dot's cadence to token lifecycle concerns.
  useEffect(() => {
    if (!isAuthenticated || activityFocused) return;

    let cancelled = false;
    const refetch = () => {
      fetchUnreadActivity().then((unread) => {
        if (!cancelled && unread !== null) setUnreadActivity(unread);
      });
    };

    // Only tick while foregrounded; a backgrounded app makes no requests.
    let interval: ReturnType<typeof setInterval> | null =
      AppState.currentState === 'active'
        ? setInterval(refetch, UNREAD_POLL_INTERVAL_MS)
        : null;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refetch();
        if (interval === null) {
          interval = setInterval(refetch, UNREAD_POLL_INTERVAL_MS);
        }
      } else if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    });

    return () => {
      cancelled = true;
      if (interval !== null) clearInterval(interval);
      subscription.remove();
    };
  }, [isAuthenticated, activityFocused]);

  if (!isAuthenticated) return <Redirect href="/(auth)/landing" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <BlurView
            intensity={80}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="filmstrip" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => (
            <Ionicons name="search" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color }) => <ActivityTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-outline" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderTopWidth: 0.5,
    borderTopColor: colors.tabBarBorder,
    elevation: 0,
  },
  tabBarLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
  },
  activityIconWrap: {
    width: 22,
    height: 22,
  },
  unreadDot: {
    position: 'absolute',
    top: -1,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
    // Ring in the tab bar's base color so the dot separates from the
    // icon when the tab is active (gold on gold).
    borderWidth: 1.5,
    borderColor: colors.background,
  },
});
