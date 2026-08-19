/**
 * Emails allowed to review pending lounge claims (see
 * AdminClaimReviewScreen.tsx / ownerService.approveLoungeClaim). This
 * list only gates the UI (hides/shows the review screen) — the actual
 * enforcement is in firestore.rules's isAdmin(), which must be kept in
 * sync with this array by hand (Firestore rules can't import this file).
 * Add real team emails to BOTH places as needed.
 */
export const ADMIN_EMAILS: string[] = [
  // Reset to a single account on 2026-08-19 at Rohith's request. Months of claim
  // testing had left it unclear which shop belonged to whom, so every account was
  // deleted (scripts/resetDatabase.ts) and the team restarted from one known
  // login. The previous four addresses — Rohith's personal and work accounts and
  // Dr. Brinkley's two — went with their accounts.
  //
  // Leaving a deleted admin's address here would be worse than untidy: whoever
  // next signs up with that address inherits admin, because the check is on the
  // email, not on the account it used to belong to.
  'admin123@gmail.com',
];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
