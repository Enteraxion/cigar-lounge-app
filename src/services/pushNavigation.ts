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
 * Opens whatever a notification is about.
 *
 * A tap used to do nothing at all unless the notification carried a lounge id,
 * which meant the ones members care most about — your ID was verified, your ID
 * was rejected — opened the app to wherever it happened to be and left them to
 * find the news themselves (audit F14, 2026-09-14).
 *
 * There is still nothing to guess at: rather than invent a destination, a
 * notification with no lounge now opens the notifications list, where the
 * message they just tapped is the first thing on the screen. That is the
 * honest answer to "show me what you just told me about".
 */
function openFrom(message: FirebaseMessagingTypes.RemoteMessage | null): void {
  if (!message || !navigationRef.isReady()) {
    return;
  }
  const loungeId = message.data?.loungeId;
  if (typeof loungeId !== 'string' || !loungeId) {
    (navigationRef.navigate as (name: string, params?: object) => void)('Notifications');
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
