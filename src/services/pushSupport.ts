/**
 * Can this device receive push notifications at all?
 *
 * On a phone, always — the APNs and FCM channels exist whether or not the
 * member has granted permission. So the only question a phone ever has to ask
 * is whether they said yes, and "no" always has the same remedy: Settings.
 *
 * A browser has a second, earlier question, which is why this module exists.
 * Push can be flatly unavailable — an iPhone Safari tab exposes no push API
 * until the site is added to the Home Screen — and that is a different
 * situation from a member who declined, with a different thing to tell them.
 * Answering "you have blocked notifications" to someone who never refused
 * sends them to look for a setting that is not there. See pushSupport.web.ts.
 */
export async function isPushSupported(): Promise<boolean> {
  return true;
}
