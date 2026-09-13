/**
 * Opening the right screen when a push notification is tapped.
 *
 * Separate from pushService because this is navigation, not registration, and
 * because it has to work from outside React. A tap arrives from the system —
 * sometimes before any component has mounted, when the app was fully quit — so
 * there is no hook to hang it on and it goes through a navigation ref instead.
 *
 * Two events, and both are needed:
 *
 *  - `onNotificationOpenedApp` fires when the app was in the background. The
 *    navigator already exists, so the jump is immediate.
 *  - `getInitialNotification` returns the notification that *launched* a quit
 *    app. It resolves once, early, and returns null on every later call — so
 *    missing it means the member taps a notification about a booking and lands
 *    on Home with no idea why.
 */

import { createNavigationContainerRef } from '@react-navigation/native';
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  getInitialNotification,
  onNotificationOpenedApp,
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';

export const navigationRef = createNavigationContainerRef();

const messaging = getMessaging(getApp());

/**
 * Opens the lounge a notification is about.
 *
 * Silent when there is no lounge id — several notification types legitimately
 * carry no destination, and the same is true here as on NotificationsScreen:
 * navigating nowhere is better than guessing.
 */
function openFrom(message: FirebaseMessagingTypes.RemoteMessage | null): void {
  const loungeId = message?.data?.loungeId;
  if (typeof loungeId !== 'string' || !loungeId || !navigationRef.isReady()) {
    return;
  }
  // Same two-step as NotificationsScreen: the tab navigator has to be entered
  // before one of its stacks can be addressed.
  (navigationRef.navigate as (name: string, params?: object) => void)('Main', {
    screen: 'Search',
    params: { screen: 'LoungeDetail', params: { loungeId } },
  });
}

/**
 * Starts listening. Returns its unsubscribe function.
 *
 * The cold-start case is deliberately delayed a beat: `getInitialNotification`
 * can resolve before the navigator has finished mounting, and navigating to a
 * ref that is not ready does nothing at all — silently, which is the worst way
 * for this to fail.
 */
export function listenForNotificationTaps(): () => void {
  getInitialNotification(messaging)
    .then(message => {
      if (!message) {
        return;
      }
      const attempt = (remaining: number) => {
        if (navigationRef.isReady()) {
          openFrom(message);
        } else if (remaining > 0) {
          setTimeout(() => attempt(remaining - 1), 150);
        }
      };
      attempt(20);
    })
    .catch(() => {});

  return onNotificationOpenedApp(messaging, openFrom);
}
