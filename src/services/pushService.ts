/**
 * pushService
 *
 * Registering a device to receive push notifications, and forgetting it again.
 *
 * The in-app notification list (NotificationsScreen) has existed for a while and
 * it only works for somebody who opens the app and taps the bell. For an owner
 * being told a table was booked for tonight, that is not a notification, it is a
 * record — Rohith, 2026-09-13. This is the delivery half.
 *
 * **Tokens live in a subcollection, not a field.** A member signs in on more than
 * one device, and a field would mean the newest phone silently stops the older
 * one receiving anything. `users/{uid}/fcmTokens/{token}` holds one document per
 * device, keyed by the token itself so re-registering the same device is
 * idempotent rather than accumulating duplicates.
 *
 * **Permission is requested at a moment it makes sense**, not on first launch.
 * iOS gives an app one chance at that prompt for the life of the install: refuse
 * it and the only way back is Settings, which nobody does. So this is called
 * after submitting an ID — the point at which a member is actively waiting to be
 * told something — rather than the first time the app opens.
 */

import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  deleteToken,
  requestPermission,
  hasPermission,
  onTokenRefresh,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import {
  getFirestore,
  collection,
  doc,
  deleteDoc,
  setDoc,
  Timestamp,
} from '@react-native-firebase/firestore';
import { Platform } from 'react-native';

const db = getFirestore();
const messaging = getMessaging(getApp());

/** Where a device's token lives. One document per device. */
function tokenRef(userId: string, token: string) {
  return doc(collection(db, 'users', userId, 'fcmTokens'), token);
}

/** Whether this install has already been granted permission, without prompting. */
export async function isPushAuthorised(): Promise<boolean> {
  try {
    const status = await hasPermission(messaging);
    return (
      status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL
    );
  } catch {
    return false;
  }
}

/**
 * Stores this device's token against the member.
 *
 * Safe to call on every launch: writing the same token to the same document id
 * is a no-op beyond refreshing `updatedAt`, which is what lets the server prune
 * devices that have not checked in for months.
 *
 * Silent on failure by design. A member whose token could not be saved still has
 * a working app and the in-app list; an error here is our problem, not theirs.
 */
export async function registerDeviceForPush(userId: string): Promise<void> {
  try {
    if (!(await isPushAuthorised())) {
      return;
    }
    const token = await getToken(messaging);
    if (!token) {
      return;
    }
    await setDoc(tokenRef(userId, token), {
      platform: Platform.OS,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.warn('[push] could not register this device', error);
  }
}

/**
 * Asks for permission, then registers.
 *
 * Returns whether push is now available, so a caller can word what it says next
 * honestly rather than promising a notification it cannot send.
 */
export async function askForPushPermission(userId: string): Promise<boolean> {
  try {
    const status = await requestPermission(messaging);
    const granted =
      status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
    if (granted) {
      await registerDeviceForPush(userId);
    }
    return granted;
  } catch {
    return false;
  }
}

/**
 * Keeps the stored token current.
 *
 * FCM rotates tokens — on reinstall, on restore from backup, occasionally on its
 * own. A token that has rotated is not an error and produces no event anywhere
 * else; the first anyone would know is that notifications quietly stopped.
 *
 * Returns its unsubscribe function.
 */
export function watchPushToken(userId: string): () => void {
  return onTokenRefresh(messaging, async token => {
    try {
      await setDoc(tokenRef(userId, token), {
        platform: Platform.OS,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.warn('[push] could not save a refreshed token', error);
    }
  });
}

/**
 * Forgets this device on sign-out.
 *
 * Without this, the next person to sign in on a shared phone keeps receiving the
 * previous member's reservations — and on a lounge owner's device that leaks who
 * booked what. Deleting the FCM token as well as the document stops the token
 * being reissued for the same install.
 */
export async function unregisterDeviceForPush(userId: string): Promise<void> {
  try {
    const token = await getToken(messaging).catch(() => null);
    if (token) {
      await deleteDoc(tokenRef(userId, token)).catch(() => {});
    }
    await deleteToken(messaging).catch(() => {});
  } catch (error) {
    console.warn('[push] could not unregister this device', error);
  }
}
