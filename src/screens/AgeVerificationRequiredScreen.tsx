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
import { deferAgeVerification } from '../services/ageVerificationService';
import IdDocumentCapture from '../components/IdDocumentCapture';
import { MINIMUM_AGE } from '../utils/ageCheck';
import { keyboardAwareScrollProps } from '../utils/keyboardAware';

export default function AgeVerificationRequiredScreen({
  onSubmitted,
}: {
  /** Re-reads the verification record, which drops this wall once the ID is complete. */
  onSubmitted: () => void;
}) {
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
            you can browse straight away while our team checks it.
          </Text>
        </View>

        <IdDocumentCapture onSubmitted={onSubmitted} />

        {/* Said plainly, because a request for a photograph of a passport is one
            people are right to hesitate over. Vagueness here makes the ask
            larger, not smaller. */}
        <View style={styles.privacy}>
          <Lock size={14} color={theme.colors.mutedGray} />
          <Text style={styles.privacyText}>
            Reviewed by a person on our team, used only to confirm your date of birth, and never
            shown to other members or to lounges.
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
