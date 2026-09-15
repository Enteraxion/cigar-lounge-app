/**
 * Cigar Lounge Locator — "The Reserve"
 * Bare React Native CLI app (no Expo).
 *
 * @format
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import {
  listenForNotificationTaps,
  navigationRef,
} from './src/services/pushNavigation';

function App() {
  // Tapping a push opens the lounge it is about. Mounted here rather than inside
  // AppNavigator because one of the two events it handles is the notification
  // that LAUNCHED a quit app, which resolves once and early — before any screen
  // exists to listen for it.
  useEffect(() => listenForNotificationTaps(), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/*
        One status bar for the whole app.
        Three auth screens set this themselves and the other eighty-eight did
        not, so on Android every other screen showed a pale grey strip above a
        black app (first Android run, 2026-09-15).
        Setting `android:statusBarColor` in the theme does NOT fix it: from
        Android 15, an app targeting SDK 35 or above is edge-to-edge whether it
        asks to be or not, and that attribute is ignored. The platform's answer
        is a transparent bar with the app drawing behind it — which is what
        `translucent` does — and the screens already inset correctly for it via
        SafeAreaView's `top` edge.
        `light-content` because the ground behind it is always near-black. iOS
        reads only barStyle and ignores the rest, so this is one declaration
        for both platforms.
      */}
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef}>
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
