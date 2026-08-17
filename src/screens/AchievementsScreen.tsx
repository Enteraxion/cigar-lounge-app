/**
 * AchievementsScreen
 *
 * Matches design-reference/Travel Timeline & Achievements.pdf (bottom
 * half): header with overall completion percentage + progress bar, a
 * "Next Up" card, and badge categories (Explorer, Social Member,
 * Traveler) each with unlocked/total counts and a horizontally
 * scrollable row of badge tiles — unlocked badges shown in full color,
 * locked ones faded. Reached via "Achievements" on PassportScreen.
 *
 * Real, computed from the signed-in user's actual stats (see
 * src/utils/achievements.ts's computeAchievementCategories — thresholds
 * there are a first real pass, not a confirmed product decision, see
 * that file's header comment) — replaced the old hardcoded mock
 * (2026-08-13, Julian Brinkley's TestFlight feedback: "Is this
 * functional?" / "make that page real").
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Star } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { auth } from '../services/firebaseAuth';
import { getUserStats, type UserStats } from '../services/userActionsService';
import {
  computeAchievementCategories,
  nextLockedBadge,
  overallAchievementProgress,
} from '../utils/achievements';
import BadgeTile from '../components/BadgeTile';
import { getPassport } from '../services/passportService';
import type { PassportSummary } from '../utils/passport';
import type { ProfileStackParamList } from '../navigation/ProfileNavigator';
import { TAB_BAR_SCROLL_CLEARANCE } from '../utils/tabBarLayout';

type AchievementsNavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

export default function AchievementsScreen() {
  const navigation = useNavigation<AchievementsNavigationProp>();
  const userId = auth.currentUser?.uid;

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UserStats | null>(null);
  // The travel badges (Explorer/Traveler) are computed from real visits,
  // so this screen needs the passport alongside the plain stats.
  const [passport, setPassport] = useState<PassportSummary | null>(null);

  const load = useCallback(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([getUserStats(userId), getPassport(userId)])
      .then(([nextStats, bundle]) => {
        setStats(nextStats);
        setPassport(bundle.passport);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !stats) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back" hitSlop={12}>
            <ChevronLeft size={24} color={theme.colors.white} />
          </Pressable>
        </View>
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.colors.secondarySilver} />
        </View>
      </SafeAreaView>
    );
  }

  const categories = computeAchievementCategories(stats, passport);
  const progress = overallAchievementProgress(categories);
  const nextBadge = nextLockedBadge(categories);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back" hitSlop={12}>
          <ChevronLeft size={24} color={theme.colors.white} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ---------------- Title Row ---------------- */}
        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.headerCaption}>Milestones</Text>
              <Text style={styles.title}>Achievements</Text>
            </View>
            <View style={styles.percentGroup}>
              <Text style={styles.percentValue}>{progress.percent}%</Text>
              <Text style={styles.percentLabel}>Complete</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress.percent}%` }]} />
          </View>
        </View>

        {/* ---------------- Next Up ---------------- */}
        {nextBadge && (
          <View style={styles.recommendationCard}>
            <View style={styles.recommendationIconBox}>
              <Star size={18} color={theme.colors.accentGold} fill={theme.colors.accentGold} />
            </View>
            <Text style={styles.recommendationText}>
              Keep exploring to unlock &quot;{nextBadge.label}&quot;
            </Text>
          </View>
        )}

        {/* ---------------- Categories ---------------- */}
        {categories.map(category => (
          <View key={category.id} style={styles.category}>
            <View style={styles.categoryHeaderRow}>
              <Text style={styles.categoryName}>{category.name}</Text>
              <Text style={styles.categoryCount}>
                {category.unlockedCount} / {category.totalCount} Unlocked
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.badgeRow}
            >
              {category.badges.map(badge => (
                <BadgeTile key={badge.id} badge={badge} />
              ))}
            </ScrollView>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  stateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: TAB_BAR_SCROLL_CLEARANCE,
    gap: theme.spacing.xl,
  },

  // ---- Title row ----
  titleBlock: {
    gap: theme.spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerCaption: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.mutedGray,
  },
  title: {
    ...theme.typography.headingLarge,
    color: theme.colors.white,
    marginTop: 2,
  },
  percentGroup: {
    alignItems: 'flex-end',
  },
  percentValue: {
    ...theme.typography.headingMedium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 24,
    color: theme.colors.accentGold,
  },
  percentLabel: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.mutedGray,
  },

  // ---- Progress ----
  progressTrack: {
    height: 6,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(192, 192, 192, 0.15)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentGold,
  },

  // ---- Recommendation ----
  recommendationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
  },
  recommendationIconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    lineHeight: 19,
    color: theme.colors.white,
    flex: 1,
  },

  // ---- Categories ----
  category: {
    gap: theme.spacing.md,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 16,
    color: theme.colors.white,
  },
  categoryCount: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.mutedGray,
  },
  badgeRow: {
    gap: theme.spacing.md,
    paddingRight: theme.spacing.lg,
  },
});
