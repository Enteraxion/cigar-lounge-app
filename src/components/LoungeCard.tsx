/**
 * LoungeCard
 *
 * Reused for every lounge tile across Home ("Nearby Lounges", "Trending
 * Now") and will be reused again on Search/Map/Saved results. Renders an
 * image with an optional distance badge, an optional favorite heart
 * overlay, name, optional tag line / location, and an optional star
 * rating row. The heart only renders when both `loungeId` and `userId`
 * are given — callers that don't have a signed-in user handy just omit
 * them and get the old distance-badge-only image.
 */

import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import FavoriteButton from './FavoriteButton';

type Props = {
  image: ImageSourcePropType;
  name: string;
  tags?: string;
  location?: string;
  distance?: string;
  rating?: number;
  width?: number;
  loungeId?: string;
  userId?: string;
  favorited?: boolean;
};

export default function LoungeCard({
  image,
  name,
  tags,
  location,
  distance,
  rating,
  width = 220,
  loungeId,
  userId,
  favorited,
}: Props) {
  return (
    <View style={[styles.card, { width }]}>
      <View style={styles.imageWrapper}>
        <Image source={image} style={styles.image} resizeMode="cover" />
        {distance ? (
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceText}>{distance}</Text>
          </View>
        ) : null}
        {loungeId && userId && favorited !== undefined ? (
          <FavoriteButton
            style={styles.favoriteButton}
            userId={userId}
            loungeId={loungeId}
            initialFavorited={favorited}
            size={15}
          />
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {tags ? (
          <Text style={styles.tags} numberOfLines={1}>
            {tags}
          </Text>
        ) : null}
        {location ? (
          <Text style={styles.tags} numberOfLines={1}>
            {location}
          </Text>
        ) : null}
        {rating != null ? (
          <View style={styles.ratingRow}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Star
                key={index}
                size={12}
                color={theme.colors.accentGold}
                fill={
                  index < Math.round(rating) ? theme.colors.accentGold : 'transparent'
                }
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.sm,
  },
  imageWrapper: {
    position: 'relative',
    borderRadius: theme.radius.medium,
    overflow: 'hidden',
    aspectRatio: 4 / 3,
    backgroundColor: theme.colors.surface,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  distanceBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: withAlpha(theme.colors.background, 0.75),
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  distanceText: {
    ...theme.typography.caption,
    color: theme.colors.white,
  },
  favoriteButton: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    width: 28,
    height: 28,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.background, 0.55),
  },
  body: {
    gap: 2,
  },
  name: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.white,
  },
  tags: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
});
