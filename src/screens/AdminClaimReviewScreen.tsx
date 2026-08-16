/**
 * AdminClaimReviewScreen
 *
 * Reached from ProfileScreen's admin-only "Review Business Claims" card
 * (see src/config/admins.ts — gates the UI; firestore.rules's isAdmin()
 * separately enforces this for real at the database level). Lists every
 * lounge with a claim currently awaiting review (ownerService.
 * getPendingClaims) and lets the admin approve (grants ownership) or
 * reject (reverts the lounge to unclaimed) each one.
 */

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ShieldCheck } from 'lucide-react-native';
import { theme } from '../theme';
import { approveLoungeClaim, getPendingClaims, rejectLoungeClaim, type PendingClaim } from '../services/ownerService';
import type { ProfileStackParamList } from '../navigation/ProfileNavigator';

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

export default function AdminClaimReviewScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [claims, setClaims] = useState<PendingClaim[]>([]);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    getPendingClaims()
      .then(setClaims)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  const approve = async (claim: PendingClaim) => {
    setActioningId(claim.id);
    try {
      await approveLoungeClaim(claim.id);
      setClaims(current => current.filter(c => c.id !== claim.id));
    } catch (error) {
      Alert.alert(
        "Couldn't approve claim",
        error instanceof Error ? error.message : 'Check your connection and try again.',
      );
    } finally {
      setActioningId(null);
    }
  };

  const reject = (claim: PendingClaim) => {
    Alert.alert('Reject this claim?', `${claim.name} will become claimable again.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setActioningId(claim.id);
          try {
            await rejectLoungeClaim(claim.id);
            setClaims(current => current.filter(c => c.id !== claim.id));
          } catch (error) {
            Alert.alert(
              "Couldn't reject claim",
              error instanceof Error ? error.message : 'Check your connection and try again.',
            );
          } finally {
            setActioningId(null);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <ChevronLeft size={20} color={theme.colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Review Business Claims</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.colors.secondarySilver} />
        </View>
      ) : loadError ? (
        <View style={styles.stateBox}>
          <Text style={styles.emptyText}>Couldn't load pending claims.</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : claims.length === 0 ? (
        <View style={styles.stateBox}>
          <ShieldCheck size={32} color={theme.colors.mutedGray} />
          <Text style={styles.emptyText}>No pending claims right now.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {claims.map(claim => (
            <View key={claim.id} style={styles.card}>
              <Text style={styles.loungeName}>{claim.name}</Text>
              <Text style={styles.loungeAddress}>{claim.address}</Text>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Claimant</Text>
                <Text style={styles.detailValue}>{claim.ownerName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{claim.ownerContactEmail}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone</Text>
                <Text style={styles.detailValue}>{claim.ownerContactPhone}</Text>
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  style={[styles.rejectButton, actioningId === claim.id && styles.buttonDisabled]}
                  onPress={() => reject(claim)}
                  disabled={actioningId === claim.id}
                >
                  <Text style={styles.rejectButtonText}>Reject</Text>
                </Pressable>
                <Pressable
                  style={[styles.approveButton, actioningId === claim.id && styles.buttonDisabled]}
                  onPress={() => approve(claim)}
                  disabled={actioningId === claim.id}
                >
                  {actioningId === claim.id ? (
                    <ActivityIndicator color={theme.colors.primaryNavy} />
                  ) : (
                    <Text style={styles.approveButtonText}>Approve</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(192, 192, 192, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 17,
    color: theme.colors.white,
  },
  headerSpacer: {
    width: 32,
  },
  stateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  emptyText: {
    ...theme.typography.body,
    fontSize: 14,
    color: theme.colors.mutedGray,
  },
  retryButton: {
    paddingHorizontal: theme.spacing.lg,
    height: 44,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surfaceNavy,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    // Clears MainNavigator's floating pill tab bar (bottom: 24 + height: 64)
    // plus breathing room, so the last card never sits under it.
    paddingBottom: theme.spacing.xxl + 64,
    gap: theme.spacing.md,
  },
  card: {
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    padding: theme.spacing.md,
    gap: 4,
    ...theme.shadows.soft,
  },
  loungeName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 16,
    color: theme.colors.white,
  },
  loungeAddress: {
    ...theme.typography.body,
    fontSize: 12,
    color: theme.colors.mutedGray,
    marginBottom: theme.spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.mutedGray,
  },
  detailValue: {
    ...theme.typography.body,
    fontSize: 12,
    color: theme.colors.secondarySilver,
    flexShrink: 1,
    textAlign: 'right',
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  rejectButton: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  rejectButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.danger,
  },
  approveButton: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.white,
  },
  approveButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 14,
    color: theme.colors.primaryNavy,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
