/**
 * Emails allowed to review pending lounge claims (see
 * AdminClaimReviewScreen.tsx / ownerService.approveLoungeClaim). This
 * list only gates the UI (hides/shows the review screen) — the actual
 * enforcement is in firestore.rules's isAdmin(), which must be kept in
 * sync with this array by hand (Firestore rules can't import this file).
 * Add real team emails to BOTH places as needed.
 */
export const ADMIN_EMAILS: string[] = [
  // Rohith's personal account — the one actually signed into the mobile
  // app day to day. rohith.akepati@enteraxion.com was removed on
  // 2026-08-14 so that account could be used to verify the negative case
  // (a non-admin sees no review screen); add it back when a second real
  // reviewer is needed.
  'rohithakepati@gmail.com',
  // Rohith's work account — the one used on the office Apple ID / device.
  'rohith.akepati@enteraxion.com',
  // Dr. Brinkley, requested in the 2026-08-17 demo so he can exercise Review
  // Business Claims himself. Both addresses are listed because he has a
  // Firebase account under each and signs in with whichever is to hand.
  'julian.brinkley@enteraxion.com',
  'julianlbrinkley@gmail.com',
];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
