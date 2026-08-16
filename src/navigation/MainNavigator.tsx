/**
 * MainNavigator
 *
 * Bottom tab navigator shown once a member is logged in: Home, Search,
 * Map, Saved, Profile.
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute, type RouteProp } from '@react-navigation/native';
import { Home, Search, Map, Heart, User } from 'lucide-react-native';
import HomeScreen from '../screens/HomeScreen';
import SearchNavigator, { type SearchStackParamList } from './SearchNavigator';
import MapScreen from '../screens/MapScreen';
import SavedNavigator from './SavedNavigator';
import ProfileNavigator from './ProfileNavigator';
import { theme } from '../theme';

/**
 * Full-screen "takeover" moments inside the Search stack (ReviewSubmitted,
 * ClaimSubmitted, ReservationConfirmed) hide the tab bar while focused —
 * computed here from the focused route name rather than each of those
 * screens calling `navigation.getParent()?.setOptions(...)` in a
 * useEffect. That per-screen pattern is fragile: setOptions writes an
 * explicit (if undefined) tabBarStyle onto the Search tab's own route
 * options, which then permanently shadows this navigator's computed
 * FLOATING_TAB_BAR_STYLE below for that tab — so returning from one of
 * those screens could leave the tab bar visually broken or entirely
 * unresponsive instead of restoring the real floating pill style (bug
 * reported 2026-08-13: stuck after "Return to Lounge"). Deriving the
 * style fresh from the current route on every render removes the
 * stale-override entirely.
 */
const HIDDEN_TAB_BAR_ROUTES = ['ReviewSubmitted', 'ClaimSubmitted', 'ReservationConfirmed'];

const FLOATING_TAB_BAR_STYLE = {
  position: 'absolute' as const,
  left: theme.spacing.lg,
  right: theme.spacing.lg,
  bottom: theme.spacing.lg,
  height: 64,
  borderRadius: theme.radius.xl,
  backgroundColor: theme.colors.surfaceNavy,
  borderTopWidth: 0,
  paddingTop: theme.spacing.sm,
  paddingHorizontal: theme.spacing.sm,
  ...theme.shadows.deep,
};

/**
 * Bottom-tabs' default `tabPress` behavior does nothing when the pressed
 * tab is already focused — it doesn't reset a nested stack back to its
 * root screen the way most apps' tab bars do (bug reported 2026-08-13:
 * tapping Search again after navigating deeper into it does nothing).
 * This wires that expected behavior explicitly for each tab whose
 * component is itself a nested stack (Search/Saved/Profile) — Home and
 * Map are leaf screens with no nested stack to reset.
 */
function resetToRootOnRepeatPress(rootScreenName: string) {
  return ({
    navigation,
    route,
  }: {
    navigation: { isFocused: () => boolean; navigate: (name: string, params?: object) => void };
    route: { name: string };
  }) => ({
    tabPress: (e: { preventDefault: () => void }) => {
      if (navigation.isFocused()) {
        e.preventDefault();
        navigation.navigate(route.name, { screen: rootScreenName });
      }
    },
  });
}

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
        // Deliberate departure from design-reference/Home Screen.pdf,
        // which actually shows a flush, full-width bar — product decision
        // to use a floating rounded pill instead (explicitly requested),
        // not a design-matching bug fix like the flush version was.
        tabBarStyle: FLOATING_TAB_BAR_STYLE,
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
      <Tab.Screen
        name="Search"
        component={SearchNavigator}
        options={({ route }) => {
          const focusedRouteName =
            getFocusedRouteNameFromRoute(route as RouteProp<MainTabParamList, 'Search'>) ??
            ('SearchHome' as keyof SearchStackParamList);
          return {
            tabBarStyle: HIDDEN_TAB_BAR_ROUTES.includes(focusedRouteName)
              ? { display: 'none' as const }
              : FLOATING_TAB_BAR_STYLE,
          };
        }}
        listeners={resetToRootOnRepeatPress('SearchHome')}
      />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen
        name="Saved"
        component={SavedNavigator}
        listeners={resetToRootOnRepeatPress('FavoritesHome')}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileNavigator}
        listeners={resetToRootOnRepeatPress('ProfileHome')}
      />
    </Tab.Navigator>
  );
}
