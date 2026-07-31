/**
 * MainNavigator
 *
 * Bottom tab navigator shown once a member is logged in: Home, Search,
 * Map, Saved, Profile.
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Search, Map, Heart, User } from 'lucide-react-native';
import HomeScreen from '../screens/HomeScreen';
import SearchNavigator from './SearchNavigator';
import MapScreen from '../screens/MapScreen';
import SavedNavigator from './SavedNavigator';
import ProfileNavigator from './ProfileNavigator';
import { theme } from '../theme';

export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Map: undefined;
  Saved: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, typeof Home> = {
  Home: Home,
  Search: Search,
  Map: Map,
  Saved: Heart,
  Profile: User,
};

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: theme.colors.accentGold,
        tabBarInactiveTintColor: theme.colors.mutedGray,
        // Matches design-reference/Home Screen.pdf (and every other
        // full-screen mockup that shows the nav bar in context): a plain,
        // flush, full-width bottom bar — not the floating rounded "pill"
        // this used to be, which doesn't appear in any of the screen
        // designs and was reading as barely-margined/edge-to-edge on
        // real devices instead of the intentional look it was going for.
        tabBarStyle: {
          height: 64,
          backgroundColor: theme.colors.surfaceNavy,
          borderTopWidth: 1,
          borderTopColor: 'rgba(192, 192, 192, 0.12)',
          paddingTop: theme.spacing.sm,
          paddingHorizontal: theme.spacing.sm,
        },
        tabBarLabelStyle: {
          fontFamily: theme.fontFamily.semibold,
          fontSize: 10,
          letterSpacing: 0.5,
          textTransform: 'uppercase' as const,
        },
        tabBarIcon: ({ color, size }) => {
          const Icon = ICONS[route.name as keyof MainTabParamList];
          return <Icon color={color} size={size ?? 20} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchNavigator} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Saved" component={SavedNavigator} />
      <Tab.Screen name="Profile" component={ProfileNavigator} />
    </Tab.Navigator>
  );
}
