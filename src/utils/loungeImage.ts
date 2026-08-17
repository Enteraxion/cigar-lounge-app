/**
 * loungeImage
 *
 * Half the lounges in this app have no photo, and the app was rendering a
 * blank box for every one of them — a lounge card with an empty rectangle
 * where the picture goes reads as broken, not as "no photo available".
 *
 * The cause is structural, not random: Yelp returns a photo with each
 * business, Google Places doesn't unless you ask for it, and
 * `refreshCityLounges` never requested the photos field. So every one of
 * the ~3,300 Google-sourced lounges stored `images: []` while the
 * Yelp-sourced ones stored a real Yelp CDN url.
 *
 * The import now asks Google for photos too, but that only helps lounges
 * refreshed from here on, and a lounge can legitimately have no photo on
 * either service. So this is the last line of defence: a curated
 * cigar-lounge image from src/data/mockImages.ts (the same pool the app
 * has always used where real photography is missing), chosen
 * deterministically from the lounge id so a given lounge always shows the
 * same picture instead of changing every time the list re-renders.
 *
 * It is deliberately generic imagery, never a photo of a *different*
 * lounge — the fallback pool is atmosphere shots, so nothing here can
 * mislead a member into thinking they're looking at this venue.
 */

import { cigarDetails, loungeInteriors, rooftopBars, whiskeyBars } from '../data/mockImages';

const FALLBACKS = [...loungeInteriors, ...whiskeyBars, ...cigarDetails, ...rooftopBars];

/** Stable small hash of the lounge id — same lounge, same fallback, always. */
function hash(id: string): number {
  let value = 0;
  for (let i = 0; i < id.length; i += 1) {
    // |0 coerces to int32, which is the point: it keeps the hash bounded
    // without a modulo on every step.
    // eslint-disable-next-line no-bitwise
    value = (value * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(value);
}

/**
 * The image url to show for a lounge: its own first photo when it has one,
 * otherwise a stable stand-in. Never returns undefined, which is what was
 * producing the blank boxes.
 */
export function loungeImageUri(lounge: { id: string; images?: string[] }): string {
  const own = lounge.images?.[0];
  if (own) {
    return own;
  }
  return FALLBACKS[hash(lounge.id) % FALLBACKS.length];
}

/** Convenience for the `source` prop, which is what most call sites want. */
export function loungeImageSource(lounge: { id: string; images?: string[] }) {
  return { uri: loungeImageUri(lounge) };
}
