/**
 * `react-native` on the web.
 *
 * Almost everything comes straight from react-native-web — this exists only
 * to replace the handful of its exports that are silently inert, where the app
 * depends on them actually doing something.
 *
 * An explicit export below wins over the `export *`, so each override replaces
 * react-native-web's version everywhere in the app without a single import
 * changing.
 *
 * What is replaced, and why:
 *
 *   Alert        react-native-web's is `static alert() {}` — an empty
 *                function. Log Out and Delete Account both ask before they
 *                act, so both buttons did nothing at all. See ./alert.ts.
 *
 *   Linking      react-native-web has no `openSettings` at all, so calling it
 *                throws rather than no-ops. See below.
 *
 * Everything else react-native-web stubs out is genuinely irrelevant here:
 * StatusBar and BackHandler have no meaning in a browser tab, and LogBox is a
 * development overlay.
 */
export * from 'react-native-web';

export { default as Alert } from './alert';

import { Linking as WebLinking } from 'react-native-web';

/**
 * A browser has no per-app settings screen to open. Notification permission
 * is per-site, and no browser will let a page open its own permission UI —
 * deliberately, since a page that could would just reopen it until you said
 * yes. So there is nothing to navigate to, and callers must say something
 * true instead of offering a button that goes nowhere.
 *
 * Screens ask src/utils/appSettings.ts whether this is possible rather than
 * calling blindly; `openSettings` stays defined here only so that an unchecked
 * call cannot throw the way react-native-web's missing one does.
 */
export const Linking: typeof WebLinking = Object.assign(
  // Object.create, not a spread. react-native-web's Linking is a class
  // INSTANCE, so `{...WebLinking}` copies its own fields and drops every
  // method — openURL included. Inheriting the prototype keeps them, and
  // Object.assign then copies the instance state they read.
  Object.create(Object.getPrototypeOf(WebLinking)) as typeof WebLinking,
  WebLinking,
  {
    async openSettings(): Promise<void> {
      // Intentionally nothing. There is nowhere to go.
    },
  },
);
