/**
 * `@react-native-community/geolocation` on the web.
 *
 * The browser has had this natively for years and the shapes already match —
 * `getCurrentPosition` takes the same success and error callbacks and hands
 * back the same `coords.latitude` / `coords.longitude`. The only differences
 * are the two native-only calls, which have nothing to configure here.
 */

function getCurrentPosition(
  success: (position: GeolocationPosition) => void,
  error?: (err: GeolocationPositionError) => void,
  options?: PositionOptions,
): void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    error?.({ code: 2, message: 'Location is unavailable in this browser' } as GeolocationPositionError);
    return;
  }
  navigator.geolocation.getCurrentPosition(success, error, options);
}

/** The browser asks for permission on first use, so there is nothing to request. */
function requestAuthorization(onGranted?: () => void): void {
  onGranted?.();
}

/** Native-only configuration; nothing to set in a browser. */
function setRNConfiguration(): void {}

export default { getCurrentPosition, requestAuthorization, setRNConfiguration };
export { getCurrentPosition, requestAuthorization, setRNConfiguration };
