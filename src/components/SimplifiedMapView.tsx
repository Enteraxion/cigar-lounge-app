/**
 * SimplifiedMapView
 *
 * Android stand-in for the real `MapView` used by MapScreen.tsx and
 * SearchResultsScreen.tsx (see their TODO(android-maps) comments — there's
 * no Google Maps API key/billing set up for Android yet, so
 * react-native-maps can't render there). Rather than a bare "unavailable"
 * box, this draws a stylized, intentionally-simplified map backdrop (a
 * faint city-block grid over a radial gold glow) and plots real pins for
 * whichever lounges the caller passes in, normalizing each lounge's
 * `coordinates` into the backdrop's bounding box. Pins reuse the exact
 * visual language of the real map's pin (circle + stem, gold/white when
 * selected) and are tappable, calling back into the same selection/
 * navigation behavior the real MapView's markers trigger on each screen.
 *
 * This is explicitly not live map tiles — the small "Simplified Map View"
 * badge in the corner says so — but it's a deliberate, polished view, not
 * a placeholder apology. Once a Maps API key exists, this whole component
 * (and both Android branches that render it) can be removed in favor of
 * the real MapView everywhere.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Cigarette, MapPin as MapPinIcon } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import type { Lounge } from '../services/loungeService';

const GRID_LINE_COUNT = 6;

/** A lounge's fractional (0-1) position within a bounding box, plus the
 * lounge it was computed from. */
type PlottedLounge = {
  lounge: Lounge;
  xFrac: number;
  yFrac: number;
};

/** Computes each lounge's normalized position within the bounding box of
 * every lounge's coordinates. Falls back to centering (0.5) on an axis
 * whose bounding box has zero size (all lounges share a lat or lng), so a
 * single lounge — or lounges in a perfectly straight line — never divides
 * by zero. */
function plotLounges(lounges: Lounge[]): PlottedLounge[] {
  if (lounges.length === 0) {
    return [];
  }
  const lats = lounges.map(l => l.coordinates.lat);
  const lngs = lounges.map(l => l.coordinates.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat;
  const lngRange = maxLng - minLng;

  return lounges.map(lounge => {
    // Latitude increases northward but screen y increases downward, so
    // flip it — otherwise the pin cluster would render upside down
    // relative to how these lounges actually sit on a map.
    const yFrac = latRange === 0 ? 0.5 : 1 - (lounge.coordinates.lat - minLat) / latRange;
    const xFrac = lngRange === 0 ? 0.5 : (lounge.coordinates.lng - minLng) / lngRange;
    return { lounge, xFrac, yFrac };
  });
}

/** The same pin visual as MapScreen.tsx's real `MapView` markers (circle +
 * stem, gold/white highlight when selected), positioned absolutely instead
 * of via a `Marker`'s coordinate. */
function SimplifiedPin({
  lounge,
  selected,
  xFrac,
  yFrac,
  onPress,
}: {
  lounge: Lounge;
  selected: boolean;
  xFrac: number;
  yFrac: number;
  onPress: () => void;
}) {
  return (
    <View
      style={[
        styles.pinPositioner,
        { left: `${xFrac * 100}%`, top: `${yFrac * 100}%` },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        style={styles.pinTouchable}
        onPress={onPress}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={lounge.name}
      >
        <View style={styles.pinWrap}>
          <View style={[styles.pinCircle, selected && styles.pinCircleSelected]}>
            <Cigarette
              size={selected ? 18 : 14}
              color={selected ? theme.colors.primaryBlack : theme.colors.secondarySilver}
            />
          </View>
          <View style={[styles.pinStem, selected && styles.pinStemSelected]} />
        </View>
      </Pressable>
    </View>
  );
}

export type SimplifiedMapViewProps = {
  lounges: Lounge[];
  selectedLoungeId?: string | null;
  onPressLounge: (lounge: Lounge) => void;
};

export default function SimplifiedMapView({
  lounges,
  selectedLoungeId,
  onPressLounge,
}: SimplifiedMapViewProps) {
  const plotted = plotLounges(lounges);
  const gridLines = Array.from({ length: GRID_LINE_COUNT }, (_, i) => (i + 1) / (GRID_LINE_COUNT + 1));

  return (
    <View style={styles.container}>
      {/* ---- Backdrop: radial-ish glow + city-block grid ---- */}
      <LinearGradient
        colors={[withAlpha(theme.colors.accentGold, 0.16), withAlpha(theme.colors.background, 0)]}
        style={styles.glow}
        pointerEvents="none"
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {gridLines.map(frac => (
          <View key={`v-${frac}`} style={[styles.gridLineVertical, { left: `${frac * 100}%` }]} />
        ))}
        {gridLines.map(frac => (
          <View key={`h-${frac}`} style={[styles.gridLineHorizontal, { top: `${frac * 100}%` }]} />
        ))}
      </View>

      {/* ---- Pins ---- */}
      {plotted.map(({ lounge, xFrac, yFrac }) => (
        <SimplifiedPin
          key={lounge.id}
          lounge={lounge}
          selected={lounge.id === selectedLoungeId}
          xFrac={xFrac}
          yFrac={yFrac}
          onPress={() => onPressLounge(lounge)}
        />
      ))}

      {/* ---- Honesty badge ---- */}
      <View style={styles.badge}>
        <MapPinIcon size={10} color={theme.colors.mutedGray} />
        <Text style={styles.badgeText}>Simplified Map View</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: '10%',
    left: '10%',
    width: '80%',
    height: '60%',
    borderRadius: theme.radius.hero,
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.08),
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.08),
  },

  // ---- Pins ----
  pinPositioner: {
    position: 'absolute',
  },
  pinTouchable: {
    // Anchors the pin's stem-tip on the plotted point, matching how a real
    // map Marker anchors — shifted up/left by roughly its own footprint.
    transform: [{ translateX: -18 }, { translateY: -46 }],
    alignItems: 'center',
    padding: theme.spacing.xs,
  },
  pinWrap: {
    alignItems: 'center',
  },
  pinCircle: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: withAlpha(theme.colors.secondarySilver, 0.3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinCircleSelected: {
    width: 52,
    height: 52,
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.white,
    ...theme.shadows.deep,
  },
  pinStem: {
    width: 2,
    height: 10,
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.5),
  },
  pinStemSelected: {
    backgroundColor: theme.colors.white,
    height: 14,
  },

  // ---- Badge ----
  badge: {
    position: 'absolute',
    right: theme.spacing.sm,
    bottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    height: 22,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.background, 0.7),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.secondarySilver, 0.2),
  },
  badgeText: {
    ...theme.typography.caption,
    fontSize: 8,
    color: theme.colors.mutedGray,
  },
});
