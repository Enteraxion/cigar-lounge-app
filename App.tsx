/**
 * Cigar Lounge Locator — "The Reserve"
 * Bare React Native CLI app (no Expo).
 *
 * @format
 */

import React, { useEffect } from 'react';
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
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef}>
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
