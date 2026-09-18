/**
 * `react-native/Libraries/ReactNative/AppContainer` on the web.
 *
 * react-native-screens reaches for React Native's internal root container.
 * react-native-web has no such module, and on the web there is nothing for it
 * to do — the app is already mounted into a DOM node by index.web.tsx. So this
 * simply renders its children.
 */
import React from 'react';

export default function AppContainer({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}
