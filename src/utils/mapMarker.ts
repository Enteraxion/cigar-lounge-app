/**
 * Making a custom map marker actually appear on Android.
 *
 * `react-native-maps` lets a Marker take children, which is how both of our
 * maps draw a gold circle with a cigarette in it rather than the stock red
 * teardrop. iOS composites that view straight onto the map. Android does not:
 * it rasterises the view to a bitmap, and only while `tracksViewChanges` is
 * true.
 *
 * The advice everywhere — including react-native-maps' own docs — is to pass
 * `tracksViewChanges={false}`, because re-rasterising 150 markers on every
 * frame is genuinely expensive. Do that from the first render, though, and the
 * snapshot is taken before the view has drawn: the marker exists, responds to
 * taps, and is completely invisible. Both of our maps did exactly that, and
 * nobody noticed for the eight weeks Android had no real map to draw them on
 * (2026-09-15).
 *
 * So: track briefly, then stop. `redrawKey` reopens the window whenever the
 * marker's appearance changes — selection, in MapScreen's case — because a
 * marker that has stopped tracking keeps the picture it last took.
 */

import { useEffect, useState } from 'react';

/** How long to keep rasterising. Long enough for layout, short enough not to cost. */
const TRACK_MS = 600;

export function useMarkerTracking(redrawKey?: unknown): boolean {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => setTracksViewChanges(false), TRACK_MS);
    return () => clearTimeout(timer);
  }, [redrawKey]);

  return tracksViewChanges;
}
