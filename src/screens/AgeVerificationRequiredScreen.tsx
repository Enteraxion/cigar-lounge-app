/**
 * AgeVerificationRequiredScreen
 *
 * Step 2 of the 21+ flow agreed with Dr. Brinkley (2026-08-19): the ID upload is
 * a required step immediately after sign-up. This replaces Main in the root
 * navigator rather than living inside it, so there is no tab bar to escape
 * through and nothing to skip.
 *
 * The capture itself lives in IdDocumentCapture, shared with the voluntary route
 * from Profile. What this screen adds is everything a *wall* needs and the
 * voluntary version does not: no back button, an explanation of why the member is
 * being stopped here, and a sign-out so nobody is actually trapped.
 *
 * The date of birth has already been accepted at sign-up — an under-21 date is
 * refused before an account exists — so this screen never has to judge age. It
 * only collects the evidence.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock, ShieldCheck } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import { auth, signOut } from '../services/firebaseAuth';
import {
  deferAgeVerification,
  type AutomatedReviewOutcome,
} from '../services/ageVerificationService';
import IdDocumentCapture from '../components/IdDocumentCapture';
import { MINIMUM_AGE } from '../utils/ageCheck';
import { keyboardAwareScrollProps } from '../utils/keyboardAware';

export default function AgeVerificationRequiredScreen({
  onSubmitted,
}: {
  /** Re-reads the verification record, which drops this wall once the ID is complete. */
  onSubmitted: () => void;
}) {
  /**
   * The wall drops either way — a submitted ID is enough to get in, verified or
   * not — so this only decides what the member is told on the way through.
   * Worth telling them: since 2026-08-31 most people are fully verified before
   * they reach the first screen, and "we'll get back to you" would undersell
   * that and confuse the ones who then find booking already unlocked.
   */
  const handleSubmitted = (outcome: AutomatedReviewOutcome | null) => {
    if (outcome?.decision === 'approve') {
      Alert.alert('You’re verified', 'Your age is confirmed — everything is unlocked.');
    } else if (outcome?.decision === 'reject' && outcome.memberMessage) {
      // Not a dead end: they are inside the app, and the Profile route lets them
      // correct it. Saying so matters, or a rejection at the door reads as a
      // door that never opens.
      Alert.alert(
        'We couldn’t verify this',
        `${outcome.memberMessage}\n\nYou can browse in the meantime — finish this from Profile whenever you're ready.`,
      );
    }
    onSubmitted();
  };
  const [skipping, setSkipping] = useState(false);

  // Rohith, 2026-08-19: asking somebody to photograph their licence for an app
  // they have not seen yet loses the members who would have liked it most. This
  // records the deferral (see deferAgeVerification) rather than granting
  // anything — status stays `pending`, so reviews, reservations and claims are
  // still refused until a real ID is checked.
  const skip = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId || skipping) {
      return;
    }
    setSkipping(true);
    try {
      await deferAgeVerification(userId);
      onSubmitted();
    } catch {
      // Must not silently do nothing: without the stored deferral the wall
      // stays, and a member who tapped Skip and saw no change would reasonably
      // tap it again.
      Alert.alert("Couldn't skip that", 'Check your connection and try again.');
      setSkipping(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView {...keyboardAwareScrollProps} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.badge}>
            <ShieldCheck size={26} color={theme.colors.accentGold} />
          </View>
          <Text style={styles.title}>Verify your age</Text>
          <Text style={styles.body}>
            Lounge Locator is for members {MINIMUM_AGE} and over. One document and you're in —
            most are checked in a few seconds.
          </Text>
        </View>

        <IdDocumentCapture onSubmitted={handleSubmitted} />

        {/* Kept, but cut to one line. A request for a photograph of a passport
            is one people are right to hesitate over, and this is the sentence
            that makes it reasonable — it is also what an App Store reviewer
            looks for on the screen that collects an identity document.
            Rohith called the previous wording weird on 2026-09-13 and he was
            right: three clauses explaining automated review, human fallback and
            non-disclosure, at the moment someone just wants to know whether
            strangers will see their licence. Only the two promises that answer
            that question survive. */}
        <View style={styles.privacy}>
          <Lock size={14} color={theme.colors.mutedGray} />
          <Text style={styles.privacyText}>
            Used only to confirm your age. Never shown to other members or to lounges.
          </Text>
        </View>

        {/* Deliberately secondary to Submit, and worded as an order of events
            rather than a way out — "Explore first" says the ID is still coming,
            where "Skip" would suggest it is optional. */}
        <Pressable
          style={styles.skipButton}
          onPress={skip}
          disabled={skipping}
          accessibilityRole="button"
          accessibilityLabel="Explore the app first and verify later"
        >
          {skipping ? (
            <ActivityIndicator color={theme.colors.accentGold} />
          ) : (
            <>
              <Text style={styles.skipText}>Explore the app first</Text>
              <Text style={styles.skipNote}>
                You can verify any time from your profile. Reviews, reservations and business
                claims stay locked until you do.
              </Text>
            </>
          )}
        </Pressable>

        {/* A wall with no exit is hostile. Signing out is not a way past the
            check — the requirement is still there next time they sign in — but
            it means nobody is stuck in the app with no route out. */}
        <Pressable style={styles.signOutButton} onPress={() => signOut(auth).catch(() => {})}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  hero: { alignItems: 'center', gap: theme.spacing.sm },
  badge: {
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
  privacy: { flexDirection: 'row', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.xs },
  privacyText: {
    flex: 1,
    ...theme.typography.body,
    fontSize: 11,
    lineHeight: 17,
    color: theme.colors.mutedGray,
  },
  skipButton: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: theme.gold.line,
  },
  skipText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.accentGold,
  },
  skipNote: {
    ...theme.typography.body,
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.mutedGray,
    textAlign: 'center',
  },
  signOutButton: { alignItems: 'center', paddingVertical: theme.spacing.sm },
  signOutText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.mutedGray,
    textDecorationLine: 'underline',
  },
});
