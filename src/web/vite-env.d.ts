/// <reference types="vite/client" />

/**
 * The build-time configuration the web app reads.
 *
 * Declared rather than cast at each use: both of these are optional, and a
 * typo in one would otherwise be a silently empty string that disables a whole
 * feature with no error anywhere. Both are PUBLIC values that ship in the
 * bundle by design — a Maps key is restricted by HTTP referrer, and a VAPID
 * key identifies the sender rather than authorising anything.
 */
interface ImportMetaEnv {
  /** Google Maps JavaScript API key, restricted by HTTP referrer. */
  readonly VITE_GOOGLE_MAPS_KEY?: string;
  /** Web Push certificate: Firebase Console → Cloud Messaging → Web Push. */
  readonly VITE_FIREBASE_VAPID_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
