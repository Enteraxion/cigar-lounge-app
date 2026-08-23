/**
 * The one-line strip telling a member what their account still needs.
 *
 * Steps 3 of the 21+ flow (Dr. Brinkley, 2026-08-19) plus email confirmation
 * (Rohith, same day). A member can owe several things at once, and exactly one is
 * shown — src/utils/accountPrompt.ts decides which, and explains the ordering.
 * Stacking them on the first screen of the app gets none of them read.
 *
 * Renders nothing when there is nothing to say: verified members, and accounts
 * predating the gate. A banner that is always present stops being one.
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Clock, IdCard, MailCheck, XCircle } from 'lucide-react-native';
import { theme } from '../theme';
import { accountPrompt, type AccountPromptInput } from '../utils/accountPrompt';

export default function VerificationBanner({
  awaitingReview,
  needsId,
  wasRejected,
  emailVerified,
  onPress,
  onResendEmail,
  resendingEmail = false,
  resendCooldownSeconds = 0,
}: AccountPromptInput & {
  /** Opens the ID screen, so a member can act on the age prompts immediately. */
  onPress?: () => void;
  /** Sends another confirmation code. Absent means the email prompt is read-only. */
  onResendEmail?: () => void;
  resendingEmail?: boolean;
  resendCooldownSeconds?: number;
}) {
  const prompt = accountPrompt({ awaitingReview, needsId, wasRejected, emailVerified });
  if (prompt === 'none') {
    return null;
  }

  const rejected = prompt === 'rejected';
  const email = prompt === 'confirm-email';

  // The email prompt's action is resending, not opening a screen — tapping it to
  // land on the ID upload would be answering a question nobody asked.
  const action = email ? onResendEmail : onPress;

  return (
    <Pressable
      style={[styles.banner, rejected && styles.bannerRejected]}
      onPress={action}
      disabled={!action || resendingEmail || (email && resendCooldownSeconds > 0)}
      accessibilityRole={action ? 'button' : undefined}
    >
      {rejected ? (
        <XCircle size={14} color={theme.colors.danger} />
      ) : email ? (
        <MailCheck size={14} color={theme.colors.accentGold} />
      ) : prompt === 'needs-id' ? (
        <IdCard size={14} color={theme.colors.accentGold} />
      ) : (
        <Clock size={14} color={theme.colors.accentGold} />
      )}

      <Text style={[styles.text, rejected && styles.textRejected]}>{message(prompt)}</Text>

      {email && resendingEmail ? <ActivityIndicator size="small" color={theme.colors.accentGold} /> : null}
    </Pressable>
  );

  function message(kind: typeof prompt): string {
    switch (kind) {
      case 'rejected':
        return 'We couldn’t verify your ID — tap to send another photo.';
      case 'needs-id':
        return 'Verify your age to write reviews, reserve tables and claim a business.';
      case 'confirm-email':
        // Currently unreachable, and worth saying so rather than leaving a
        // reader to work it out: email confirmation is a hard wall in
        // AppNavigator, so a member with an unconfirmed address never renders a
        // screen that has this banner on it. Kept accurate in case the wall is
        // ever softened back to a banner — which is what it was before
        // 2026-08-19.
        //
        // Copy says "code", not "link": verification became a 6-digit code on
        // 2026-08-23 and telling someone to look for a link they will never
        // receive is worse than saying nothing.
        return resendCooldownSeconds > 0
          ? `Code sent — check your inbox. Resend in ${resendCooldownSeconds}s.`
          : 'Confirm your email to unlock reviews and reservations — tap to get a code.';
      default:
        return 'Your ID is being reviewed. Reviews and reservations unlock once you’re verified.';
    }
  }
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.gold.wash,
    borderWidth: 1,
    borderColor: theme.gold.line,
  },
  bannerRejected: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.danger,
  },
  text: {
    flex: 1,
    ...theme.typography.medium,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.accentGold,
  },
  textRejected: { color: theme.colors.danger },
});
