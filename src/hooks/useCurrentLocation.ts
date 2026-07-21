/**
 * useCurrentLocation
 *
 * Real device GPS, shared by MapScreen, HomeScreen, SearchResultsScreen,
 * and FilterBottomSheet so "near me" sorting/filtering and the map's
 * initial region all use the same actual position instead of each
 * screen independently hardcoding src/data/mockMap.ts's `defaultRegion`
 * (a static London coordinate).
 *
 * Requests location permission on mount (Android via PermissionsAndroid;
 * iOS prompts automatically off the NSLocationWhenInUseUsageDescription
 * in Info.plist the first time getCurrentPosition is called). If the
 * user denies permission, or the device can't produce a fix, `location`
 * stays null — callers fall back to `defaultRegion` themselves, same as
 * before this hook existed.
 */

import { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export type CurrentLocation = { latitude: number; longitude: number };

async function requestAndroidPermission(): Promise<boolean> {
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export function useCurrentLocation() {
  const [location, setLocation] = useState<CurrentLocation | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchLocation() {
      if (Platform.OS === 'android') {
        const granted = await requestAndroidPermission();
        if (!granted) {
          if (!cancelled) setPermissionDenied(true);
          return;
        }
      }

      Geolocation.getCurrentPosition(
        position => {
          if (cancelled) return;
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          if (!cancelled) setPermissionDenied(true);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      );
    }

    fetchLocation();

    return () => {
      cancelled = true;
    };
  }, []);

  return { location, permissionDenied };
}
