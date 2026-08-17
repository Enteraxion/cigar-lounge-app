/**
 * Where the shop-owner web dashboard lives.
 *
 * The portal (owner-portal/, deployed to its own Hosting site) is where an
 * approved owner does the substantial work: events, inventory, reservations
 * and photo-heavy listing edits. The mobile app deliberately carries only the
 * light edit — see EditListingScreen — because the app's audience is members
 * looking for somewhere to smoke, not owners running a business.
 *
 * Kept here rather than inlined so the approval notification, the My Shops
 * screen and anywhere else that points an owner at the portal can never drift
 * to different URLs.
 */

export const OWNER_PORTAL_URL = 'https://reserve-owner-portal.web.app';

/**
 * What the portal can do that the app can't. Shown to an owner so the trip to
 * a browser is an informed one rather than a dead-end link.
 */
export const OWNER_PORTAL_FEATURES = [
  'Post events members can see in the app',
  'Manage your cigar inventory',
  'Review table reservations',
] as const;
