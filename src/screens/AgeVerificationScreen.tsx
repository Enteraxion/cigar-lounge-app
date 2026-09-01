/**
 * AgeVerificationScreen
 *
 * Where a member supplies or replaces the ID that backs the 21+ gate, reached
 * voluntarily from Profile. Requested by Dr. Brinkley in the 2026-08-17 demo —
 * the date of birth is already checked at sign-up (src/utils/ageCheck.ts), and
 * this is the evidence a human reviews.
 *
 * The Profile card that leads here only appears while there is something to do,
 * so a member who is already verified has no reason to arrive.
 *
 * Status comes first and the capture second, because someone opening this screen
 * wants to know where they stand before being asked to do anything. The capture
 * itself is IdDocumentCapture, shared with the post-sign-up wall — a verified
 * member is shown what we hold rather than a form, since re-sending an accepted
 * ID would put them back in the review queue for nothing.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CheckCircle2, ChevronLeft, Clock, Lock, XCircle } from 'lucide-react-native';
import { theme } from '../theme';
import { auth } from '../services/firebaseAuth';
import {
  getAgeVerification,
  updateDeclaredDateOfBirth,
  type AutomatedReviewOutcome,
} from '../services/ageVerificationService';
import DateOfBirthFields, { type DateOfBirthParts } from '../components/DateOfBirthFields';
import IdDocumentCapture from '../components/IdDocumentCapture';
import type { AgeVerification } from '../types/firestore';
import { MINIMUM_AGE, ageCheckMessage, checkMinimumAge, fromIsoDate } from '../utils/ageCheck';
import { documentLabel, imageForSide, requiredSides, sideLabel } from '../utils/idDocument';
import type { ProfileStackParamList } from '../navigation/ProfileNavigator';
import { TAB_BAR_SCROLL_CLEARANCE } from '../utils/tabBarLayout';
import { keyboardAwareScrollProps } from '../utils/keyboardAware';

type Nav = NativeStackNavigationProp<ProfileStackParamList>;

/** Pre-fills the correction field with what is on file, so one wrong digit is a
 *  one-digit edit rather than a re-type. */
function initialDob(verification: AgeVerification | null | undefined): DateOfBirthParts {
  const parsed = verification?.dateOfBirth ? fromIsoDate(verification.dateOfBirth) : null;
  if (!parsed) {
    return { month: '', day: '', year: '' };
  }
  return {
    month: String(parsed.month).padStart(2, '0'),
    day: String(parsed.day).padStart(2, '0'),
    year: String(parsed.year),
  };
}

/** What the member is told, per status. */
const STATUS_COPY = {
  pending: {
    title: 'Awaiting review',
    body: 'Your ID is with our team. This is usually quick — we’ll notify you here as soon as it’s checked.',
  },
  verified: {
    title: 'Verified',
    body: 'Your age has been confirmed. Nothing else is needed.',
  },
  rejected: {
    title: 'We couldn’t verify this',
    body: 'The ID we received couldn’t be confirmed. Send a clearer set of photos below.',
  },
} as const;

export default function AgeVerificationScreen() {
  const navigation = useNavigation<Nav>();
  const userId = auth.currentUser?.uid;

  const [verification, setVerification] = useState<AgeVerification | null | undefined>(undefined);

  // Only used on the one path that asks for it — a rejection whose remedy is the
  // date rather than the photograph. `null` until the member opens the field, so
  // an untouched screen never shows a half-filled form.
  const [dob, setDob] = useState<DateOfBirthParts | null>(null);
  const [savingDob, setSavingDob] = useState(false);

  const load = useCallback(() => {
    if (!userId) {
      setVerification(null);
      return;
    }
    getAgeVerification(userId)
      .then(setVerification)
      .catch(() => setVerification(null));
  }, [userId]);

  // Refetched on focus so a decision made while the app is open is reflected
  // without a restart — the same reason My Shops does it.
  useFocusEffect(load);

  /**
   * Tells the member what actually happened.
   *
   * This used to say "our team will review it" unconditionally, which stopped
   * being true on 2026-08-31 — most submissions are now decided in about four
   * seconds and never reach a person. Saying a human has it when one does not is
   * the same silence that made a broken deployment look like a queue.
   */
  const onSubmitted = (outcome: AutomatedReviewOutcome | null) => {
    load();
    if (outcome?.decision === 'approve') {
      Alert.alert(
        'You’re verified',
        `Your age is confirmed — you can book tables and claim a lounge now.`,
      );
      return;
    }
    if (outcome?.decision === 'reject' && outcome.memberMessage) {
      Alert.alert('We couldn’t verify this', outcome.memberMessage);
      return;
    }
    // Referred, or the review could not be reached. Both genuinely mean a person
    // will look, so this is the one case where the old wording is still honest.
    Alert.alert(
      'ID received',
      'Thanks — our team will review it and you’ll get a notification here.',
    );
  };

  /**
   * Saves a corrected date of birth and immediately re-runs the review against
   * the photographs already on file — the member does not retake anything,
   * because nothing about their document was wrong.
   */
  const saveDob = async () => {
    if (!userId || !dob) {
      return;
    }
    const parts = {
      year: dob.year.trim() ? Number(dob.year.trim()) : undefined,
      month: dob.month.trim() ? Number(dob.month.trim()) : undefined,
      day: dob.day.trim() ? Number(dob.day.trim()) : undefined,
    };
    // The same check sign-up applies. A corrected date is still a date of birth
    // on a 21+ product, and an impossible one must not reach the comparison.
    const problem = ageCheckMessage(checkMinimumAge(parts));
    if (problem) {
      Alert.alert('Check that date', problem);
      return;
    }
    setSavingDob(true);
    try {
      const outcome = await updateDeclaredDateOfBirth(userId, {
        year: parts.year as number,
        month: parts.month as number,
        day: parts.day as number,
      });
      setDob(null);
      load();
      if (outcome?.decision === 'approve') {
        Alert.alert(
          'You’re verified',
          'That matched your document — you can book tables and claim a lounge now.',
        );
      } else if (outcome?.decision === 'reject' && outcome.memberMessage) {
        Alert.alert('Still doesn’t match', outcome.memberMessage);
      } else {
        Alert.alert('Date updated', 'We’ve sent your ID for another look.');
      }
    } catch {
      Alert.alert('Couldn’t save that', 'Check your connection and try again.');
    } finally {
      setSavingDob(false);
    }
  };

  const status = verification?.status;
  const copy = status ? STATUS_COPY[status] : null;
  // Absent on human decisions and on anything decided before 2026-08-31, so an
  // unknown resolution falls back to the camera rather than to nothing.
  const needsDateFix = status === 'rejected' && verification?.resolution === 'fix_date_of_birth';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
        >
          <ChevronLeft size={24} color={theme.colors.white} />
        </Pressable>
        <Text style={styles.title}>Age Verification</Text>
      </View>

      {verification === undefined ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.colors.secondarySilver} />
        </View>
      ) : (
        <ScrollView {...keyboardAwareScrollProps} contentContainerStyle={styles.content}>
          {copy ? (
            <View style={styles.statusCard}>
              <View style={styles.statusIcon}>
                {status === 'verified' ? (
                  <CheckCircle2 size={20} color={theme.colors.accentGold} />
                ) : status === 'rejected' ? (
                  <XCircle size={20} color={theme.colors.danger} />
                ) : (
                  <Clock size={20} color={theme.colors.accentGold} />
                )}
              </View>
              <View style={styles.statusText}>
                <Text style={styles.statusTitle}>{copy.title}</Text>
                <Text style={styles.statusBody}>
                  {status === 'rejected' && verification?.rejectionReason
                    ? verification.rejectionReason
                    : copy.body}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date of birth on file</Text>
            <Text style={styles.detailValue}>{verification?.dateOfBirth ?? '—'}</Text>
          </View>
          {verification?.documentType ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Document sent</Text>
              <Text style={styles.detailValue}>{documentLabel(verification.documentType)}</Text>
            </View>
          ) : null}

          {/* A verified member is shown what we hold, not a form. Re-submitting an
              accepted ID would reset them to `pending` and cost them the access
              they already have, so the capture UI is deliberately absent here. */}
          {status === 'verified' ? (
            <>
              <View style={styles.thumbRow}>
                {requiredSides(verification?.documentType).map(side => {
                  const uri = imageForSide(verification, side);
                  if (!uri) {
                    return null;
                  }
                  return (
                    <View key={side} style={styles.thumbWrap}>
                      <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                      <Text style={styles.thumbLabel}>
                        {sideLabel(verification?.documentType, side)}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.privacy}>
                <Lock size={14} color={theme.colors.mutedGray} />
                <Text style={styles.privacyText}>
                  Held only to confirm you are {MINIMUM_AGE} or over. Never shown to other members
                  or to lounges.
                </Text>
              </View>
            </>
          ) : (
            <>
              {/* A record from before the document picker: there is an image on
                  file but nothing saying what it shows, so it cannot be folded
                  into the tiles below the way a matching document's sides are.
                  Shown anyway — a member looking at "awaiting review" alongside an
                  empty form would reasonably conclude we lost their ID. */}
              {!verification?.documentType && verification?.idImageUrl ? (
                <View style={styles.onFileBlock}>
                  <Text style={styles.detailLabel}>Currently on file</Text>
                  <Image
                    source={{ uri: verification.idImageUrl }}
                    style={styles.onFileImage}
                    resizeMode="cover"
                  />
                  <Text style={styles.onFileNote}>
                    Sent before we asked which document it was. Choose it below to send a fresh
                    set — or leave it and our team will review this one.
                  </Text>
                </View>
              ) : null}
              {needsDateFix ? (
                <View style={styles.fixBlock}>
                  <Text style={styles.fixTitle}>Correct your date of birth</Text>
                  <Text style={styles.fixBody}>
                    Enter the date exactly as it appears on your document. We’ll check your ID
                    again straight away — you don’t need to photograph it a second time.
                  </Text>
                  <DateOfBirthFields
                    value={dob ?? initialDob(verification)}
                    onChange={setDob}
                    editable={!savingDob}
                  />
                  <Pressable
                    style={[styles.fixButton, savingDob && styles.fixButtonDisabled]}
                    onPress={saveDob}
                    disabled={savingDob}
                    accessibilityRole="button"
                  >
                    {savingDob ? (
                      <ActivityIndicator color={theme.colors.background} />
                    ) : (
                      <Text style={styles.fixButtonText}>Save and check again</Text>
                    )}
                  </Pressable>
                  <Text style={styles.fixOr}>
                    Or send a different document below if you photographed the wrong one.
                  </Text>
                </View>
              ) : null}
              <IdDocumentCapture onSubmitted={onSubmitted} existing={verification} />
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  title: { ...theme.typography.headingMedium, fontSize: 18, color: theme.colors.white },
  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: TAB_BAR_SCROLL_CLEARANCE,
    gap: theme.spacing.lg,
  },
  statusCard: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.gold.line,
  },
  fixBlock: {
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.gold.line,
  },
  fixTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.white,
  },
  fixBody: { ...theme.typography.body, fontSize: 13, lineHeight: 19, color: theme.colors.mutedGray },
  fixButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.accentGold,
  },
  fixButtonDisabled: { opacity: 0.5 },
  fixButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.background,
  },
  fixOr: { ...theme.typography.body, fontSize: 12, color: theme.colors.mutedGray },
  statusIcon: { paddingTop: 2 },
  statusText: { flex: 1, gap: 4 },
  statusTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.white,
  },
  statusBody: {
    ...theme.typography.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.secondarySilver,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailLabel: { ...theme.typography.caption, fontSize: 10, color: theme.colors.accentGold },
  detailValue: { ...theme.typography.medium, fontSize: 14, color: theme.colors.white },
  thumbRow: { flexDirection: 'row', gap: theme.spacing.sm },
  thumbWrap: { flex: 1, gap: 4 },
  thumb: {
    width: '100%',
    aspectRatio: 85.6 / 54,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: theme.gold.line,
    backgroundColor: theme.colors.surface,
  },
  thumbLabel: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.mutedGray,
    textAlign: 'center',
  },
  onFileBlock: { gap: theme.spacing.sm },
  onFileImage: {
    width: '100%',
    height: 150,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: theme.gold.line,
    backgroundColor: theme.colors.surface,
  },
  onFileNote: {
    ...theme.typography.body,
    fontSize: 11,
    lineHeight: 17,
    color: theme.colors.mutedGray,
  },
  privacy: { flexDirection: 'row', gap: theme.spacing.sm },
  privacyText: {
    flex: 1,
    ...theme.typography.body,
    fontSize: 11,
    lineHeight: 17,
    color: theme.colors.mutedGray,
  },
});
