/**
 * Opening a lounge in the phone's maps app.
 *
 * Asked for in the 2026-08-17 demo — Julian wanted the address to trigger
 * navigation, and Lakhan's refinement was that it should be a visible control
 * rather than the address text itself, so that it's discoverable ("it should
 * show that you can basically click on it to navigate rather than just the
 * address").
 *
 * Prefers coordinates over the address string. Every lounge has numeric
 * coordinates (verified: 0 of 8,294 missing) whereas addresses come from Yelp
 * and Google in inconsistent shapes, and geocoding a free-text address can
 * land on the wrong side of a city. The name is passed as a label so the pin
 * reads as the lounge rather than a bare coordinate.
 */
import { Linking, Platform } from 'react-native';

type Target = {
  name: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
};

/**
 * Apple Maps on iOS, Google Maps on Android — each via the documented URL
 * scheme, with an https fallback so this still does something useful if the
 * native app is unavailable.
 */
export function mapsUrlFor(target: Target): string {
  const label = encodeURIComponent(target.name);
  const coords = target.coordinates;

  if (coords) {
    if (Platform.OS === 'ios') {
      // `ll` places the pin precisely; `q` only labels it.
      return `maps://?ll=${coords.lat},${coords.lng}&q=${label}`;
    }
    return `geo:${coords.lat},${coords.lng}?q=${coords.lat},${coords.lng}(${label})`;
  }

  const query = encodeURIComponent(target.address ?? target.name);
  return Platform.OS === 'ios'
    ? `maps://?q=${query}`
    : `geo:0,0?q=${query}`;
}

/** Web Maps, for when no native maps app will take the scheme. */
export function mapsWebUrlFor(target: Target): string {
  const coords = target.coordinates;
  const query = coords
    ? `${coords.lat},${coords.lng}`
    : target.address ?? target.name;
  return `https://maps.apple.com/?q=${encodeURIComponent(query)}`;
}

/**
 * Opens the target, falling back to the web if the scheme can't be handled.
 * Silent on total failure: there is nothing useful to tell someone whose
 * device has no maps app, and an alert over a navigation tap is worse than
 * the tap doing nothing.
 */
export async function openInMaps(target: Target): Promise<void> {
  const url = mapsUrlFor(target);
  try {
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
      return;
    }
    await Linking.openURL(mapsWebUrlFor(target));
  } catch {
    // Intentionally ignored — see above.
  }
}
