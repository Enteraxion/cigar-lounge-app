/**
 * AdminAgeReviewScreen
 *
 * Where a human actually checks the IDs behind the 21+ gate — the review half
 * of what Dr. Brinkley asked for on 2026-08-17 ("evaluate the driver's licence
 * or whatever to determine the age").
 *
 * Separate from AdminClaimReviewScreen rather than another section inside it.
 * Business claims and age checks are different jobs done at different times,
 * and one screen holding both would mean an admin looking for one wades past
 * the other. Both are reached from the same admin area on Profile.
 *
 * Deliberately shows the declared date of birth *and* the computed age next to
 * the ID, because the job is comparing three things: what they typed, what that
 * makes them, and what the document says. Making the reviewer do the arithmetic
 * is how mistakes get made.
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
import { ChevronLeft, ShieldCheck } from 'lucide-react-native';
import { theme } from '../theme';
import { auth } from '../services/firebaseAuth';
import {
  approveAgeVerification,
  getPendingAgeVerifications,
  rejectAgeVerification,
  type AgeVerificationRecord,
} from '../services/ageVerificationService';
import { ageOn, fromIsoDate, MINIMUM_AGE } from '../utils/ageCheck';
import type { ProfileStackParamList } from '../navigation/ProfileNavigator';
import { TAB_BAR_SCROLL_CLEARANCE } from '../utils/tabBarLayout';

type Nav = NativeStackNavigationProp<ProfileStackParamList>;

export default function AdminAgeReviewScreen() {
  const navigation = useNavigation<Nav>();
  const adminUserId = auth.currentUser?.uid;

  const [records, setRecords] = useState<AgeVerificationRecord[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError(false);
    getPendingAgeVerifications()
      .then(setRecords)
      .catch(() => setLoadError(true));
  }, []);

  useFocusEffect(load);

  const decide = (record: AgeVerificationRecord, approve: boolean) => {
    if (!adminUserId) {
      return;
    }
    const run = async () => {
      setActioningId(record.userId);
      try {
        if (approve) {
          await approveAgeVerification(record.userId, adminUserId);
        } else {
          await rejectAgeVerification(record.userId, adminUserId);
        }
        setRecords(current => (current ?? []).filter(r => r.userId !== record.userId));
      } catch (error) {
        Alert.alert(
          approve ? "Couldn't verify" : "Couldn't reject",
          error instanceof Error ? error.message : 'Check your connection and try again.',
        );
      } finally {
        setActioningId(null);
      }
    };

    if (approve) {
      run();
      return;
    }
    Alert.alert(
      'Reject this ID?',
      `${record.userName ?? 'This member'} will be told it couldn't be verified and can upload another.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: run },
      ],
    );
  };

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
        <Text style={styles.title}>Review Age Verification</Text>
      </View>

      {loadError ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>Couldn't load pending verifications.</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : records === null ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.colors.secondarySilver} />
        </View>
      ) : records.length === 0 ? (
        <View style={styles.stateBox}>
          <ShieldCheck size={32} color={theme.colors.mutedGray} />
          <Text style={styles.stateText}>No IDs waiting for review.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {records.map(record => {
            const born = fromIsoDate(record.dateOfBirth);
            const age = born ? ageOn(born) : null;
            // Flagged rather than hidden: the sign-up gate should make this
            // impossible, so if it ever appears something upstream is wrong and
            // the reviewer needs to see it rather than be protected from it.
            const underage = age !== null && age < MINIMUM_AGE;

            return (
              <View key={record.userId} style={styles.card}>
                <Text style={styles.memberName}>{record.userName ?? 'Member'}</Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Declared date of birth</Text>
                  <Text style={styles.detailValue}>{record.dateOfBirth}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>That makes them</Text>
                  <Text style={[styles.detailValue, underage && styles.detailValueFlagged]}>
                    {age === null ? 'unreadable date' : `${age}`}
                    {underage ? '  ⚠ under 21' : ''}
                  </Text>
                </View>

                {record.idImageUrl ? (
                  <Image
                    source={{ uri: record.idImageUrl }}
                    style={styles.idImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={styles.noImage}>
                    No ID uploaded yet — nothing to check against the date above.
                  </Text>
                )}

                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.rejectButton, actioningId === record.userId && styles.disabled]}
                    onPress={() => decide(record, false)}
                    disabled={actioningId === record.userId}
                  >
                    <Text style={styles.rejectButtonText}>Reject</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.approveButton,
                      (actioningId === record.userId || !record.idImageUrl) && styles.disabled,
                    ]}
                    // Approving with no ID would be recording a check that
                    // never happened, which is the one thing this screen exists
                    // to prevent.
                    onPress={() => decide(record, true)}
                    disabled={actioningId === record.userId || !record.idImageUrl}
                  >
                    {actioningId === record.userId ? (
                      <ActivityIndicator color={theme.colors.primaryBlack} />
                    ) : (
                      <Text style={styles.approveButtonText}>Verify</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })}
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
  stateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  stateText: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.mutedGray,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
  },
  retryText: { ...theme.typography.medium, fontSize: 14, color: theme.colors.accentGold },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: TAB_BAR_SCROLL_CLEARANCE,
    gap: theme.spacing.lg,
  },
  card: {
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.gold.line,
  },
  memberName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 16,
    color: theme.colors.white,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailLabel: { ...theme.typography.caption, fontSize: 10, color: theme.colors.accentGold },
  detailValue: { ...theme.typography.medium, fontSize: 14, color: theme.colors.white },
  detailValueFlagged: { color: theme.colors.danger },
  idImage: {
    width: '100%',
    height: 220,
    marginTop: theme.spacing.sm,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.background,
  },
  noImage: {
    ...theme.typography.body,
    fontSize: 13,
    marginTop: theme.spacing.sm,
    color: theme.colors.mutedGray,
  },
  actionRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  rejectButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  rejectButtonText: { ...theme.typography.medium, fontSize: 14, color: theme.colors.danger },
  approveButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.accentGold,
  },
  approveButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.primaryBlack,
  },
  disabled: { opacity: 0.5 },
});
