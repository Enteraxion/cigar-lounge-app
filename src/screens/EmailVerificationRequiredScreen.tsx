/**
 * EmailVerificationRequiredScreen
 *
 * The wall that holds a member out of the app until they have tapped the link we
 * emailed them. Rohith, 2026-08-19: "users shouldn't be able to log in to the app
 * without clicking the link first."
 *
 * This replaces Main in the root navigator, and sits *ahead* of the 21+ ID wall —
 * it is the cheaper of the two to clear and there is no point asking someone to
 * photograph a licence for an account whose address might not be real.
 *
 * Two things this screen has to do that a banner did not:
 *
 * **Offer to send the link, not assume one arrived.** Somebody can reach here
 * without ever having been sent one — an account created before this shipped, or
 * a send that failed at sign-up. So resending is a first-class button rather than
 * a footnote.
 *
 * **Give them a way to say they have done it.** `emailVerified` lives in the
 * cached ID token and does not change when the link is tapped in a mail app. The
 * hook re-reads on foreground, which covers the common path, but a member who
 * confirmed on a laptop never backgrounds the app — so there is an explicit
 * check-again button. Without it that member is stuck staring at a wall they have
 * already cleared.
 *
 * ---------------------------------------------------------------------------
 * 2026-08-23 — a 6-digit code, entered here, is now the primary path.
 *
 * Rohith asked for this after a friend's Clerk-based app delivered its codes to
 * the inbox while our link kept landing in spam. The reason is not that Clerk is
 * better at email: Firebase's verification email is essentially nothing but a
 * link to `<project>.firebaseapp.com`, a shared domain that thousands of
 * projects — phishing sites included — send links to. An email whose entire
 * payload is that click-through is a strong spam signal by itself. A code has no
 * link in it, which removes the signal.
 *
 * It is also simply less to ask. Typing six digits beats leaving the app,
 * finding an email, tapping a link and coming back — and this is a HARD wall, so
 * every step in that chain is a step where a real member gives up.
 *
 * The link still works and the button for it is still here, because accounts
 * created before today were sent one and there is no reason to break them.
 *
 * Nothing else in the app changed. confirmEmailVerificationCode sets Firebase's
 * own `emailVerified` flag, the same one the link sets, so the gate below, the
 * security rules and both web portals never learn that any of this happened.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MailCheck, RefreshCw } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import { auth, signOut } from '../services/firebaseAuth';
import { useEmailVerification } from '../hooks/useEmailVerification';
import { requestEmailCode, submitEmailCode } from '../services/emailCodeService';

export default function EmailVerificationRequiredScreen() {
  const { cooldownSeconds, sending, resend, refresh } = useEmailVerification();
  const [checking, setChecking] = useState(false);
  const email = auth.currentUser?.email;

  const [code, setCode] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  // Whether the link is on offer at all. Hidden by default now: showing both
  // routes at once asks the member to choose between two things they do not
  // care about, and the code is the one we want them to use.
  const [showLink, setShowLink] = useState(false);

  const sendCode = async () => {
    setCodeBusy(true);
    setCodeError(null);
    try {
      const result = await requestEmailCode();
      if (!result.ok) {
        // The function's own message says how long to wait or how many sends
        // are left, which is more use than a generic failure.
        setCodeError(result.message);
        return;
      }
      if (result.alreadyVerified) {
        // Server says this address is already confirmed and our token has not
        // caught up. Refreshing drops the wall rather than leaving the member
        // waiting for a code that will never come.
        await refresh();
        return;
      }
      setCodeSent(true);
    } finally {
      setCodeBusy(false);
    }
  };

  const confirmCode = async () => {
    const entered = code.trim();
    if (entered.length !== 6) {
      setCodeError('Enter all six digits.');
      return;
    }
    setCodeBusy(true);
    setCodeError(null);
    try {
      const result = await submitEmailCode(entered);
      if (!result.ok) {
        setCodeError(result.message);
        setCode('');
        return;
      }
      // The server has set emailVerified; refresh() is what publishes it to
      // AppNavigator's copy of the hook and drops this screen. Without it the
      // member sits behind a wall they have just cleared — the same bug the
      // "I've confirmed" button had on 2026-08-21.
      await refresh();
    } finally {
      setCodeBusy(false);
    }
  };

  const check = async () => {
    setChecking(true);
    try {
      // refresh() publishes to the shared cache every instance of the hook reads,
      // including AppNavigator's — which is what re-evaluates the gate and drops
      // this screen. It used to update only this screen's own copy, so a member
      // who had genuinely confirmed tapped this and stayed exactly here.
      //
      // Awaited rather than timed: the previous version slept 1200ms and then
      // re-read the user, which reported failure whenever the network was slower
      // than the guess.
      const verified = await refresh();
      if (verified === false) {
        Alert.alert(
          'Not confirmed yet',
          'We still see this address as unconfirmed. Tap the link in the email, then try again — and check your spam folder.',
        );
      }
      // `true` needs no message: the gate drops this screen and the member is in,
      // which says it better than an alert would.
    } finally {
      setChecking(false);
    }
  };

  const sendAgain = async () => {
    const sent = await resend();
    Alert.alert(
      sent ? 'Link sent' : "Couldn't send that",
      sent
        ? `Check the inbox for ${email ?? 'your address'} — and your spam folder, just in case.`
        : 'Too many attempts just now. Wait a minute and try again.',
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.badge}>
          <MailCheck size={26} color={theme.colors.accentGold} />
        </View>

        <Text style={styles.title}>Confirm your email</Text>
        <Text style={styles.body}>
          {codeSent
            ? "Enter the 6-digit code we've just sent to "
            : "We'll send a 6-digit code to "}
          <Text style={styles.email}>{email ?? 'your email address'}</Text>
          {codeSent ? '.' : ' so you can confirm it here.'}
        </Text>

        {codeSent ? (
          <>
            <TextInput
              style={[styles.codeInput, !!codeError && styles.codeInputError]}
              value={code}
              onChangeText={text => {
                // Digits only, six of them. Members paste the code out of a mail
                // app and bring spaces with it.
                setCode(text.replace(/\D/g, '').slice(0, 6));
                setCodeError(null);
              }}
              keyboardType="number-pad"
              // iOS reads the code out of the SMS/email notification and offers
              // it above the keyboard, so it can be filled without switching apps.
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              placeholder="000000"
              placeholderTextColor={theme.colors.mutedGray}
              accessibilityLabel="Six digit verification code"
            />

            {codeError ? <Text style={styles.errorText}>{codeError}</Text> : null}

            <Pressable
              style={[
                styles.primaryButton,
                (codeBusy || code.length !== 6) && styles.buttonDisabled,
              ]}
              onPress={confirmCode}
              disabled={codeBusy || code.length !== 6}
            >
              {codeBusy ? (
                <ActivityIndicator color={theme.colors.primaryBlack} />
              ) : (
                <Text style={styles.primaryButtonText}>Confirm</Text>
              )}
            </Pressable>

            <Pressable
              style={[styles.secondaryButton, codeBusy && styles.buttonDisabled]}
              onPress={sendCode}
              disabled={codeBusy}
            >
              <Text style={styles.secondaryButtonText}>Send a new code</Text>
            </Pressable>
          </>
        ) : (
          <>
            {codeError ? <Text style={styles.errorText}>{codeError}</Text> : null}
            <Pressable
              style={[styles.primaryButton, codeBusy && styles.buttonDisabled]}
              onPress={sendCode}
              disabled={codeBusy}
            >
              {codeBusy ? (
                <ActivityIndicator color={theme.colors.primaryBlack} />
              ) : (
                <Text style={styles.primaryButtonText}>Email me a code</Text>
              )}
            </Pressable>
          </>
        )}

        {/* The link route, kept but demoted. Accounts created before 2026-08-23
            were sent a link and some members will have it open in front of them;
            breaking that to make a point about codes would be gratuitous. */}
        {showLink ? (
          <>
            <Pressable
              style={[styles.secondaryButton, checking && styles.buttonDisabled]}
              onPress={check}
              disabled={checking}
            >
              {checking ? (
                <ActivityIndicator color={theme.colors.accentGold} />
              ) : (
                <>
                  <RefreshCw size={15} color={theme.colors.accentGold} />
                  <Text style={styles.secondaryButtonText}>I've tapped the link — continue</Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={[
                styles.secondaryButton,
                (sending || cooldownSeconds > 0) && styles.buttonDisabled,
              ]}
              onPress={sendAgain}
              disabled={sending || cooldownSeconds > 0}
            >
              {sending ? (
                <ActivityIndicator color={theme.colors.accentGold} />
              ) : (
                <Text style={styles.secondaryButtonText}>
                  {cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Send the link again'}
                </Text>
              )}
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.linkToggle} onPress={() => setShowLink(true)} hitSlop={8}>
            <Text style={styles.linkToggleText}>Use an email link instead</Text>
          </Pressable>
        )}

        {/* A wall with no exit is hostile. Signing out is not a way past the
            check — the requirement is still there next time — but it means nobody
            is stuck in the app with no route out, and it lets someone who typed
            their address wrong start again. */}
        <Pressable style={styles.signOutButton} onPress={() => signOut(auth).catch(() => {})}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  codeInput: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    // Wide letter spacing so six digits read as six digits rather than a number.
    fontSize: 28,
    letterSpacing: 10,
    textAlign: 'center',
    color: theme.colors.white,
    height: 62,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.35),
    marginBottom: theme.spacing.sm,
  },
  codeInputError: {
    borderColor: theme.colors.danger,
  },
  errorText: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.danger,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  linkToggle: {
    alignSelf: 'center',
    paddingVertical: theme.spacing.sm,
  },
  linkToggleText: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
    textDecorationLine: 'underline',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  badge: {
    alignSelf: 'center',
    width: 58,
    height: 58,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(theme.colors.surface, 0.6),
    borderWidth: 1,
    borderColor: theme.gold.line,
  },
  title: {
    ...theme.typography.headingMedium,
    fontSize: 24,
    color: theme.colors.white,
    textAlign: 'center',
  },
  body: {
    ...theme.typography.body,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.secondarySilver,
    textAlign: 'center',
  },
  email: { fontFamily: theme.fontFamily.semibold, color: theme.colors.white },
  hint: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.gold.wash,
    borderWidth: 1,
    borderColor: theme.gold.line,
  },
  hintText: {
    ...theme.typography.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.secondarySilver,
    textAlign: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.accentGold,
  },
  primaryButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.primaryBlack,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: theme.gold.line,
  },
  secondaryButtonText: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.accentGold,
  },
  buttonDisabled: { opacity: 0.5 },
  signOutButton: { alignItems: 'center', paddingVertical: theme.spacing.sm },
  signOutText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.mutedGray,
    textDecorationLine: 'underline',
  },
});
