/**
 * FilterReviewsSheet
 *
 * Matches the bottom half of design-reference/Ratings Breakdown & Filter
 * Reviews.pdf: a bottom sheet with Sort By / Star Rating filters and a
 * sticky "Show Results" footer. Built with RN's built-in Modal — same
 * pattern as FilterBottomSheet and SortBottomSheet.
 *
 * Sort and Star Rating are both real (see src/utils/reviewFilters.ts),
 * computed against the lounge's actual fetched reviews, and reported
 * back to ReviewsScreen via `onApply` — same lift-up draft-state pattern
 * FilterBottomSheet uses. The design's "Verified Visitors" toggle and
 * "Reviewer Type" chips were dropped: neither has any backing field on
 * ReviewDocument (no visit-verification system, no reviewer-type
 * concept exists anywhere in the schema), so they could only ever have
 * been decorative — keeping them would just trade one placeholder for
 * another.
 */

import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';
import type { Review } from '../services/loungeService';
import {
  applyReviewFilters,
  defaultReviewFilters,
  REVIEW_SORT_OPTIONS,
  type ReviewFilters,
  type ReviewSortOption,
} from '../utils/reviewFilters';

type Props = {
  visible: boolean;
  reviews: Review[];
  initialFilters: ReviewFilters;
  onApply: (filters: ReviewFilters) => void;
  onClose: () => void;
};

const STAR_RATINGS = [5, 4, 3, 2, 1];

function PillChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipSelected : styles.chipUnselected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function StarChip({
  stars,
  selected,
  onPress,
}: {
  stars: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, styles.starChip, selected && styles.starChipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.starChipTextSelected]}>{stars}★+</Text>
    </Pressable>
  );
}

export default function FilterReviewsSheet({
  visible,
  reviews,
  initialFilters,
  onApply,
  onClose,
}: Props) {
  const [sortBy, setSortBy] = useState<ReviewSortOption>(initialFilters.sortBy);
  const [minStars, setMinStars] = useState<number | null>(initialFilters.minStars);

  const clearAll = () => {
    setSortBy(defaultReviewFilters.sortBy);
    setMinStars(defaultReviewFilters.minStars);
  };

  const draftFilters: ReviewFilters = { sortBy, minStars };
  const resultCount = applyReviewFilters(reviews, draftFilters).length;

  const handleShowResults = () => {
    onApply(draftFilters);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          <Text style={styles.title}>Filter Reviews</Text>
          <Pressable onPress={clearAll} hitSlop={8}>
            <Text style={styles.clearAllLink}>Clear All</Text>
          </Pressable>
        </View>

        {/* ---------------- Sort By ---------------- */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Sort By</Text>
          <View style={styles.chipRow}>
            {REVIEW_SORT_OPTIONS.map(option => (
              <PillChip
                key={option}
                label={option}
                selected={sortBy === option}
                onPress={() => setSortBy(option)}
              />
            ))}
          </View>
        </View>

        {/* ---------------- Star Rating ---------------- */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Minimum Star Rating</Text>
          <View style={styles.chipRow}>
            {STAR_RATINGS.map(stars => (
              <StarChip
                key={stars}
                stars={stars}
                selected={minStars === stars}
                onPress={() => setMinStars(prev => (prev === stars ? null : stars))}
              />
            ))}
          </View>
        </View>

        <Pressable style={styles.showResultsButton} onPress={handleShowResults}>
          <Text style={styles.showResultsButtonText}>Show Results ({resultCount})</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 24, 0.7)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceNavy,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.lg,
    ...theme.shadows.deep,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(192, 192, 192, 0.3)',
    marginTop: theme.spacing.sm,
  },

  // ---- Header ----
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...theme.typography.headingMedium,
    fontFamily: theme.fontFamily.regular,
    fontSize: 26,
    color: theme.colors.white,
  },
  clearAllLink: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.mutedGray,
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

  // ---- Chips ----
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    height: 40,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: theme.colors.secondarySilver,
    borderWidth: 1,
    borderColor: theme.colors.secondarySilver,
  },
  chipUnselected: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.3)',
  },
  chipText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.secondarySilver,
  },
  chipTextSelected: {
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.primaryNavy,
  },

  // ---- Star rating chips ----
  starChip: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.3)',
  },
  starChipSelected: {
    borderColor: theme.colors.accentGold,
  },
  starChipTextSelected: {
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.accentGold,
  },

  // ---- Footer ----
  showResultsButton: {
    height: 52,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showResultsButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 15,
    color: theme.colors.primaryNavy,
  },
});
