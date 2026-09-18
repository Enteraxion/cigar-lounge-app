/**
 * `@react-native-firebase/messaging` on the web — real Web Push.
 *
 * This used to report push as permanently unavailable, which made Lounge
 * Alerts a switch that flicked back every time (reported 2026-09-17). The web
 * genuinely does have push; it just reaches the device by a different road.
 * FCM sends to a web token exactly as it sends to an APNs one, so the Cloud
 * Function that delivers notifications needs no change at all — the token
 * document simply records `platform: 'web'`.
 *
 * Three things differ from a phone, and each is handled rather than hidden:
 *
 * 1. **A service worker does the receiving.** public/firebase-messaging-sw.js
 *    is registered here and handed to getToken; without it the browser has
 *    nowhere to deliver a message while the tab is closed.
 *
 * 2. **A VAPID key identifies the sender.** Firebase Console → Project
 *    settings → Cloud Messaging → Web Push certificates. It is a PUBLIC key —
 *    it ships in the bundle by design, the same way the Firebase web config
 *    does. Read from VITE_FIREBASE_VAPID_KEY; without it getToken cannot be
 *    called at all, so this reports unsupported rather than throwing, and says
 *    so once in the console.
 *
 * 3. **iOS only allows this from the Home Screen.** Safari exposes no push API
 *    to an ordinary tab; the member must Share → Add to Home Screen first.
 *    `isSupported()` is false there, so the toggle refuses honestly instead of
 *    appearing to work and then never delivering.
 */
import './firebase-app';
import {
  getMessaging as getWebMessaging,
  getToken as getWebToken,
  deleteToken as deleteWebToken,
  isSupported,
  type Messaging,
} from 'firebase/messaging';

/**
 * Mirrors React Native Firebase's enum so pushService.ts can compare against
 * the same constants on both platforms.
 */
export const AuthorizationStatus = {
  NOT_DETERMINED: -1,
  DENIED: 0,
  AUTHORIZED: 1,
  PROVISIONAL: 2,
} as const;

const VAPID_KEY: string | undefined = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let warned = false;
function warnOnce(reason: string): void {
  if (warned) return;
  warned = true;
  console.info(`[push] notifications are not available here: ${reason}`);
}

/**
 * Whether this browser can receive push at all. Cached, because isSupported()
 * probes for a service worker and the Push API every time it is called and the
 * answer cannot change within a page load.
 */
let supported: Promise<boolean> | null = null;
export function pushIsSupported(): Promise<boolean> {
  supported ??= (async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      warnOnce('this browser has no Notification API (on iOS, add the site to your Home Screen)');
      return false;
    }
    if (!(await isSupported())) {
      warnOnce('this browser does not support the Web Push API');
      return false;
    }
    if (!VAPID_KEY) {
      warnOnce('VITE_FIREBASE_VAPID_KEY is not set — add the Web Push certificate from the Firebase console');
      return false;
    }
    return true;
  })();
  return supported;
}

/**
 * The service worker that receives messages while the tab is closed. Scoped to
 * the site root, which is why the file lives in public/ rather than being
 * imported: it has to be served from '/' to be allowed to handle every page.
 */
let registration: Promise<ServiceWorkerRegistration> | null = null;
function serviceWorker(): Promise<ServiceWorkerRegistration> {
  registration ??= navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
  return registration;
}

/** The app is initialised by firebase-app.ts, imported above. */
export function getMessaging(): Messaging | null {
  try {
    return getWebMessaging();
  } catch {
    return null;
  }
}

export async function hasPermission(): Promise<number> {
  if (!(await pushIsSupported())) return AuthorizationStatus.DENIED;
  if (Notification.permission === 'granted') return AuthorizationStatus.AUTHORIZED;
  if (Notification.permission === 'denied') return AuthorizationStatus.DENIED;
  return AuthorizationStatus.NOT_DETERMINED;
}

export async function requestPermission(): Promise<number> {
  if (!(await pushIsSupported())) return AuthorizationStatus.DENIED;
  // Browsers only show this prompt in response to a real gesture, which is why
  // it hangs off the toggle rather than running on load. Asking on load is
  // also how a site gets permanently blocked by Chrome's abuse heuristics.
  const result = await Notification.requestPermission();
  return result === 'granted' ? AuthorizationStatus.AUTHORIZED : AuthorizationStatus.DENIED;
}

export async function getToken(messaging: Messaging | null): Promise<string | null> {
  if (!messaging || !(await pushIsSupported())) return null;
  if (Notification.permission !== 'granted') return null;
  try {
    return await getWebToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await serviceWorker(),
    });
  } catch (error) {
    console.warn('[push] could not obtain a token', error);
    return null;
  }
}

export async function deleteToken(messaging: Messaging | null): Promise<void> {
  if (!messaging || !(await pushIsSupported())) return;
  try {
    await deleteWebToken(messaging);
  } catch {
    // Already gone, or never issued. Either way there is nothing to revoke.
  }
}

/**
 * The web SDK has no token-refresh event — it reissues transparently and the
 * next getToken returns the current value. Returning a working unsubscribe
 * keeps every caller's cleanup path identical across platforms.
 */
export function onTokenRefresh(): () => void {
  return () => {};
}

/**
 * Tapping a notification opens the page through the service worker's own
 * `notificationclick`, which routes by URL rather than by calling back into
 * JavaScript that may not be running. So there is no event to subscribe to
 * here, and none to replay at launch.
 */
export function onNotificationOpenedApp(): () => void {
  return () => {};
}

export async function getInitialNotification(): Promise<null> {
  return null;
}
