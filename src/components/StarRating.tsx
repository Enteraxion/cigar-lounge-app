/**
 * StarRating
 *
 * A row of stars — either a read-only display (review cards, summary
 * headers) or a tappable selector (Write Review's overall + per-category
 * ratings). Reused across the Reviews list and Write Review form.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { theme } from '../theme';

type Props = {
  rating: number;
  onChange?: (value: number) => void;
  size?: number;
  color?: string;
  count?: number;
};

export default function StarRating({
  rating,
  onChange,
  size = 14,
  color = theme.colors.accentGold,
  count = 5,
}: Props) {
  const interactive = !!onChange;
  const filledCount = Math.round(rating);

  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, index) => {
        const star = (
          <Star
            key={index}
            size={size}
            color={color}
            fill={index < filledCount ? color : 'transparent'}
          />
        );
        if (!interactive) {
          return star;
        }
        return (
          <Pressable key={index} onPress={() => onChange?.(index + 1)} hitSlop={4}>
            {star}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 3,
  },
});
