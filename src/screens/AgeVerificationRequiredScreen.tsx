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

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock, ShieldCheck } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import { auth, signOut } from '../services/firebaseAuth';
import IdDocumentCapture from '../components/IdDocumentCapture';
import { MINIMUM_AGE } from '../utils/ageCheck';
import { keyboardAwareScrollProps } from '../utils/keyboardAware';

export default function AgeVerificationRequiredScreen({
  onSubmitted,
}: {
  /** Re-reads the verification record, which drops this wall once the ID is complete. */
  onSubmitted: () => void;
}) {
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
  signOutButton: { alignItems: 'center', paddingVertical: theme.spacing.sm },
  signOutText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.mutedGray,
    textDecorationLine: 'underline',
  },
});
