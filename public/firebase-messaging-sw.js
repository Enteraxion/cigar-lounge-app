/*
 * Receives push notifications while the Lounge Locator tab is closed.
 *
 * A service worker runs outside the app bundle and outside the module system,
 * so it cannot import anything from src/ — it loads the Firebase compat build
 * from Google's CDN, which is the only form that works inside `importScripts`.
 * That is why the Firebase config is repeated here rather than shared with
 * src/web/shims/firebase-app.ts. Keep the two in step; they are the same
 * public web config the Owner and Admin portals use, and a web API key is
 * meant to ship in client code — firestore.rules is the access boundary.
 *
 * Served from public/ so the browser gets it at '/', which is required: a
 * service worker can only control pages at or below its own path.
 */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  projectId: 'the-reserve-app-c44ed',
  appId: '1:345721268939:web:8032a5fda9afbe9147894e',
  storageBucket: 'the-reserve-app-c44ed.firebasestorage.app',
  apiKey: 'AIzaSyBw99La_Ivt6CvVujjRx1kMwCjbBZcBBfA',
  authDomain: 'the-reserve-app-c44ed.firebaseapp.com',
  messagingSenderId: '345721268939',
});

const messaging = firebase.messaging();

/*
 * Every notification this project sends already carries its own title and body
 * — onMemberNotificationCreated writes them once, so there is no second
 * wording to maintain here. `data.link` is where a tap should land.
 */
messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title ?? 'Lounge Locator';
  self.registration.showNotification(title, {
    body: payload.notification?.body ?? '',
    icon: '/assets/lounge-locator-mark.png',
    badge: '/assets/lounge-locator-mark.png',
    data: payload.data ?? {},
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.link || '/';

  /*
   * Focus the app if it is already open rather than opening a second copy —
   * two tabs of the same app, each with its own state, is the usual way this
   * goes wrong.
   */
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ('focus' in client) {
          if ('navigate' in client && target !== '/') client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
