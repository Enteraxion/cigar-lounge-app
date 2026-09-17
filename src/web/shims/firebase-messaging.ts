/**
 * `@react-native-firebase/messaging` on the web.
 *
 * This is the one Firebase module that does NOT map cleanly. The web has push
 * notifications, but they arrive through a service worker and a VAPID key
 * rather than APNs or FCM's native channel, and on iOS they only work at all
 * once the member has added the site to their home screen — which most never
 * do (see the web feasibility report, 2026-09-17).
 *
 * So rather than pretend, this shim reports push as unavailable and does
 * nothing. pushService.ts already treats that correctly: isPushAuthorised()
 * returning false means registerDeviceForPush() returns before asking for a
 * token, no token document is written, and the server simply has nothing to
 * send to. The in-app notification list is unaffected and still works for
 * everyone.
 *
 * Replacing this with real Web Push is a known, separate piece of work.
 */

const NOT_SUPPORTED = 'web-push-not-implemented';

export const AuthorizationStatus = {
  NOT_DETERMINED: -1,
  DENIED: 0,
  AUTHORIZED: 1,
  PROVISIONAL: 2,
} as const;

export function getMessaging(): { kind: string } {
  return { kind: NOT_SUPPORTED };
}

export async function hasPermission(): Promise<number> {
  return AuthorizationStatus.DENIED;
}

export async function requestPermission(): Promise<number> {
  return AuthorizationStatus.DENIED;
}

export async function getToken(): Promise<string | null> {
  return null;
}

export async function deleteToken(): Promise<void> {
  // Nothing was ever registered.
}

/** Returns its unsubscribe function, so callers' cleanup still works. */
export function onTokenRefresh(): () => void {
  return () => {};
}

export function onNotificationOpenedApp(): () => void {
  return () => {};
}

export async function getInitialNotification(): Promise<null> {
  return null;
}
