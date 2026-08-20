/**
 * Whether the signed-in member has confirmed their email address, and how to
 * resend the link.
 *
 * Rohith, 2026-08-19, choosing between a real OTP code and Firebase's built-in
 * link: go with the link. It is free, sent by Firebase's own servers, and needs no
 * email provider of ours — `SENDGRID_API_KEY` is still a placeholder, so a code we
 * emailed ourselves would have had nothing to send with.
 *
 * The address **is** a wall: AppNavigator holds an unconfirmed member at
 * EmailVerificationRequiredScreen ahead of the ID step. The banner and
 * action-gate branches from the earlier, gentler design are kept as defence in
 * depth — if a reload ever fails open they still refuse the three gated actions —
 * but they are not states a member should normally be in.
 *
 * Worth knowing what that costs: email is where sign-up drop-off is worst. Wrong
 * address, spam folder, no signal. The screen answers all three — resend, an
 * explicit "I've confirmed" check, and a sign-out to start over — because a wall
 * standing on an email nobody received is otherwise the end of that member.
 *
 * ---------------------------------------------------------------------------
 * WHY THE STATE IS MODULE-LEVEL AND NOT PER-COMPONENT
 *
 * Five components call this hook, and on 2026-08-20 that broke the wall in a way
 * that looked like a dead button. React state is per component instance, so the
 * wall screen's `refresh()` updated the wall screen's own copy and nothing else.
 * AppNavigator holds a *separate* copy, and the gate reads that one — so a member
 * who had genuinely confirmed their address tapped "I've confirmed — continue",
 * the check succeeded, and they stayed exactly where they were. Nothing failed,
 * so nothing was logged.
 *
 * Firebase does not help here either: `user.reload()` mutates the user object but
 * does not fire `onAuthStateChanged`, so there is no event for other instances to
 * hear.
 *
 * One cache with a listener set means every instance agrees, whichever one did the
 * refreshing. The public API is unchanged, so call sites did not move.
 * ---------------------------------------------------------------------------
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  auth,
  onAuthStateChanged,
  refreshEmailVerified,
  sendVerificationEmail,
} from '../services/firebaseAuth';

/**
 * Firebase rate-limits verification emails, and a member who taps twice gets an
 * unexplained failure rather than a second email. Holding the button for a minute
 * makes the limit visible instead.
 */
const RESEND_COOLDOWN_MS = 60_000;

/** `undefined` means not known yet, and must never be read as "unconfirmed". */
type Verified = boolean | undefined;

let sharedVerified: Verified;
let sharedKnown = false;
const subscribers = new Set<(value: Verified) => void>();

/** Updates the one cache and tells every mounted instance. */
function publish(value: Verified) {
  sharedVerified = value;
  sharedKnown = true;
  subscribers.forEach(notify => notify(value));
}

/**
 * Resets the shared cache. Tests only — the app has one session per process, so
 * nothing in it needs to forget what it knows.
 */
export function __resetEmailVerificationCache() {
  sharedVerified = undefined;
  sharedKnown = false;
  subscribers.clear();
}

export type EmailVerificationState = {
  /** undefined while unknown — never treat that as unconfirmed. */
  emailVerified: Verified;
  /** Seconds left before another email may be sent; 0 when ready. */
  cooldownSeconds: number;
  sending: boolean;
  /** Sends another link. Resolves false if it was rate-limited or failed. */
  resend: () => Promise<boolean>;
  /**
   * Re-reads the account and resolves with what it found, so a caller can act on
   * the answer instead of guessing when it has arrived.
   */
  refresh: () => Promise<Verified>;
};

export function useEmailVerification(): EmailVerificationState {
  const [emailVerified, setEmailVerified] = useState<Verified>(() => {
    if (sharedKnown) {
      return sharedVerified;
    }
    // The flag is already on the cached user, so a member who is signed in and
    // confirmed never sees the wall or the banner flicker on the way past.
    return auth.currentUser ? auth.currentUser.emailVerified : undefined;
  });
  const [sending, setSending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const lastSentAt = useRef<number | null>(null);

  // Every instance listens to the shared cache, so whichever one refreshes, all
  // of them — including the navigator's, which decides the gate — agree.
  useEffect(() => {
    subscribers.add(setEmailVerified);
    return () => {
      subscribers.delete(setEmailVerified);
    };
  }, []);

  const refresh = useCallback(async (): Promise<Verified> => {
    if (!auth.currentUser) {
      publish(undefined);
      return undefined;
    }
    const verified = await refreshEmailVerified();
    publish(verified);
    return verified;
  }, []);

  /**
   * Follows the session rather than reading it once.
   *
   * Without this the app hung on the splash for every fresh sign-in and sign-up
   * (2026-08-20): the effect ran once at mount with nobody signed in, published
   * undefined, and never ran again — and AppNavigator answers undefined with the
   * splash. Members already signed in at launch were fine, which is why it
   * presented as a sign-up bug.
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, nextUser => {
      if (!nextUser) {
        publish(undefined);
        return;
      }
      // The cached flag first so the gate can resolve immediately, then a reload
      // in case the address was confirmed somewhere else since the token was
      // minted.
      publish(nextUser.emailVerified);
      refreshEmailVerified().then(publish);
    });
    return unsubscribe;
  }, []);

  // The link is tapped in a mail app, so the moment worth re-checking is the app
  // coming back to the foreground. Without this the wall would sit there
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
