import { useEffect } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts } from '../../src/constants/theme';
import { useAuth } from '../../src/providers/AuthProvider';
import { fetchUnreadActivity } from '../../src/lib/api';
import { setUnreadActivity, useUnreadActivity } from '../../src/lib/unread-activity';

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
