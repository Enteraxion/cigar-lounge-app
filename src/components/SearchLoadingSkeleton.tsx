/**
 * SearchLoadingSkeleton
 *
 * Matches design-reference/Search Loading States Screen.pdf. Shown in
 * SearchResultsScreen while `displayResults === null` (the initial
 * fetch), replacing the header/toolbar/chip row's plain ActivityIndicator
 * with shimmering placeholder shapes for the results count, a mini map
 * preview, and a couple of result-card silhouettes (the large card
 * mirrors SearchResultCard's own layout — image, badges, title/rating,
 * amenity icons, two action buttons — so the transition into real
 * results doesn't jump around).
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Map as MapIcon } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';

function useShimmer() {
  const value = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value]);

  return value;
}

type BoxProps = { style?: any; opacity: Animated.Value };

function Box({ style, opacity }: BoxProps) {
  return <Animated.View style={[styles.box, style, { opacity }]} />;
}

export default function SearchLoadingSkeleton() {
  const opacity = useShimmer();

  return (
    <View style={styles.container}>
      <Box opacity={opacity} style={styles.resultsCountBar} />

      {/* ---- Mini map preview ---- */}
      <View style={styles.mapCard}>
        <MapIcon size={40} color={theme.colors.surface} />
        <Box opacity={opacity} style={styles.pinDotLarge} />
        <Box opacity={opacity} style={styles.pinDotSmall} />
      </View>

      <Box opacity={opacity} style={styles.sectionTitleBar} />

      {/* ---- Large result card silhouette ---- */}
      <View style={styles.card}>
        <View style={styles.chipRow}>
          <Box opacity={opacity} style={styles.chip} />
          <Box opacity={opacity} style={styles.chip} />
        </View>
        <Box opacity={opacity} style={styles.imageBlock} />
        <Box opacity={opacity} style={styles.titleBar} />
        <Box opacity={opacity} style={styles.subtitleBar} />
        <View style={styles.iconRow}>
          <Box opacity={opacity} style={styles.iconSquare} />
          <Box opacity={opacity} style={styles.iconSquare} />
          <Box opacity={opacity} style={styles.iconSquare} />
        </View>
        <View style={styles.buttonRow}>
          <Box opacity={opacity} style={styles.buttonWide} />
          <Box opacity={opacity} style={styles.buttonNarrow} />
        </View>
      </View>

      <Box opacity={opacity} style={styles.sectionTitleBar} />

      {/* ---- Thumbnail pair ---- */}
      <View style={styles.thumbRow}>
        <View style={styles.thumbCard}>
          <Box opacity={opacity} style={styles.thumbTextBar} />
        </View>
        <View style={styles.thumbCard} />
      </View>

      {/* ---- Full-width list row ---- */}
      <View style={styles.listRow}>
        <Box opacity={opacity} style={styles.listRowImage} />
        <View style={styles.listRowBody}>
          <Box opacity={opacity} style={styles.listRowTitleBar} />
          <Box opacity={opacity} style={styles.listRowSubtitleBar} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 140,
    gap: theme.spacing.lg,
  },

  box: {
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.16),
    borderRadius: theme.radius.small,
  },

  resultsCountBar: {
    width: 140,
    height: 12,
  },

  // ---- Mini map ----
  mapCard: {
    height: 180,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDotLarge: {
    position: 'absolute',
    top: 40,
    left: '30%',
    width: 12,
    height: 12,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentGold,
  },
  pinDotSmall: {
    position: 'absolute',
    bottom: 50,
    right: '25%',
    width: 10,
    height: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentGold,
  },

  sectionTitleBar: {
    width: 160,
    height: 14,
  },

  // ---- Large card ----
  card: {
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  chip: {
    width: 72,
    height: 24,
    borderRadius: theme.radius.full,
  },
  imageBlock: {
    aspectRatio: 16 / 11,
    borderRadius: theme.radius.medium,
  },
  titleBar: {
    width: '70%',
    height: 16,
  },
  subtitleBar: {
    width: '45%',
    height: 12,
  },
  iconRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  iconSquare: {
    width: 20,
    height: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  buttonWide: {
    flex: 1,
    height: 44,
    borderRadius: theme.radius.medium,
  },
  buttonNarrow: {
    flex: 1,
    height: 44,
    borderRadius: theme.radius.medium,
  },

  // ---- Thumbnail pair ----
  thumbRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  thumbCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
    justifyContent: 'flex-end',
    padding: theme.spacing.sm,
  },
  thumbTextBar: {
    width: '70%',
    height: 10,
  },

  // ---- Full-width list row ----
  listRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
  },
  listRowImage: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.medium,
  },
  listRowBody: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  listRowTitleBar: {
    width: '80%',
    height: 14,
  },
  listRowSubtitleBar: {
    width: '55%',
    height: 12,
  },
});
