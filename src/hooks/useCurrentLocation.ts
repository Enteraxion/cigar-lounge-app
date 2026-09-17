/**
 * useCurrentLocation
 *
 * Real device GPS, shared by MapScreen, HomeScreen, SearchResultsScreen,
 * and FilterBottomSheet so "near me" sorting/filtering and the map's
 * initial region all use the same actual position instead of each
 * screen independently hardcoding src/data/mockMap.ts's `defaultRegion`.
 *
 * iOS permission handling is explicit rather than implicit. The previous
 * version relied on `getCurrentPosition` triggering the system prompt on
 * its own — true of React Native's old built-in geolocation, but
 * @react-native-community/geolocation wants `setRNConfiguration` plus a
 * `requestAuthorization` call, and without them the prompt could simply
 * never appear, leaving the app permanently on its fallback coordinate
 * with nothing on screen explaining why.
 *
 * `authorizationLevel` is pinned to 'whenInUse'. The default is 'auto',
 * which picks the strongest permission the Info.plist has a description
 * for — and because this app declares
 * NSLocationAlwaysAndWhenInUseUsageDescription as well, 'auto' asks for
 * *always*. Nothing here needs background location, and asking for more
 * than you need is both a worse prompt for the member and something App
 * Review pushes back on.
 *
 * Falls back from a fast, low-accuracy fix to a slower high-accuracy one:
 * a cold device with no cached position fails the first call quickly, and
 * giving up there was leaving members with no location at all.
 */

import { useCallback, useEffect, useState } from 'react';
// Imported as a namespace rather than by name: PermissionsAndroid does not
// exist in react-native-web, and a named import of something the module does
// not export fails the web build even though the only code path that touches
// it is guarded by Platform.OS === 'android' below (2026-09-17).
import * as ReactNative from 'react-native';

const { Platform } = ReactNative;
import Geolocation from '@react-native-community/geolocation';

export type CurrentLocation = { latitude: number; longitude: number };

Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'whenInUse',
  // Uses Apple's location services rather than the deprecated
  // MapKit-based path on iOS.
  enableBackgroundLocationUpdates: false,
  locationProvider: 'auto',
});

async function requestAndroidPermission(): Promise<boolean> {
  const { PermissionsAndroid } = ReactNative;
  if (!PermissionsAndroid) {
    return false;
  }
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export function useCurrentLocation() {
  const [location, setLocation] = useState<CurrentLocation | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;

    const succeed = (position: { coords: { latitude: number; longitude: number } }) => {
      if (cancelled) return;
      setPermissionDenied(false);
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    };

    const fail = () => {
      if (!cancelled) setPermissionDenied(true);
    };

    async function fetchLocation() {
      if (Platform.OS === 'android') {
        const granted = await requestAndroidPermission();
        if (!granted) {
          fail();
          return;
        }
      } else {
        // Explicit on iOS — see this file's header for why relying on
        // getCurrentPosition to raise the prompt isn't enough.
        Geolocation.requestAuthorization(
          () => {},
          () => fail(),
        );
      }

      Geolocation.getCurrentPosition(succeed, () => {
        if (cancelled) return;
        // A cold device with no cached fix fails the cheap call fast.
        // Retry once, paying for accuracy, before declaring no location.
        Geolocation.getCurrentPosition(succeed, fail, {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        });
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
    }

    fetchLocation();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  /**
   * True once we know the answer either way — a fix arrived, or we gave up.
   *
   * Screens that fetch data anchored to the member's position need this. Firing
   * on first render instead means one query against the static fallback region
   * and then a second, real one a moment later; the first is wasted, and while
   * it is on screen it shows the wrong place. MapScreen was rendering pins and
   * a selected-lounge card for Kansas while the map animated to the member's
   * actual city.
   *
   * Always resolves: `fail()` also runs on the geolocation timeout, not only on
   * a denied permission, so nothing waits on this indefinitely.
   */
  const settled = location !== null || permissionDenied;

  /** Lets a screen offer a "try again" after the member enables location. */
  return { location, permissionDenied, settled, retry: load };
}
