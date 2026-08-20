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
import { Image, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import VoiceSearchScreen from '../screens/VoiceSearchScreen';
import ConciergeNavigator from './ConciergeNavigator';
import NotificationsScreen from '../screens/NotificationsScreen';
import {
  auth,
  onAuthStateChanged,
  isSignUpTransitionActive,
  setSignUpTransitionEndListener,
  type AuthUser,
} from '../services/firebaseAuth';
import { theme } from '../theme';
import { useAgeVerification } from '../hooks/useAgeVerification';
import { useEmailVerification } from '../hooks/useEmailVerification';
import AgeVerificationRequiredScreen from '../screens/AgeVerificationRequiredScreen';
import EmailVerificationRequiredScreen from '../screens/EmailVerificationRequiredScreen';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  /** The mandatory ID-upload step, shown instead of Main until an ID exists. */
  AgeVerificationRequired: undefined;
  /** The mandatory email-confirmation step, ahead of the ID one. */
  EmailVerificationRequired: undefined;
  VoiceSearch: undefined;
  AIConcierge: undefined;
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Shown while the session and the two verification reads resolve.
 *
 * The logo rather than the bare flame mark, so the moment before the app appears
 * is branded instead of looking like a stall. The asset is the same artwork as
 * the app icon (design-reference/logo), which makes this read as a continuation
 * of the icon the member just tapped rather than a different screen.
 *
 * `resizeMode="contain"` because the source is square with the gold ring's
 * straight edges close to the frame — cover would crop the ring and it would read
 * as a mistake rather than a crop.
 */
function SplashScreen() {
  return (
    <View style={splashStyles.screen}>
      <Image
        source={require('../../assets/images/lounge-locator-logo.png')}
        style={splashStyles.logo}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="Lounge Locator"
      />
    </View>
  );
}

const splashStyles = StyleSheet.create({
  screen: {
    flex: 1,
    // The logo carries its own near-black ground, so the screen matches it —
    // otherwise the badge sits in a visible lighter square.
    backgroundColor: theme.colors.primaryBlack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 140, height: 140 },
});

export default function AppNavigator() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const { loading: ageLoading, mustUploadId, reload: reloadAge } = useAgeVerification();
  const { emailVerified } = useEmailVerification();

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

  // The listener above deliberately ignores the signed-in event that
  // createUserWithEmailAndPassword fires, because at that moment the new
  // member's age-verification record does not exist yet and the 21+ gate would
  // evaluate against nothing. Sign-up releases this once the record is written,
  // and only then does the session become visible here — which is what makes the
  // ID upload the immediate next screen rather than a login form.
  useEffect(() => {
    setSignUpTransitionEndListener(() => {
      setUser(auth.currentUser);
      setInitializing(false);
      reloadAge();
    });
    return () => setSignUpTransitionEndListener(null);
  }, [reloadAge]);

  if (initializing) {
    return <SplashScreen />;
  }

  // Don't decide either gate while its read is still in flight — a signed-in
  // member would flash a wall and then be bounced out of it, which reads as a
  // glitch. `emailVerified === undefined` is "not known yet" and must never be
  // treated as "unconfirmed", or every cold start walls a member who is fine.
  if (user && (ageLoading || emailVerified === undefined)) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user && emailVerified === false ? (
        /* Rohith, 2026-08-19: nobody reaches the app without tapping the link.
           Placed AHEAD of the ID wall on purpose — it is the cheaper of the two
           to clear, and there is no point asking someone to photograph a licence
           for an account whose address may not even be real. */
        <Stack.Screen
          name="EmailVerificationRequired"
          component={EmailVerificationRequiredScreen}
        />
      ) : user && mustUploadId ? (
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
