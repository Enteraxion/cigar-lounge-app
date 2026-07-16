/**
 * Centralized mock photography for every screen's placeholder imagery.
 *
 * NOTE: Unsplash's keyword-search endpoint (source.unsplash.com) was
 * discontinued in 2023 and now returns 503s, and loremflickr.com's
 * keyword matching turned out to be unreliable (wrong/unrelated photos
 * for niche multi-word searches — e.g. a cat statue for "leather
 * armchair"). Instead, each URL below is a specific, hand-picked
 * Unsplash photo (a real photo ID on images.unsplash.com), manually
 * verified to match the app's dark, premium cigar-lounge aesthetic —
 * leather interiors, humidors, whiskey bars, and rooftop bars at night.
 */

const unsplash = (photoId: string) =>
  `https://images.unsplash.com/${photoId}?w=800&h=600&fit=crop&q=80`;

// Dark leather lounge interiors — lounge cards, featured lounge hero
export const loungeInteriors = [
  unsplash('photo-1756981168649-0e3c3c8a32f3'), // dark cigar room, green leather chesterfield
  unsplash('photo-1690944258735-c033b1c64f87'), // dark wood bar, backlit bottle shelves
  // NOTE: the former index 1 ('photo-1612731397462-d6c4f17cbb3e' — a chair
  // against a wall with framed VOGUE magazine posters) was removed for
  // being off-theme; every reference to it was replaced with a different
  // on-theme image from another category below.
];

// Cigars and tasting details — Cigar of the Week, humidor inventory
export const cigarDetails = [
  unsplash('photo-1547652577-b4fe2f34d7ee'), // cigars, cutter, and whiskey on a tray
  unsplash('photo-1612659429081-4d261418adc1'), // bundled cigars beside a scotch glass
  unsplash('photo-1717932936440-c10ccdc4a8e4'), // open cigar box, anniversary series
];

// Whiskey / bar imagery — bar counters, spirits shelves
export const whiskeyBars = [
  unsplash('photo-1681641095235-4031b7633c12'), // hand holding whiskey glass at a bar
  unsplash('photo-1777791374978-52b551aa0f07'), // dark bottles with gold caps on a shelf
];

// Rooftop bars at night — outdoor terrace / skyline lounge shots
export const rooftopBars = [
  unsplash('photo-1738874016491-12449bd932a7'), // city skyline at dusk from a rooftop
  unsplash('photo-1684575571081-d6abda485519'), // Las Vegas Strip from a rooftop lounge
];

// Moody city skylines at night — Popular Destinations, travel guides
export const cityNightscapes = [
  unsplash('photo-1690398388394-6a57f7f4fff1'), // Miami skyline at night
  unsplash('photo-1616624446421-b6a136da737d'), // Chicago skyline at night
  unsplash('photo-1744696008558-f91934254fe4'), // Los Angeles skyline at dusk
  unsplash('photo-1684575571081-d6abda485519'), // Las Vegas Strip at night
  unsplash('photo-1628652463675-0fdec7294acd'), // Tokyo skyline at night (Nashville stand-in)
];

// Member portrait placeholder — header avatar
export const memberPortrait = unsplash('photo-1758518729058-b158e71c5a9b');
