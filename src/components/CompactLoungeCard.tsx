/**
 * CompactLoungeCard
 *
 * Smaller lounge tile used in "Recently Viewed" (Search) and other dense
 * horizontal rails. Distinct from LoungeCard: smaller image, and tags are
 * rendered as chips underneath the copy rather than overlaid on the image.
 */

import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';

type Props = {
  image: ImageSourcePropType;
  name: string;
  location: string;
  tags: string[];
  rating: number;
  width?: number;
};

export default function CompactLoungeCard({
  image,
  name,
  location,
  tags,
  rating,
  width = 168,
}: Props) {
  return (
    <View style={[styles.card, { width }]}>
      <Image source={image} style={styles.image} resizeMode="cover" />

      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.ratingRow}>
          <Star size={11} color={theme.colors.accentGold} fill={theme.colors.accentGold} />
          <Text style={styles.ratingText}>{rating}</Text>
        </View>
      </View>

      <Text style={styles.location} numberOfLines={1}>
        {location}
      </Text>

      <View style={styles.tagRow}>
        {tags.map(tag => (
          <View key={tag} style={styles.tagChip}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.xs,
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.xs,
  },
  name: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
    flexShrink: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.white,
  },
  location: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: 2,
  },
  tagChip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.25),
  },
  tagText: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.secondarySilver,
  },
});
