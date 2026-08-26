/**
 * Where the privacy policy and terms live.
 *
 * Hosted on the project's default Firebase Hosting site (see firebase.json's
 * hosting array — `public/`, which is separate from the owner and admin portal
 * targets). Kept in one place because these URLs appear in the app, in the App
 * Store listing, and in the sign-up consent line, and a policy link that 404s is
 * worse than no link at all.
 *
 * Apple requires a reachable privacy policy for any app on the store, and one
 * that accurately describes what is collected. Ours collects photographs of
 * government identity documents, which is exactly the kind of thing a reviewer
 * checks the policy for.
 */

const BASE = 'https://the-reserve-app-c44ed.web.app';

export const PRIVACY_POLICY_URL = `${BASE}/privacy-policy.html`;
export const TERMS_URL = `${BASE}/terms.html`;
