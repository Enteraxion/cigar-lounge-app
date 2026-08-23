/**
 * The one place that decides whether a member may write a review, reserve a table
 * or claim a business.
 *
 * Extracted on 2026-08-23 after QA found a way straight past it (BUG-008). The
 * check had been written out by hand inside LoungeDetailScreen and ReviewsScreen,
 * so it only guarded the buttons on those two screens — and there were two more
 * routes to the same action:
 *
 *   HomeScreen        "Reserve a Table" on the featured lounge
 *   TripPlannerScreen "Reserve" on each stop along a route
 *
 * Both navigated straight to ReserveTable, so an unverified member was refused at
 * the lounge screen and waved through from the home screen. The reporter had it
 * exactly right.
 *
 * A copied guard protects the copies. One hook protects the action, so the next
 * screen that offers a gated button gets the check by importing it rather than by
 * somebody remembering.
 *
 * The rules are the real boundary either way — `firestore.rules` refuses a
 * reservation write from an unverified member regardless of which screen asked.
 * What this fixes is the app promising something the database will refuse, and
 * doing it inconsistently.
 */

import { Alert } from 'react-native';
import { useAgeVerification } from './useAgeVerification';
import { useEmailVerification } from './useEmailVerification';
import { verificationGateMessage, type GatedAction } from '../utils/verificationGate';

export type { GatedAction };

export function useVerificationGate(): {
  /** Runs `proceed` only if the member may; otherwise explains what is missing. */
  requireVerified: (action: GatedAction, proceed: () => void) => void;
  /** For a screen that wants to disable a control rather than explain on tap. */
  isAllowed: boolean;
} {
  const ageState = useAgeVerification();
  const emailState = useEmailVerification();

  // Email confirmation applies to everyone, including accounts that predate the
  // 21+ gate — it is about the address being real, not about age, so the
  // grandfathering below deliberately does not cover it.
  //
  // A missing age record (verification === null) passes: every account created
  // before the 21+ feature has none, and refusing those would lock existing
  // members out of an app they already use.
  const isAllowed =
    emailState.emailVerified !== false &&
    (ageState.isVerified || ageState.verification === null);

  const requireVerified = (action: GatedAction, proceed: () => void) => {
    if (isAllowed) {
      proceed();
      return;
    }
    const { title, body, offerResend } = verificationGateMessage(action, {
      ...ageState,
      emailVerified: emailState.emailVerified,
    });
    // A dead OK on a message asking for an email link leaves the member to go
    // hunting for the resend themselves.
    Alert.alert(
      title,
      body,
      offerResend
        ? [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Send link',
              onPress: () => {
                emailState.resend().then(sent => {
                  Alert.alert(
                    sent ? 'Link sent' : "Couldn't send that",
                    sent
                      ? 'Check your inbox — and your spam folder, just in case.'
                      : 'Wait a minute and try again, or resend from the banner on Home.',
                  );
                });
              },
            },
          ]
        : undefined,
    );
  };

  return { requireVerified, isAllowed };
}
