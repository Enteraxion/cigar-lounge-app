/**
 * RatingsBreakdownScreen
 *
 * Matches the top half of design-reference/Ratings Breakdown & Filter
 * Reviews.pdf: an overall rating card with a star distribution chart, a
 * "Specific Categories" list of ProgressRatingBar cards (shared with
 * Lounge Detail's "The Verdict"), a Food & Drinks Quality bar, and two
 * rows of small stat highlight cards. Mock data only (see
 * src/data/mockRatingsBreakdown.ts) — no backend wired up yet.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { theme } from '../theme';
import StarRating from '../components/StarRating';
import ProgressRatingBar from '../components/ProgressRatingBar';
import {
  foodAndDrinksQuality,
  overallRating,
  ratingDistribution,
  specificCategories,
  statHighlightsRowOne,
  statHighlightsRowTwo,
  type StatHighlight,
} from '../data/mockRatingsBreakdown';
import type { SearchStackParamList } from '../navigation/SearchNavigator';

type RatingsBreakdownNavigationProp = NativeStackNavigationProp<SearchStackParamList>;

function StatCard({ stat }: { stat: StatHighlight }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {stat.label}
      </Text>
      <Text style={styles.statValue}>{stat.value}</Text>
    </View>
  );
}

export default function RatingsBreakdownScreen() {
  const navigation = useNavigation<RatingsBreakdownNavigationProp>();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={24} color={theme.colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Ratings Breakdown</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ---------------- Overall Rating ---------------- */}
        <View style={styles.overallCard}>
          <Text style={styles.overallLabel}>Overall Rating</Text>
          <View style={styles.overallHeaderRow}>
            <Text style={styles.overallNumber}>
              {overallRating.score.toFixed(1)}
              <Text style={styles.overallMax}> / {overallRating.maxScore.toFixed(1)}</Text>
            </Text>
            <View style={styles.overallRightGroup}>
              <StarRating rating={overallRating.score} size={14} />
              <Text style={styles.verifiedLabel}>{overallRating.verifiedCount} Verified Reviews</Text>
            </View>
          </View>

          <View style={styles.distributionList}>
            {ratingDistribution.map(row => (
              <View key={row.stars} style={styles.distributionRow}>
                <Text style={styles.distributionLabel}>{row.stars}★</Text>
                <View style={styles.distributionTrack}>
                  <View
                    style={[styles.distributionFill, { width: `${row.percent * 100}%` }]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ---------------- Specific Categories ---------------- */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Specific Categories</Text>
          <View style={styles.categoryCardList}>
            {specificCategories.map(category => (
              <View key={category.label} style={styles.categoryCard}>
                <ProgressRatingBar label={category.label} score={category.score} />
              </View>
            ))}
          </View>
        </View>

        {/* ---------------- Stat Row 1 ---------------- */}
        <View style={styles.statRow}>
          <StatCard stat={statHighlightsRowOne[0]} />
          <StatCard stat={statHighlightsRowOne[1]} />
        </View>

        {/* ---------------- Food & Drinks Quality ---------------- */}
        <View style={styles.categoryCard}>
          <ProgressRatingBar label={foodAndDrinksQuality.label} score={foodAndDrinksQuality.score} />
        </View>

        {/* ---------------- Stat Row 2 ---------------- */}
        <View style={styles.statRow}>
          <StatCard stat={statHighlightsRowTwo[0]} />
          <StatCard stat={statHighlightsRowTwo[1]} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // ---- Header ----
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  headerTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 17,
    color: theme.colors.white,
  },
  headerSpacer: {
    width: 24,
  },

  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 100,
    gap: theme.spacing.lg,
  },

  // ---- Overall rating card ----
  overallCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    gap: theme.spacing.md,
    ...theme.shadows.soft,
  },
  overallLabel: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.mutedGray,
  },
  overallHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  overallNumber: {
    ...theme.typography.headingMedium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 34,
    color: theme.colors.white,
  },
  overallMax: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.medium,
    fontSize: 16,
    color: theme.colors.mutedGray,
  },
  overallRightGroup: {
    alignItems: 'flex-end',
    gap: 4,
  },
  verifiedLabel: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.mutedGray,
  },

  distributionList: {
    gap: theme.spacing.xs,
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  distributionLabel: {
    ...theme.typography.medium,
    fontSize: 11,
    color: theme.colors.mutedGray,
    width: 18,
  },
  distributionTrack: {
    flex: 1,
    height: 6,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(192, 192, 192, 0.15)',
    overflow: 'hidden',
  },
  distributionFill: {
    height: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentGold,
  },

  // ---- Fields ----
  field: {
    gap: theme.spacing.sm,
  },
  fieldLabel: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.mutedGray,
  },

  // ---- Category cards ----
  categoryCardList: {
    gap: theme.spacing.sm,
  },
  categoryCard: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
  },

  // ---- Stat cards ----
  statRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    gap: 4,
  },
  statLabel: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.mutedGray,
  },
  statValue: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.white,
  },
});
