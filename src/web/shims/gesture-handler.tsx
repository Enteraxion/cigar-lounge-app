/**
 * `react-native-gesture-handler` on the web.
 *
 * The app uses one thing from it — GestureHandlerRootView, wrapped once around
 * the whole app in App.tsx — but the package drags in a Flow-typed debug view
 * that the web build cannot parse. On the web the root view has nothing to do:
 * the browser handles touch and pointer events itself, and React Navigation's
 * web build does not need the native gesture system.
 *
 * If a real gesture (swipe-to-dismiss, a draggable sheet) is ever added, this
 * shim is where to swap in the library's own web support.
 */

import React from 'react';
import { View, type ViewProps } from 'react-native';

export function GestureHandlerRootView({ children, style, ...rest }: ViewProps) {
  return (
    <View style={style} {...rest}>
      {children}
    </View>
  );
}

export default { GestureHandlerRootView };
