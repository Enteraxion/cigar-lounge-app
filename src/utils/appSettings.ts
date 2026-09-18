/**
 * Can we send someone to the operating system's settings for this app?
 *
 * On a phone, yes: iOS gives an app exactly one notification prompt for the
 * life of the install, so once it has been refused the only route back is
 * Settings, and Linking.openSettings goes straight there.
 *
 * In a browser there is no such screen — notification permission is per-site,
 * and no browser lets a page open its own permission UI (a page that could
 * would simply reopen it until you said yes). See appSettings.web.ts.
 *
 * Screens check `canOpenAppSettings` before offering the button, so a member
 * is never handed an "Open Settings" that goes nowhere.
 */
import { Linking } from 'react-native';

export const canOpenAppSettings = true;

export function openAppSettings(): void {
  Linking.openSettings();
}
