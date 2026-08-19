/**
 * Whether the signed-in member has confirmed their email address, and how to
 * resend the link.
 *
 * Rohith, 2026-08-19, choosing between a real OTP code and Firebase's built-in
 * link: go with the link. It is free, sent by Firebase's own servers, and needs no
 * email provider of ours — `SENDGRID_API_KEY` is still a placeholder, so a code we
 * emailed ourselves would have had nothing to send with.
 *
 * The address **is** a wall, as of later the same day: Rohith asked that nobody
 * reach the app without tapping the link, so AppNavigator holds an unconfirmed
 * member at EmailVerificationRequiredScreen ahead of the ID step. The banner and
 * action-gate branches that came from the earlier, gentler design are kept as
 * defence in depth — if a reload ever fails open they still refuse the three
 * gated actions — but they are not states a member should normally be in.
 *
 * Worth knowing what that costs: email is where sign-up drop-off is worst. Wrong
 * address, spam folder, no signal. The screen answers all three — resend, an
 * explicit "I've confirmed" check, and a sign-out to start over — because a wall
 * standing on an email nobody received is otherwise the end of that member.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { auth, refreshEmailVerified, sendVerificationEmail } from '../services/firebaseAuth';

/**
 * Firebase rate-limits verification emails, and a member who taps twice gets an
 * unexplained failure rather than a second email. Holding the button for a minute
 * makes the limit visible instead.
 */
const RESEND_COOLDOWN_MS = 60_000;

export type EmailVerificationState = {
  /** undefined while unknown — never treat that as unconfirmed. */
  emailVerified: boolean | undefined;
  /** Seconds left before another email may be sent; 0 when ready. */
  cooldownSeconds: number;
  sending: boolean;
  /** Sends another link. Resolves false if it was rate-limited or failed. */
  resend: () => Promise<boolean>;
  /** Re-reads the account, for a screen that wants to check on focus. */
  refresh: () => void;
};

export function useEmailVerification(): EmailVerificationState {
  const [emailVerified, setEmailVerified] = useState<boolean | undefined>(
    // Read synchronously where possible: the flag is already on the cached user,
    // so a signed-in member with a confirmed address never sees the banner flicker.
    auth.currentUser ? auth.currentUser.emailVerified : undefined,
  );
  const [sending, setSending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const lastSentAt = useRef<number | null>(null);

  const refresh = useCallback(() => {
    if (!auth.currentUser) {
      setEmailVerified(undefined);
      return;
    }
    refreshEmailVerified().then(setEmailVerified);
  }, []);

  useEffect(refresh, [refresh]);

  // The link is tapped in a mail app, so the moment worth re-checking is the app
  // coming back to the foreground. Without this the banner would sit there
  // insisting the address is unconfirmed until the ID token happened to refresh.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        refresh();
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  // Ticks the cooldown down so the button can label itself.
  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return;
    }
    const timer = setTimeout(() => {
      const sentAt = lastSentAt.current;
      const remaining = sentAt ? RESEND_COOLDOWN_MS - (Date.now() - sentAt) : 0;
      setCooldownSeconds(remaining > 0 ? Math.ceil(remaining / 1000) : 0);
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldownSeconds]);

  const resend = useCallback(async () => {
    const sentAt = lastSentAt.current;
    if (sending || (sentAt && Date.now() - sentAt < RESEND_COOLDOWN_MS)) {
      return false;
    }
    setSending(true);
    try {
      const sent = await sendVerificationEmail();
      if (sent) {
        lastSentAt.current = Date.now();
        setCooldownSeconds(Math.ceil(RESEND_COOLDOWN_MS / 1000));
      }
      return sent;
    } finally {
      setSending(false);
    }
  }, [sending]);

  return { emailVerified, cooldownSeconds, sending, resend, refresh };
}
