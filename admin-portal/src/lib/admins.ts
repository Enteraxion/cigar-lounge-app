/**
 * Who may use this portal.
 *
 * This list gates the *interface* only. The real boundary is `isAdmin()` in
 * ../../firestore.rules and ../../storage.rules — a non-admin who reached these
 * pages by any means would still be refused by the database on every read and
 * write. What the list buys is a clear "you don't have access" instead of a
 * dashboard full of permission errors.
 *
 * Kept in step by hand with those two rules files. That is one copy fewer than
 * before: the mobile app used to carry the same list in src/config/admins.ts,
 * which meant the admin's email address shipped inside every member's app bundle
 * and could be read out of a downloaded build. Moving admin work here let that
 * file be deleted.
 *
 * Custom claims on the Auth token would remove the duplication entirely and let
 * admins be added without a deploy. Deliberately not done yet — there is exactly
 * one admin (Rohith, 2026-08-21), and a claims-provisioning flow for a single
 * person is machinery without a purpose. Revisit the day there is a second.
 */
export const ADMIN_EMAILS: string[] = ['admin123@gmail.com'];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
