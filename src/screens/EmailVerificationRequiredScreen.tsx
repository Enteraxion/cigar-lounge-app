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
 */

import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MailCheck, RefreshCw } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import { auth, signOut } from '../services/firebaseAuth';
import { useEmailVerification } from '../hooks/useEmailVerification';

export default function EmailVerificationRequiredScreen() {
  const { cooldownSeconds, sending, resend, refresh } = useEmailVerification();
  const [checking, setChecking] = useState(false);
  const email = auth.currentUser?.email;

  const check = async () => {
    setChecking(true);
    try {
      // refresh() updates the hook's state, which re-evaluates the gate in
      // AppNavigator and drops this screen if the link has been tapped.
      refresh();
      // Deliberately not instant: a "nothing changed" alert fired before the
      // reload has come back would tell the member they had failed when the
      // request was still in flight.
      await new Promise(resolve => setTimeout(resolve, 1200));
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        Alert.alert(
          'Not confirmed yet',
          'We still see this address as unconfirmed. Tap the link in the email, then try again — and check your spam folder.',
        );
      }
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
          We've sent a link to{' '}
          <Text style={styles.email}>{email ?? 'your email address'}</Text>. Tap it and you're in.
        </Text>

        <View style={styles.hint}>
          <Text style={styles.hintText}>
            Not there? Check your spam or junk folder — the email comes from a noreply address, so
            it often lands there.
          </Text>
        </View>

        <Pressable
          style={[styles.primaryButton, checking && styles.buttonDisabled]}
          onPress={check}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator color={theme.colors.primaryBlack} />
          ) : (
            <>
              <RefreshCw size={16} color={theme.colors.primaryBlack} />
              <Text style={styles.primaryButtonText}>I've confirmed — continue</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={[styles.secondaryButton, (sending || cooldownSeconds > 0) && styles.buttonDisabled]}
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
