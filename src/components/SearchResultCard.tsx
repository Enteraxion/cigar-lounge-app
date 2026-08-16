/**
 * SearchResultCard
 *
 * Result-list tile for SearchResultsScreen. Visually distinct from
 * LoungeCard (Home) and CompactLoungeCard (Search Home): full-width hero
 * image with status badge + bookmark + stat pills overlaid, a name row
 * with rating/price tier, an amenity icon row, and two action buttons.
 *
 * Takes a Firestore `Lounge` (src/services/loungeService.ts) rather than
 * the old mockSearchResults.ts shape — there's no live distance/badge
 * data yet, so the distance pill is dropped and the status badge is
 * derived from `lounge.status` instead of a curated badge list.
 */

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bookmark, MapPin, Navigation, Star } from 'lucide-react-native';
import { theme } from '../theme';
import { getAmenityIcon } from '../utils/amenityIcon';
import type { Lounge } from '../services/loungeService';
import FavoriteButton from './FavoriteButton';
import { loungeImageUri } from '../utils/loungeImage';

type Props = {
  result: Lounge;
  userId?: string;
  favorited?: boolean;
  onPressDetails?: () => void;
  onPressDirections?: () => void;
  onPressSave?: () => void;
};

export default function SearchResultCard({
  result,
  userId,
  favorited,
  onPressDetails,
  onPressDirections,
  onPressSave,
}: Props) {
  const isOpen = result.status === 'open';

  return (
    <View style={styles.card}>
      <View style={styles.imageWrapper}>
        <Image source={{ uri: loungeImageUri(result) }} style={styles.image} resizeMode="cover" />

        <View style={styles.badgeRow}>
          <View
            style={[styles.badge, { backgroundColor: isOpen ? theme.colors.success : theme.colors.danger }]}
          >
            <Text style={[styles.badgeText, { color: isOpen ? theme.colors.primaryNavy : theme.colors.white }]}>
              {isOpen ? 'OPEN NOW' : 'CLOSED'}
            </Text>
          </View>
        </View>

        <View style={styles.topRightButtons}>
          {userId && favorited !== undefined ? (
            <FavoriteButton
              style={styles.iconButton}
              userId={userId}
              loungeId={result.id}
              initialFavorited={favorited}
              size={16}
            />
          ) : null}
          <Pressable style={styles.iconButton} onPress={onPressSave} hitSlop={8}>
            <Bookmark size={16} color={theme.colors.white} fill="transparent" />
          </Pressable>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statPill}>
            <Text style={styles.statLabel}>ATMOSPHERE</Text>
            <Text style={styles.statValue}>{result.ratings.atmosphere.toFixed(1)}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statLabel}>BUSINESS</Text>
            <Text style={styles.statValue}>{result.ratings.businessFriendly.toFixed(1)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={2}>
            {result.name}
          </Text>
          <View style={styles.ratingColumn}>
            <View style={styles.ratingRow}>
              <Star size={13} color={theme.colors.accentGold} fill={theme.colors.accentGold} />
              <Text style={styles.ratingText}>{result.ratings.overall}</Text>
            </View>
            <Text style={styles.priceTier}>{result.priceRange}</Text>
          </View>
        </View>

        <View style={styles.locationRow}>
          <MapPin size={13} color={theme.colors.mutedGray} />
          <Text style={styles.locationText} numberOfLines={1}>
            {result.address}
          </Text>
        </View>

        <View style={styles.amenityRow}>
          {result.amenities.slice(0, 6).map(amenity => {
            const Icon = getAmenityIcon(amenity);
            return <Icon key={amenity} size={15} color={theme.colors.secondarySilver} />;
          })}
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.detailsButton} onPress={onPressDetails}>
            <Text style={styles.detailsButtonText}>View Details</Text>
          </Pressable>
          <Pressable style={styles.directionsButton} onPress={onPressDirections}>
            <Navigation size={14} color={theme.colors.white} />
            <Text style={styles.directionsButtonText}>Directions</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    overflow: 'hidden',
    ...theme.shadows.soft,
  },

  // ---- Image ----
  imageWrapper: {
    position: 'relative',
    aspectRatio: 16 / 11,
    backgroundColor: theme.colors.surfaceNavy,
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  badgeRow: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  badgeText: {
    ...theme.typography.caption,
    fontSize: 9,
  },
  topRightButtons: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(5, 10, 24, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRow: {
    position: 'absolute',
    bottom: theme.spacing.sm,
    right: theme.spacing.sm,
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  statPill: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.medium,
    backgroundColor: 'rgba(5, 10, 24, 0.65)',
  },
  statLabel: {
    ...theme.typography.caption,
    fontSize: 7,
    color: theme.colors.secondarySilver,
  },
  statValue: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 13,
    color: theme.colors.white,
  },

  // ---- Body ----
  body: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  name: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 17,
    color: theme.colors.white,
    flex: 1,
  },
  ratingColumn: {
    alignItems: 'flex-end',
    gap: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  priceTier: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  locationText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.mutedGray,
    flex: 1,
  },
  amenityRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },

  // ---- Actions ----
  actionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  detailsButton: {
    flex: 1,
    height: 44,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.primaryNavy,
  },
  directionsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    height: 44,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.25)',
  },
  directionsButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
});
