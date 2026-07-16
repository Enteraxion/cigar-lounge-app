/**
 * FilterReviewsSheet
 *
 * Matches the bottom half of design-reference/Ratings Breakdown & Filter
 * Reviews.pdf: a bottom sheet with Sort By / Verified Visitors / Reviewer
 * Type / Star Rating filters and a sticky "Show Results" footer. Built
 * with RN's built-in Modal — same pattern as FilterBottomSheet and
 * SortBottomSheet. All selection state is local; the result count is a
 * fake estimate that shrinks as more filters are selected, not a real
 * query against the dataset.
 */

import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { CircleCheck } from 'lucide-react-native';
import { theme } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const SORT_OPTIONS = ['Most Helpful', 'Newest', 'Highest Rated'];
const REVIEWER_TYPES = ['Business', 'Locals', 'Travelers'];
const STAR_RATINGS = [5, 4, 3, 2, 1];

const BASE_RESULT_COUNT = 184;

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
      <Text style={[styles.chipText, selected && styles.starChipTextSelected]}>{stars}★</Text>
    </Pressable>
  );
}

export default function FilterReviewsSheet({ visible, onClose }: Props) {
  const [sortBy, setSortBy] = useState('Most Helpful');
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [reviewerType, setReviewerType] = useState<string | null>('Locals');
  const [starRating, setStarRating] = useState<number | null>(5);

  const clearAll = () => {
    setSortBy('Most Helpful');
    setVerifiedOnly(false);
    setReviewerType(null);
    setStarRating(null);
  };

  const activeFilterCount =
    (verifiedOnly ? 1 : 0) + (reviewerType ? 1 : 0) + (starRating ? 1 : 0);
  const resultCount = Math.max(1, BASE_RESULT_COUNT - activeFilterCount * 20);

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
            {SORT_OPTIONS.map(option => (
              <PillChip
                key={option}
                label={option}
                selected={sortBy === option}
                onPress={() => setSortBy(option)}
              />
            ))}
          </View>
        </View>

        {/* ---------------- Verified Visitors ---------------- */}
        <View style={styles.verifiedRow}>
          <View style={styles.verifiedLabelRow}>
            <CircleCheck size={18} color={theme.colors.success} />
            <Text style={styles.verifiedLabel}>Verified Visitors only</Text>
          </View>
          <Switch
            value={verifiedOnly}
            onValueChange={setVerifiedOnly}
            trackColor={{ false: theme.colors.surfaceNavy, true: theme.colors.success }}
            thumbColor={theme.colors.white}
          />
        </View>

        {/* ---------------- Reviewer Type ---------------- */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Reviewer Type</Text>
          <View style={styles.chipRow}>
            {REVIEWER_TYPES.map(type => (
              <PillChip
                key={type}
                label={type}
                selected={reviewerType === type}
                onPress={() => setReviewerType(prev => (prev === type ? null : type))}
              />
            ))}
          </View>
        </View>

        {/* ---------------- Star Rating ---------------- */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Star Rating</Text>
          <View style={styles.chipRow}>
            {STAR_RATINGS.map(stars => (
              <StarChip
                key={stars}
                stars={stars}
                selected={starRating === stars}
                onPress={() => setStarRating(prev => (prev === stars ? null : stars))}
              />
            ))}
          </View>
        </View>

        <Pressable style={styles.showResultsButton} onPress={onClose}>
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

  // ---- Verified visitors toggle ----
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: 'rgba(5, 10, 24, 0.4)',
  },
  verifiedLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  verifiedLabel: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
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
