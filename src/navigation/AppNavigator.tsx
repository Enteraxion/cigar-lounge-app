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
import { useAgeVerification } from '../hooks/useAgeVerification';
import AgeVerificationRequiredScreen from '../screens/AgeVerificationRequiredScreen';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  /** The mandatory ID-upload step, shown instead of Main until an ID exists. */
  AgeVerificationRequired: undefined;
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
  const { loading: ageLoading, mustUploadId, reload: reloadAge } = useAgeVerification();

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

  // Don't decide the gate while the verification read is still in flight — a
  // signed-in member would flash the upload screen and then be bounced out of
  // it, which reads as a glitch.
  if (user && ageLoading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user && mustUploadId ? (
        /* Step 2 of the 21+ flow: the ID upload is a required step immediately
           after sign-up, so it replaces Main rather than sitting inside it —
           there is no tab bar to escape through and nothing to skip. Only
           reached when the record is pending AND carries no image; once one is
           attached the member is let straight in (step 3). */
        <Stack.Screen name="AgeVerificationRequired">
          {() => <AgeVerificationRequiredScreen onSubmitted={reloadAge} />}
        </Stack.Screen>
      ) : user ? (
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
