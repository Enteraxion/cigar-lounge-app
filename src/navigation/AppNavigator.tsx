/**
 * AppNavigator
 *
 * Top-level stack for the whole app: Login -> Main (tab navigator), plus
 * a couple of full-screen modals (Voice Search, AI Concierge) that are
 * reachable from more than one tab, so they live here instead of inside
 * any single tab's stack — navigate('VoiceSearch' | 'AIConcierge') bubbles
 * up to this navigator from wherever it's called.
 *
 * Session persistence: subscribes to Firebase's onAuthStateChanged for the
 * app's whole lifetime (not just at cold start) to decide whether Auth or
 * Main is mounted, showing a brief branded splash while the first check
 * resolves. The Auth/Main screens are rendered conditionally (React
 * Navigation's standard auth-flow pattern) rather than via
 * initialRouteName, since initialRouteName is only consulted once at
 * mount — it would silently do nothing when signOut() flips `user` back
 * to null later. This is also what makes Log Out (AISettingsScreen) drop
 * straight back to Login with no explicit navigation call needed.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import VoiceSearchScreen from '../screens/VoiceSearchScreen';
import ConciergeNavigator from './ConciergeNavigator';
import NotificationsScreen from '../screens/NotificationsScreen';
import FlameIcon from '../components/FlameIcon';
import {
  auth,
  onAuthStateChanged,
  isSignUpTransitionActive,
  type AuthUser,
} from '../services/firebaseAuth';
import { theme } from '../theme';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  VoiceSearch: undefined;
  AIConcierge: undefined;
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function SplashScreen() {
  return (
    <View style={splashStyles.screen}>
      <FlameIcon size={32} color={theme.colors.secondarySilver} />
    </View>
  );
}

const splashStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.primaryBlack,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function AppNavigator() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, nextUser => {
      if (nextUser && isSignUpTransitionActive()) {
        // Ignore the momentary signed-in state createUserWithEmailAndPassword
        // produces during sign-up — SignUpScreen signs back out right after,
        // which will fire this listener again with null.
        return;
      }
      setUser(nextUser);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  if (initializing) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
      <Stack.Screen
        name="VoiceSearch"
        component={VoiceSearchScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="AIConcierge"
        component={ConciergeNavigator}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
