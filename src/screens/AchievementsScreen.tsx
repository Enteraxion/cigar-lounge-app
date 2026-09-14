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
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme, withAlpha } from '../theme';
import { auth } from '../services/firebaseAuth';
import { getUserStats, type UserStats } from '../services/userActionsService';
import {
  type Badge,
  computeAchievementCategories,
  nextLockedBadge,
  overallAchievementProgress,
} from '../utils/achievements';
import BadgeTile, { BADGE_ICON } from '../components/BadgeTile';
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
  // The badge a member has tapped to ask "why is this locked?". Nothing in
  // the app answered that before — a locked tile was grey and silent.
  const [explained, setExplained] = useState<Badge | null>(null);
  /**
   * Without this the screen hung. The load was `.then().finally()` with no
   * `.catch()`: a rejection left `stats` null while `loading` went false, and
   * the render guard `loading || !stats` then showed the spinner for ever —
   * indistinguishable from a frozen app, with an unhandled rejection behind
   * it. Same error-and-retry shape as MyShopsScreen (audit F6, 2026-09-14).
   */
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([getUserStats(userId), getPassport(userId)])
      .then(([nextStats, bundle]) => {
        setStats(nextStats);
        setPassport(bundle.passport);
      })
      .catch(() => setError("We couldn't load your achievements."))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error || (!loading && !stats)) {
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
          <Text style={styles.stateText}>
            {error ?? "We couldn't load your achievements."}
          </Text>
          <Pressable style={styles.retryButton} onPress={load} accessibilityRole="button">
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

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
              {/* The badge names its own requirement — see Badge.requirement.
                  This used to read "Keep exploring" for every badge, which
                  sent members after photographs by visiting more lounges. */}
              {nextBadge.requirement} to unlock &quot;{nextBadge.label}&quot;
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
                <BadgeTile
                  key={badge.id}
                  badge={badge}
                  onPress={() => setExplained(badge)}
                />
              ))}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      <Modal
        visible={explained !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setExplained(null)}
      >
        <Pressable style={styles.explainBackdrop} onPress={() => setExplained(null)}>
          <Pressable style={styles.explainCard} onPress={() => {}}>
            {explained ? <ExplainedBadge badge={explained} /> : null}
            <Pressable
              style={styles.explainDismiss}
              onPress={() => setExplained(null)}
              accessibilityRole="button"
            >
              <Text style={styles.explainDismissText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/** The contents of the tap-a-badge card: what it is, and what it asks for. */
function ExplainedBadge({ badge }: { badge: Badge }) {
  const Icon = BADGE_ICON[badge.icon];
  return (
    <>
      <View style={[styles.explainIconBox, !badge.unlocked && styles.explainIconBoxLocked]}>
        <Icon size={26} color={badge.unlocked ? theme.colors.accentGold : theme.colors.mutedGray} />
      </View>
      <Text style={styles.explainTitle}>{badge.label}</Text>
      <Text style={styles.explainRequirement}>{badge.requirement}</Text>
      <Text style={styles.explainStatus}>
        {badge.unlocked ? 'Unlocked' : 'Not yet unlocked'}
      </Text>
    </>
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
  retryText: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.accentGold,
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
    color: theme.colors.accentGold,
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
    color: theme.colors.accentGold,
  },

  // ---- Progress ----
  progressTrack: {
    height: 6,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.15),
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentGold,
  },

  // ---- Recommendation ----
  // ---- Tap-a-badge explanation ----
  explainBackdrop: {
    flex: 1,
    backgroundColor: withAlpha(theme.colors.primaryBlack, 0.72),
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  explainCard: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
  },
  explainIconBox: {
    width: 68,
    height: 68,
    borderRadius: theme.radius.large,
    backgroundColor: withAlpha(theme.colors.accentGold, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  explainIconBoxLocked: {
    backgroundColor: theme.colors.background,
  },
  explainTitle: {
    ...theme.typography.headingSmall,
    fontSize: 20,
    color: theme.colors.white,
    textAlign: 'center',
  },
  explainRequirement: {
    ...theme.typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.secondarySilver,
    textAlign: 'center',
  },
  explainStatus: {
    ...theme.typography.medium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.mutedGray,
  },
  explainDismiss: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
  },
  explainDismissText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.accentGold,
  },

  recommendationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
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
