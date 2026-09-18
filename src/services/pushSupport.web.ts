/**
 * The browser half — see pushSupport.ts. False when the browser has no Push
 * API (an iPhone Safari tab, until the site is added to the Home Screen) or
 * when the Web Push certificate is not configured.
 */
// The shim by its real path, not through the '@react-native-firebase/messaging'
// alias: the alias exists only in the Vite config, so TypeScript would resolve
// that specifier to the native package — which has no such export. Vite maps
// both to this same file, so there is still only one module at runtime.
import { pushIsSupported } from '../web/shims/firebase-messaging';

export async function isPushSupported(): Promise<boolean> {
  return pushIsSupported();
}
