/**
 * MapScreen
 *
 * Matches design-reference/Map Screen Discover.pdf and Premium Map
 * Alternative.pdf: a full-screen MapView base layer with a floating
 * search bar, filter chips, a weather widget, a Concierge suggestion
 * card, custom lounge pin markers, right-side map controls, and a
 * persistent bottom info card for the selected lounge. Pins are real
 * lounges from Firestore via src/services/loungeService.ts, plotted at
 * their own `coordinates` field. The initial region and the recenter
 * control use real device GPS via useCurrentLocation, falling back to a
 * static default region (src/data/mockMap.ts's `defaultRegion`) if
 * permission is denied or no fix is available yet — see that hook's
 * header comment. Weather widget and Concierge suggestion stay local
 * mock data — neither is modeled in Firestore.
 *
 * PROVIDER_DEFAULT resolves to Apple Maps (MapKit) on iOS, which is what
 * this project actually renders — there's no Google Maps API key or
 * Mapbox SDK set up. Apple Maps doesn't support react-native-maps'
 * `customMapStyle` JSON (that prop is Google-Maps-only); its dark look
 * comes from `userInterfaceStyle="dark"` below, which switches MapKit
 * into its own built-in dark mode.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import {
  Check,
  Cigarette,
  Crosshair,
  Heart,
  Layers,
  List,
  Mic,
  Search as SearchIcon,
  Share2,
  Sparkles,
  Sun,
} from 'lucide-react-native';
import { theme } from '../theme';
import FilterChip from '../components/FilterChip';
import SimplifiedMapView from '../components/SimplifiedMapView';
// TODO(firestore): weather widget and Concierge suggestion aren't
// modeled in Firestore yet — see header comment above.
import { conciergeSuggestion, defaultRegion, mapFilterChips, weatherWidget } from '../data/mockMap';
import { getAllLounges, type Lounge } from '../services/loungeService';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { tabBarClearance } from '../utils/tabBarLayout';
import type { MainTabParamList } from '../navigation/MainNavigator';
import { loungeImageUri } from '../utils/loungeImage';

function MapPin({
  lounge,
  selected,
  onPress,
}: {
  lounge: Lounge;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Marker
      coordinate={{ latitude: lounge.coordinates.lat, longitude: lounge.coordinates.lng }}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <View style={styles.pinWrap}>
        <View style={[styles.pinCircle, selected && styles.pinCircleSelected]}>
          <Cigarette
            size={selected ? 20 : 16}
            color={selected ? theme.colors.primaryNavy : theme.colors.secondarySilver}
          />
        </View>
        <View style={[styles.pinStem, selected && styles.pinStemSelected]} />
      </View>
    </Marker>
  );
}

export default function MapScreen() {
  const tabNavigation = useNavigation<NavigationProp<MainTabParamList>>();
  // Keeps the info card clear of the floating tab bar on every device —
  // see src/utils/tabBarLayout.ts for why this isn't a fixed number.
  const insets = useSafeAreaInsets();
  const infoCardStyle = [styles.infoCard, { bottom: tabBarClearance(insets.bottom) }];
  const mapRef = useRef<MapView>(null);
  const { location } = useCurrentLocation();
  const initialRegion = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: defaultRegion.latitudeDelta,
        longitudeDelta: defaultRegion.longitudeDelta,
      }
    : defaultRegion;
  const [selectedChip, setSelectedChip] = useState('all');
  const [lounges, setLounges] = useState<Lounge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedLoungeId, setSelectedLoungeId] = useState<string | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>('standard');

  const cycleMapType = () => {
    const order: Array<'standard' | 'satellite' | 'hybrid'> = ['standard', 'satellite', 'hybrid'];
    setMapType(prev => order[(order.indexOf(prev) + 1) % order.length]);
  };

  const loadLounges = useCallback(async () => {
    setError(null);
    setLounges(null);
    try {
      const result = await getAllLounges();
      setLounges(result);
      setSelectedLoungeId(result[0]?.id ?? null);
    } catch {
      setError("Couldn't load lounges. Check your connection and try again.");
    }
  }, []);

  useEffect(() => {
    loadLounges();
  }, [loadLounges]);

  // initialRegion only applies at first mount; if the GPS fix resolves
  // after the map has already rendered with the fallback defaultRegion,
  // animate over to the real position once it arrives.
  useEffect(() => {
    if (location) {
      mapRef.current?.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: defaultRegion.latitudeDelta,
          longitudeDelta: defaultRegion.longitudeDelta,
        },
        400,
      );
    }
  }, [location]);

  const selectedLounge = lounges?.find(lounge => lounge.id === selectedLoungeId) ?? null;

  const recenter = () => {
    mapRef.current?.animateToRegion(initialRegion, 400);
  };

  const openVoiceSearch = () => {
    // VoiceSearch is a root-level modal (see AppNavigator) reachable from
    // more than one tab; MainTabParamList doesn't model it, but
    // navigate() bubbles up to the ancestor Stack.Navigator at runtime.
    (tabNavigation.navigate as (name: string, params?: object) => void)('VoiceSearch');
  };

  const openSearch = () => {
    // Cross-tab navigation into the Search stack's live suggestions
    // screen — same Firestore-backed search flow (via searchLounges())
    // that Search Home's search bar opens. Map has no search UI of its
    // own; typing/tapping a suggestion there already lands on
    // SearchResults with real results.
    (tabNavigation.navigate as (name: string, params?: object) => void)('Search', {
      screen: 'LiveSearchSuggestions',
    });
  };

  const openConcierge = () => {
    (tabNavigation.navigate as (name: string, params?: object) => void)('AIConcierge');
  };

  const openListView = () => {
    // Cross-tab navigation into the Search stack's SearchResults screen —
    // same untyped escape-hatch pattern as openSearch/openLoungeDetails
    // above, since MainTabParamList doesn't model the nested Search stack.
    (tabNavigation.navigate as (name: string, params?: object) => void)('Search', {
      screen: 'SearchResults',
    });
  };

  const openLoungeDetails = () => {
    if (!selectedLounge) return;
    // Cross-tab navigation into the Search stack's LoungeDetail screen.
    // MainTabParamList types "Search" as `undefined` (it doesn't model
    // the nested stack), so a plain typed call can't express this;
    // React Navigation supports it fine at runtime.
    (tabNavigation.navigate as (name: string, params?: object) => void)('Search', {
      screen: 'LoungeDetail',
      params: { loungeId: selectedLounge.id },
    });
  };

  const onShare = () => {
    if (!selectedLounge) return;
    Share.share({ message: selectedLounge.name }).catch(() => {});
  };

  return (
    <View style={styles.screen}>
      {Platform.OS === 'android' ? (
        // TODO(android-maps): react-native-maps needs a Google Maps API
        // key on Android (Maps SDK for Android + a billing-enabled GCP
        // project) — not set up yet, so real MapView can't render here.
        // SimplifiedMapView is a stylized stand-in that plots the same
        // real lounges and wires the same selection behavior as the real
        // MapView's markers below. iOS uses Apple Maps via
        // PROVIDER_DEFAULT and needs no key. Once a Maps API key exists,
        // add <meta-data android:name="com.google.android.geo.API_KEY"
        // .../> to AndroidManifest.xml and remove this branch in favor of
        // the real MapView everywhere.
        <View style={StyleSheet.absoluteFill}>
          <SimplifiedMapView
            lounges={lounges ?? []}
            selectedLoungeId={selectedLoungeId}
            onPressLounge={lounge => setSelectedLoungeId(lounge.id)}
          />
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          userInterfaceStyle="dark"
          initialRegion={initialRegion}
          mapType={mapType}
          onPress={() => setSelectedLoungeId(null)}
        >
          {(lounges ?? []).map(lounge => (
            <MapPin
              key={lounge.id}
              lounge={lounge}
              selected={lounge.id === selectedLoungeId}
              onPress={() => setSelectedLoungeId(lounge.id)}
            />
          ))}
        </MapView>
      )}

      <SafeAreaView style={styles.overlay} edges={['top']} pointerEvents="box-none">
        {/* ---------------- Search bar ---------------- */}
        <Pressable style={styles.searchBar} onPress={openSearch}>
          <SearchIcon size={18} color={theme.colors.mutedGray} />
          <Text style={styles.searchPlaceholder} numberOfLines={1}>
            Search lounges, cities or cigar brands
          </Text>
          <Pressable onPress={openVoiceSearch} hitSlop={8}>
            <Mic size={18} color={theme.colors.mutedGray} />
          </Pressable>
        </Pressable>

        {/* ---------------- Filter chips ---------------- */}
        <View style={styles.chipRow}>
          {mapFilterChips.map(chip => (
            // FilterChip's unselected state is transparent, which reads
            // fine over this app's dark screens but disappears over the
            // map's light tiles — an opaque backing keeps it legible here.
            <View key={chip.id} style={styles.chipBacking}>
              <FilterChip
                label={chip.label}
                selected={selectedChip === chip.id}
                onPress={() => setSelectedChip(chip.id)}
              />
            </View>
          ))}
        </View>

        {/* ---------------- Weather widget ---------------- */}
        <View style={styles.weatherCard}>
          <View style={styles.weatherRow}>
            <Sun size={18} color={theme.colors.accentGold} />
            <Text style={styles.weatherTemp}>{weatherWidget.temperature}</Text>
          </View>
          <Text style={styles.weatherMessage}>{weatherWidget.message}</Text>
        </View>

        {/* ---------------- Concierge card ---------------- */}
        <Pressable style={styles.conciergeCard} onPress={openConcierge}>
          <View style={styles.conciergeHeaderRow}>
            <Sparkles size={14} color={theme.colors.white} />
            <Text style={styles.conciergeLabel}>Concierge</Text>
          </View>
          <Text style={styles.conciergeMessage}>{conciergeSuggestion.message}</Text>
        </Pressable>

        {/* ---------------- Map controls ---------------- */}
        <View style={styles.controlsColumn}>
          <Pressable style={styles.controlButton} onPress={cycleMapType} hitSlop={4}>
            <Layers size={18} color={theme.colors.secondarySilver} />
          </Pressable>
          <Pressable style={styles.controlButton} onPress={recenter} hitSlop={4}>
            <Crosshair size={18} color={theme.colors.secondarySilver} />
          </Pressable>
          <Pressable style={styles.controlButton} onPress={openListView} hitSlop={4}>
            <List size={18} color={theme.colors.secondarySilver} />
          </Pressable>
        </View>
      </SafeAreaView>

      {/* ---------------- Bottom info card ---------------- */}
      {lounges === null && !error ? (
        <View style={infoCardStyle}>
          <ActivityIndicator color={theme.colors.secondarySilver} />
        </View>
      ) : error ? (
        <View style={infoCardStyle}>
          <Text style={styles.infoRatingRow}>{error}</Text>
          <Pressable style={styles.viewDetailsButton} onPress={loadLounges}>
            <Text style={styles.viewDetailsText}>Try Again</Text>
          </Pressable>
        </View>
      ) : selectedLounge ? (
        <View style={infoCardStyle}>
          <View style={styles.infoTopRow}>
            <Image source={{ uri: loungeImageUri(selectedLounge) }} style={styles.infoImage} />
            <View style={styles.infoTextGroup}>
              <View style={styles.infoNameRow}>
                <Text style={styles.infoName} numberOfLines={1}>
                  {selectedLounge.name}
                </Text>
                <Pressable onPress={() => setFavorited(prev => !prev)} hitSlop={8}>
                  <Heart
                    size={18}
                    color={favorited ? theme.colors.accentGold : theme.colors.secondarySilver}
                    fill={favorited ? theme.colors.accentGold : 'transparent'}
                  />
                </Pressable>
              </View>
              <Text style={styles.infoRatingRow}>
                ★ {selectedLounge.ratings.overall} • {selectedLounge.address}
              </Text>

              <View style={styles.infoActionRow}>
                <Pressable style={styles.viewDetailsButton} onPress={openLoungeDetails}>
                  <Text style={styles.viewDetailsText}>View Details</Text>
                </Pressable>
                <Pressable style={styles.shareButton} onPress={onShare} hitSlop={8}>
                  <Share2 size={16} color={theme.colors.primaryNavy} />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.amenityRow}>
            {selectedLounge.amenities.map(amenity => (
              <View key={amenity} style={styles.amenityChip}>
                <Check size={12} color={theme.colors.success} />
                <Text style={styles.amenityText}>{amenity}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
  },

  // ---- Search bar ----
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    height: 48,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceNavy,
    ...theme.shadows.soft,
  },
  searchPlaceholder: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.mutedGray,
    flex: 1,
  },

  // ---- Filter chips ----
  chipRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  chipBacking: {
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceNavy,
    ...theme.shadows.soft,
  },

  // ---- Weather ----
  weatherCard: {
    alignSelf: 'flex-end',
    width: 190,
    marginRight: theme.spacing.lg,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    gap: 4,
    ...theme.shadows.soft,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  weatherTemp: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 18,
    color: theme.colors.white,
  },
  weatherMessage: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },

  // ---- Concierge ----
  conciergeCard: {
    alignSelf: 'flex-end',
    width: 190,
    marginRight: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    gap: 4,
    ...theme.shadows.soft,
  },
  conciergeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  conciergeLabel: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.mutedGray,
  },
  conciergeMessage: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.white,
  },

  // ---- Map controls ----
  controlsColumn: {
    position: 'absolute',
    right: theme.spacing.lg,
    top: '46%',
    gap: theme.spacing.sm,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surfaceNavy,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.soft,
  },

  // ---- Pins ----
  pinWrap: {
    alignItems: 'center',
  },
  pinCircle: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceNavy,
    borderWidth: 2,
    borderColor: 'rgba(192, 192, 192, 0.3)',
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
    backgroundColor: 'rgba(192, 192, 192, 0.5)',
  },
  pinStemSelected: {
    backgroundColor: theme.colors.white,
    height: 14,
  },

  // ---- Bottom info card ----
  infoCard: {
    position: 'absolute',
    left: theme.spacing.md,
    right: theme.spacing.md,
    // bottom is applied at render from the safe-area inset — see
    // tabBarClearance; a literal value here collides with the tab bar
    // on devices with a home indicator.
    padding: theme.spacing.md,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceNavy,
    gap: theme.spacing.md,
    ...theme.shadows.deep,
  },
  infoTopRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  infoImage: {
    width: 88,
    height: 110,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.background,
  },
  infoTextGroup: {
    flex: 1,
    gap: 3,
  },
  infoNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  infoName: {
    ...theme.typography.headingSmall,
    fontSize: 17,
    color: theme.colors.white,
    flex: 1,
  },
  infoRatingRow: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.accentGold,
  },
  infoDistance: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.mutedGray,
    marginTop: 2,
  },
  infoActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  viewDetailsButton: {
    flex: 1,
    height: 40,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewDetailsText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.primaryNavy,
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Amenities ----
  amenityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(192, 192, 192, 0.12)',
    paddingTop: theme.spacing.sm,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  amenityText: {
    ...theme.typography.medium,
    fontSize: 11,
    color: theme.colors.secondarySilver,
  },
});
