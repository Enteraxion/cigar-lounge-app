/**
 * ReviewsScreen
 *
 * Matches design-reference/Lounge Reviews & Write Review.pdf (Part 1):
 * header, a summary card (overall rating + star row + rating
 * distribution bar chart), a vertical list of review cards (with
 * category rating chips, optional photos, helpful/comment counts, and an
 * optional nested owner response), and a fixed "Write Review" button.
 *
 * Real Firestore data via src/services/loungeService.ts's
 * getReviewsForLounge() — the same function LoungeDetailScreen uses for
 * its single "latest review" preview — refetched on focus (useFocusEffect,
 * matching TravelWishlistScreen's convention) so an edit/delete made
 * elsewhere (or a review just submitted) shows up immediately on return.
 * The summary card's average rating + star distribution are computed
 * client-side from the fetched reviews rather than a separate summary
 * service. Edit/delete affordances mirror LoungeDetailScreen's real-review
 * pattern exactly (icons shown only for the signed-in member's own
 * review, same confirmation copy, same WriteReview nav params) — see that
 * screen for the original implementation this was matched against.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import {
  ChevronLeft,
  MessageCircle,
  Pencil,
  SlidersHorizontal,
  ThumbsUp,
  Trash2,
} from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import { useAgeVerification } from '../hooks/useAgeVerification';
import { verificationGateMessage, type GatedAction } from '../utils/verificationGate';
import StarRating from '../components/StarRating';
import FilterReviewsSheet from '../components/FilterReviewsSheet';
import { getReviewsForLounge, type Review } from '../services/loungeService';
import { deleteReview, toggleReviewHelpful } from '../services/userActionsService';
import { auth } from '../services/firebaseAuth';
import { applyReviewFilters, defaultReviewFilters, type ReviewFilters } from '../utils/reviewFilters';
import type { ReviewCategoryRatings } from '../types/firestore';
import type { SearchStackParamList } from '../navigation/SearchNavigator';

type ReviewsNavigationProp = NativeStackNavigationProp<SearchStackParamList>;
type ReviewsRouteProp = RouteProp<SearchStackParamList, 'LoungeReviews'>;

type DistributionRow = {
  stars: number;
  percent: number;
};

type ReviewsSummary = {
  overallRating: number;
  totalCount: number;
  distribution: DistributionRow[];
};

// Maps the schema's camelCase ReviewCategoryRatings keys (src/types/
// firestore.ts) to the display labels used on WriteReviewScreen (see that
// screen's CATEGORY_KEY_MAP, which goes the other direction).
const CATEGORY_LABELS: Record<keyof ReviewCategoryRatings, string> = {
  atmosphere: 'Atmosphere',
  humidorVariety: 'Humidor Selection',
  staffKnowledge: 'Staff Knowledge',
  service: 'Service',
  ventilation: 'Ventilation',
  comfort: 'Comfort',
  whiskeySelection: 'Whiskey Selection',
  luxuryExperience: 'Luxury Experience',
};

function computeSummary(reviewList: Review[]): ReviewsSummary {
  const totalCount = reviewList.length;
  const overallRating = totalCount
    ? reviewList.reduce((sum, review) => sum + review.rating, 0) / totalCount
    : 0;
  const distribution: DistributionRow[] = [5, 4, 3, 2, 1].map(stars => {
    const count = reviewList.filter(review => Math.round(review.rating) === stars).length;
    return { stars, percent: totalCount ? count / totalCount : 0 };
  });
  return { overallRating, totalCount, distribution };
}

/** "Just now" / "3d ago" / "2w ago" style relative timestamp for a review's createdAt. */
function formatTimeAgo(date: Date): string {
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function ReviewCard({
  review,
  loungeId,
  isOwner,
  deleting,
  onEdit,
  onDelete,
}: {
  review: Review;
  loungeId: string;
  isOwner: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const userId = auth.currentUser?.uid;
  const [markedHelpful, setMarkedHelpful] = useState(
    () => userId !== undefined && (review.helpfulUserIds?.includes(userId) ?? false),
  );
  const [pending, setPending] = useState(false);

  const onPressHelpful = async () => {
    if (pending || !userId) return;
    const optimistic = !markedHelpful;
    setMarkedHelpful(optimistic);
    setPending(true);
    try {
      await toggleReviewHelpful(loungeId, review.id, userId);
    } catch {
      setMarkedHelpful(!optimistic);
      Alert.alert("Couldn't update", 'Check your connection and try again.');
    } finally {
      setPending(false);
    }
  };

  const categoryEntries = Object.entries(review.categoryRatings) as Array<
    [keyof ReviewCategoryRatings, number]
  >;

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeaderRow}>
        <Image source={{ uri: review.userAvatar }} style={styles.avatar} />
        <View style={styles.reviewAuthorGroup}>
          <Text style={styles.authorName}>{review.userName}</Text>
          <Text style={styles.authorMeta}>
            {review.memberTier} • {formatTimeAgo(review.createdAt.toDate())}
          </Text>
        </View>
        <StarRating rating={review.rating} size={12} />
      </View>

      <Text style={styles.reviewText}>"{review.text}"</Text>

      {categoryEntries.length > 0 ? (
        <View style={styles.categoryRow}>
          {categoryEntries.map(([key, score]) => (
            <View key={key} style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>
                {CATEGORY_LABELS[key]} {score.toFixed(1)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {review.photos.length > 0 ? (
        <View style={styles.photoRow}>
          {review.photos.map((uri, index) => (
            <Image key={index} source={{ uri }} style={styles.photo} />
          ))}
        </View>
      ) : null}

      {review.ownerResponse ? (
        <View style={styles.ownerResponseCard}>
          <Text style={styles.ownerResponseLabel}>RESPONSE FROM THE OWNER</Text>
          <Text style={styles.ownerResponseText}>"{review.ownerResponse.text}"</Text>
        </View>
      ) : null}

      <View style={styles.footerRow}>
        <View style={styles.footerStat}>
          <ThumbsUp size={14} color={theme.colors.mutedGray} />
          <Text style={styles.footerStatText}>{review.helpfulCount}</Text>
        </View>
        <View style={styles.footerStat}>
          <MessageCircle size={14} color={theme.colors.mutedGray} />
        </View>
        {isOwner ? (
          <View style={styles.reviewOwnerActions}>
            <Pressable onPress={onEdit} hitSlop={8} disabled={deleting}>
              <Pencil size={15} color={theme.colors.mutedGray} />
            </Pressable>
            <Pressable onPress={onDelete} hitSlop={8} disabled={deleting}>
              {deleting ? (
                <ActivityIndicator size="small" color={theme.colors.danger} />
              ) : (
                <Trash2 size={15} color={theme.colors.danger} />
              )}
            </Pressable>
          </View>
        ) : null}
        <Pressable
          style={[styles.helpfulButton, markedHelpful && styles.helpfulButtonActive]}
          onPress={onPressHelpful}
          disabled={pending}
        >
          <Text
            style={[
              styles.helpfulButtonText,
              markedHelpful && styles.helpfulButtonTextActive,
            ]}
          >
            {markedHelpful ? 'Helpful' : 'Helpful?'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ReviewsScreen() {
  const navigation = useNavigation<ReviewsNavigationProp>();
  const route = useRoute<ReviewsRouteProp>();
  const loungeId = route.params?.loungeId;
  const userId = auth.currentUser?.uid;

  const [reviews, setReviews] = useState<Review[] | null>(null);
  const ageState = useAgeVerification();

  // Step 4 of the 21+ flow: browsing reviews is open, writing one is not.
  // Grandfathered accounts (no record at all) pass, so this cannot lock out
  // anyone who predates the feature.
  const requireVerified = (action: GatedAction, proceed: () => void) => {
    if (ageState.isVerified || ageState.verification === null) {
      proceed();
      return;
    }
    const { title, body } = verificationGateMessage(action, ageState);
    Alert.alert(title, body);
  };

  const [error, setError] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [appliedReviewFilters, setAppliedReviewFilters] =
    useState<ReviewFilters>(defaultReviewFilters);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!loungeId) {
      setError('No lounge selected.');
      return;
    }
    setError(null);
    setReviews(null);
    try {
      setReviews(await getReviewsForLounge(loungeId));
    } catch {
      setError("Couldn't load reviews. Check your connection and try again.");
    }
  }, [loungeId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onEditReview = (review: Review) => {
    if (!loungeId) return;
    navigation.navigate('WriteReview', {
      loungeId,
      reviewId: review.id,
      initialReview: {
        rating: review.rating,
        text: review.text,
        categoryRatings: review.categoryRatings,
        wouldReturn: review.wouldReturn,
        recommend: review.recommend,
        photos: review.photos,
      },
    });
  };

  const onDeleteReview = (review: Review) => {
    if (!loungeId || deletingIds.has(review.id)) return;
    Alert.alert('Delete Review', 'Are you sure you want to delete this review?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingIds(prev => new Set(prev).add(review.id));
          try {
            await deleteReview(loungeId, review.id);
            setReviews(prev => (prev ? prev.filter(r => r.id !== review.id) : prev));
          } catch {
            Alert.alert("Couldn't delete review", 'Check your connection and try again.');
          } finally {
            setDeletingIds(prev => {
              const next = new Set(prev);
              next.delete(review.id);
              return next;
            });
          }
        },
      },
    ]);
  };

  // Summary card always reflects every review for the lounge, regardless
  // of the member's own sort/filter choice below — same convention as
  // most review UIs (the filter narrows the list, not the lounge's
  // overall rating).
  const summary = computeSummary(reviews ?? []);
  const distributionTopToBottom = [...summary.distribution].reverse();

  const displayReviews = useMemo(
    () => applyReviewFilters(reviews ?? [], appliedReviewFilters),
    [reviews, appliedReviewFilters],
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back" hitSlop={12}>
          <ChevronLeft size={24} color={theme.colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Reviews</Text>
        <Pressable
          style={styles.filterButton}
          onPress={() => setFilterVisible(true)}
          hitSlop={8}
        >
          <SlidersHorizontal size={18} color={theme.colors.white} />
        </Pressable>
      </View>

      {error ? (
        <View style={styles.stateBox}>
          <Text style={styles.errorText}>{error}</Text>
          {loungeId ? (
            <Pressable style={styles.retryButton} onPress={load}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </Pressable>
          ) : null}
        </View>
      ) : reviews === null ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.colors.secondarySilver} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ---------------- Summary Card ---------------- */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryRating}>{summary.overallRating.toFixed(1)}</Text>
              <StarRating rating={summary.overallRating} size={14} />
              <Text style={styles.summaryCount}>{summary.totalCount} Reviews</Text>
            </View>
            <View style={styles.summaryRight}>
              {distributionTopToBottom.map(row => (
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

          <Pressable
            style={styles.breakdownLink}
            onPress={() => loungeId && navigation.navigate('RatingsBreakdown', { loungeId })}
            hitSlop={8}
          >
            <Text style={styles.breakdownLinkText}>See Full Ratings Breakdown</Text>
          </Pressable>

          {/* ---------------- Review List ---------------- */}
          {reviews.length === 0 ? (
            <Text style={styles.emptyText}>No reviews yet — be the first to write one.</Text>
          ) : displayReviews.length === 0 ? (
            <Text style={styles.emptyText}>No reviews match the current filter.</Text>
          ) : (
            <View style={styles.reviewList}>
              {displayReviews.map(review => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  loungeId={loungeId}
                  isOwner={userId !== undefined && review.userId === userId}
                  deleting={deletingIds.has(review.id)}
                  onEdit={() => onEditReview(review)}
                  onDelete={() => onDeleteReview(review)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <Pressable
        style={styles.writeReviewButton}
        onPress={() =>
          requireVerified('review', () => navigation.navigate('WriteReview', { loungeId }))
        }
      >
        <Text style={styles.writeReviewButtonText}>Write Review</Text>
      </Pressable>

      <FilterReviewsSheet
        visible={filterVisible}
        reviews={reviews ?? []}
        initialFilters={appliedReviewFilters}
        onApply={setAppliedReviewFilters}
        onClose={() => setFilterVisible(false)}
      />
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
  filterButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.15),
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 160,
    gap: theme.spacing.lg,
  },

  // ---- Loading / error / empty state ----
  stateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  errorText: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.mutedGray,
    textAlign: 'center',
  },
  emptyText: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.mutedGray,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: theme.spacing.lg,
    height: 44,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.white,
  },

  // ---- Ratings breakdown link ----
  breakdownLink: {
    alignSelf: 'center',
  },
  breakdownLinkText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.accentGold,
    textDecorationLine: 'underline',
  },

  // ---- Summary card ----
  summaryCard: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.soft,
  },
  summaryLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingRight: theme.spacing.lg,
    borderRightWidth: 1,
    borderRightColor: withAlpha(theme.colors.secondarySilver, 0.15),
  },
  summaryRating: {
    ...theme.typography.headingMedium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 40,
    color: theme.colors.white,
  },
  summaryCount: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.mutedGray,
  },
  summaryRight: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
    paddingLeft: theme.spacing.lg,
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
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.15),
    overflow: 'hidden',
  },
  distributionFill: {
    height: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentGold,
  },

  // ---- Review list ----
  reviewList: {
    gap: theme.spacing.lg,
  },
  reviewCard: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.sm,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.background,
  },
  reviewAuthorGroup: {
    flex: 1,
    gap: 1,
  },
  authorName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  authorMeta: {
    ...theme.typography.medium,
    fontSize: 11,
    color: theme.colors.mutedGray,
  },
  reviewText: {
    ...theme.typography.medium,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.secondarySilver,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.12),
  },
  categoryChipText: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.secondarySilver,
  },
  photoRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.small,
    backgroundColor: theme.colors.background,
  },

  // ---- Owner response ----
  ownerResponseCard: {
    padding: theme.spacing.sm,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: theme.colors.accentGold,
    backgroundColor: withAlpha(theme.colors.accentGold, 0.08),
    gap: theme.spacing.xs,
  },
  ownerResponseLabel: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.accentGold,
  },
  ownerResponseText: {
    ...theme.typography.medium,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.secondarySilver,
  },

  // ---- Footer ----
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  footerStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerStatText: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },
  reviewOwnerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  helpfulButton: {
    marginLeft: 'auto',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.3),
  },
  helpfulButtonActive: {
    backgroundColor: theme.colors.accentGold,
    borderColor: theme.colors.secondarySilver,
  },
  helpfulButtonText: {
    ...theme.typography.medium,
    fontSize: 11,
    color: theme.colors.secondarySilver,
  },
  helpfulButtonTextActive: {
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.primaryBlack,
  },

  // ---- Write Review button ----
  writeReviewButton: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    bottom: 100,
    height: 52,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.deep,
  },
  writeReviewButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 15,
    color: theme.colors.primaryBlack,
  },
});
