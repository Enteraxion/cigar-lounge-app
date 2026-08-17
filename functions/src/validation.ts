/**
 * Request validation helpers — pure, and in their own module so they can be
 * tested without booting firebase-functions.
 *
 * They throw HttpsError directly because the correct status code is part of
 * the validation decision: a bad party size is `invalid-argument`, not a 500,
 * and getting that wrong is one of the things this pass set out to fix.
 */

import { HttpsError } from 'firebase-functions/v2/https';

/*
// Three of these functions previously validated only that a field was
// present, then interpolated it straight into an outbound HTTP call or an
// email body — and had no try/catch, so a Yelp or SendGrid outage surfaced
// to the client as `internal` carrying whatever the underlying library put
// in its message. That is both a poor error and an information leak.
*/

/** Trimmed string with a hard length cap, so nothing unbounded is forwarded. */
export function requireString(value: unknown, field: string, maxLength = 200): string {
  const text = String(value ?? '').trim();
  if (!text) {
    throw new HttpsError('invalid-argument', `${field} is required.`);
  }
  if (text.length > maxLength) {
    throw new HttpsError('invalid-argument', `${field} must be ${maxLength} characters or fewer.`);
  }
  return text;
}

export function optionalString(value: unknown, field: string, maxLength = 200): string {
  const text = String(value ?? '').trim();
  if (text.length > maxLength) {
    throw new HttpsError('invalid-argument', `${field} must be ${maxLength} characters or fewer.`);
  }
  return text;
}

/** Deliberately permissive — this rejects obvious junk, not exotic-but-valid addresses. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function requireEmail(value: unknown, field: string): string {
  const email = requireString(value, field, 254);
  if (!EMAIL_SHAPE.test(email)) {
    throw new HttpsError('invalid-argument', `${field} must be a valid email address.`);
  }
  return email;
}

