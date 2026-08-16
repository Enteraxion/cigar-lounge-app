/**
 * RatingsBreakdownScreen
 *
 * Matches the top half of design-reference/Ratings Breakdown & Filter
 * Reviews.pdf: an overall rating card with a star distribution chart, a
 * "Specific Categories" list of ProgressRatingBar cards (shared with
 * Lounge Detail's "The Verdict"), a Food & Drinks Quality bar, and two
 * rows of small stat highlight cards.
 *
 * Real data throughout — reached with a `loungeId` param (previously this
 * screen took no param and always rendered the same hardcoded numbers
 * regardless of which lounge's reviews you came from). Category
 * scores/Food & Drinks come straight from the lounge doc's own
 * `ratings` (see src/types/firestore.ts's LoungeRatings — every field
 * used here already exists there). The star distribution chart is the
 * one number that doesn't live on the lounge doc — it's computed
 * client-side from that lounge's actual reviews subcollection, bucketed
 * by rounded star rating.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { theme } from '../theme';
import StarRating from '../components/StarRating';
import ProgressRatingBar from '../components/ProgressRatingBar';
import { getLoungeById, getReviewsForLounge, type Lounge } from '../services/loungeService';
import type { SearchStackParamList } from '../navigation/SearchNavigator';

type RatingsBreakdownNavigationProp = NativeStackNavigationProp<SearchStackParamList>;
type RatingsBreakdownRouteProp = RouteProp<SearchStackParamList, 'RatingsBreakdown'>;

type DistributionRow = { stars: number; percent: number };

function ratingDistributionFrom(ratings: number[]): DistributionRow[] {
  const counts = [0, 0, 0, 0, 0];
  for (const rating of ratings) {
    const bucket = Math.min(5, Math.max(1, Math.round(rating)));
    counts[bucket - 1] += 1;
  }
  const max = Math.max(1, ...counts);
  return [5, 4, 3, 2, 1].map(stars => ({ stars, percent: counts[stars - 1] / max }));
}

function StatCard({ label, score }: { label: string; score: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.statValue}>{score.toFixed(1)} / 5</Text>
    </View>
  );
}

export default function RatingsBreakdownScreen() {
  const navigation = useNavigation<RatingsBreakdownNavigationProp>();
  const route = useRoute<RatingsBreakdownRouteProp>();
  const { loungeId } = route.params;

  const [loading, setLoading] = useState(true);
  const [lounge, setLounge] = useState<Lounge | null>(null);
  const [distribution, setDistribution] = useState<DistributionRow[]>(
    [5, 4, 3, 2, 1].map(stars => ({ stars, percent: 0 })),
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([getLoungeById(loungeId), getReviewsForLounge(loungeId)])
      .then(([loungeResult, reviews]) => {
        if (cancelled) return;
        setLounge(loungeResult);
        setDistribution(ratingDistributionFrom(reviews.map(review => review.rating)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loungeId]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={24} color={theme.colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Ratings Breakdown</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading || !lounge ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.colors.secondarySilver} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* ---------------- Overall Rating ---------------- */}
          <View style={styles.overallCard}>
            <Text style={styles.overallLabel}>Overall Rating</Text>
            <View style={styles.overallHeaderRow}>
              <Text style={styles.overallNumber}>
                {lounge.ratings.overall.toFixed(1)}
                <Text style={styles.overallMax}> / 5.0</Text>
              </Text>
              <View style={styles.overallRightGroup}>
                <StarRating rating={lounge.ratings.overall} size={14} />
                <Text style={styles.verifiedLabel}>{lounge.reviewCount} Reviews</Text>
              </View>
            </View>

            <View style={styles.distributionList}>
              {distribution.map(row => (
                <View key={row.stars} style={styles.distributionRow}>
                  <Text style={styles.distributionLabel}>{row.stars}★</Text>
                  <View style={styles.distributionTrack}>
                    <View style={[styles.distributionFill, { width: `${row.percent * 100}%` }]} />
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* ---------------- Specific Categories ---------------- */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Specific Categories</Text>
            <View style={styles.categoryCardList}>
              <View style={styles.categoryCard}>
                <ProgressRatingBar label="Atmosphere" score={lounge.ratings.atmosphere} />
              </View>
              <View style={styles.categoryCard}>
                <ProgressRatingBar label="Humidor Variety" score={lounge.ratings.humidorVariety} />
              </View>
              <View style={styles.categoryCard}>
                <ProgressRatingBar label="Service" score={lounge.ratings.service} />
              </View>
              <View style={styles.categoryCard}>
                <ProgressRatingBar label="Comfort" score={lounge.ratings.comfort} />
              </View>
              <View style={styles.categoryCard}>
                <ProgressRatingBar label="Ventilation" score={lounge.ratings.ventilation} />
              </View>
            </View>
          </View>

          {/* ---------------- Food & Drinks Quality ---------------- */}
          <View style={styles.categoryCard}>
            <ProgressRatingBar label="Food & Drinks Quality" score={lounge.ratings.foodDrinksQuality} />
          </View>

          {/* ---------------- Stat Rows ---------------- */}
          <View style={styles.statRow}>
            <StatCard label="Wi-Fi Speed" score={lounge.ratings.wifiSpeed} />
            <StatCard label="Business Friendly" score={lounge.ratings.businessFriendly} />
          </View>
          <View style={styles.statRow}>
            <StatCard label="Social Scene" score={lounge.ratings.socialScene} />
            <StatCard label="Parking" score={lounge.ratings.parking} />
          </View>
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

  stateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
