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
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
  Sun,
} from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import { useMarkerTracking } from '../utils/mapMarker';
import FilterChip from '../components/FilterChip';
// TODO: the Concierge suggestion is still a fixed string — see the header.
// The weather widget is real now (weatherService + patioWeather).
import {
  defaultRegion,
  LOCATED_ZOOM_DELTA,
  mapFilterChips,
} from '../data/mockMap';
import { getCurrentConditions } from '../services/weatherService';
import {
  formatTemperature,
  patioVerdict,
  type PatioConditions,
} from '../utils/patioWeather';
import { getLoungesNear, type Lounge } from '../services/loungeService';
import { nearbyCacheKey, radiusForViewport } from '../utils/geoQuery';
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
  // Redraws when the pin changes size and colour on selection — see the hook.
  const tracksViewChanges = useMarkerTracking(selected);

  return (
    <Marker
      coordinate={{ latitude: lounge.coordinates.lat, longitude: lounge.coordinates.lng }}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
    >
      <View style={styles.pinWrap}>
        <View style={[styles.pinCircle, selected && styles.pinCircleSelected]}>
          <Cigarette
            size={selected ? 20 : 16}
            color={selected ? theme.colors.primaryBlack : theme.colors.secondarySilver}
          />
        </View>
        <View style={[styles.pinStem, selected && styles.pinStemSelected]} />
      </View>
    </Marker>
  );
}

/**
 * Hard ceiling on rendered markers.
 *
 * react-native-maps mounts a native view per Marker, and these are custom
 * markers with children — 8,294 of them, which is what the screen used to
 * ask for, is seconds of work before the map responds to a touch. 150 is
 * more pins than are legible on a phone screen anyway, and getLoungesNear
 * returns them nearest-first, so the ones dropped are always the furthest.
 */
const MAX_PINS = 150;

/**
 * Zoom for "take me to where I am" — roughly a neighbourhood, matching the
 * scale LOCATED_ZOOM_DELTA gives the region API.
 */
const LOCATED_ZOOM_LEVEL = 12;

export default function MapScreen() {
  const tabNavigation = useNavigation<NavigationProp<MainTabParamList>>();
  // Keeps the info card clear of the floating tab bar on every device —
  // see src/utils/tabBarLayout.ts for why this isn't a fixed number.
  const insets = useSafeAreaInsets();
  const infoCardStyle = [styles.infoCard, { bottom: tabBarClearance(insets.bottom) }];
  const mapRef = useRef<MapView>(null);
  const { location, settled: locationSettled } = useCurrentLocation();
  const initialRegion = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: LOCATED_ZOOM_DELTA,
        longitudeDelta: LOCATED_ZOOM_DELTA,
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

  /**
   * What the map is currently looking at, which is what decides which pins to
   * load. Seeded from the initial region and updated when a pan or zoom
   * settles — `onRegionChangeComplete`, not `onRegionChange`, so this runs
   * once per gesture rather than once per frame.
   */
  const [viewport, setViewport] = useState({
    lat: initialRegion.latitude,
    lng: initialRegion.longitude,
    latitudeDelta: initialRegion.latitudeDelta,
  });

  const radiusMiles = radiusForViewport(viewport.latitudeDelta);

  /**
   * Which query is the current one. Guards against an out-of-order response.
   *
   * This is the whole fix for a bug that kept coming back: the map animated to
   * the member's city while the card underneath showed "NVY Bar & Cigar Lounge,
   * Kearney NE" — a lounge next to defaultRegion, the geographic centre of the
   * United States.
   *
   * Two effects fire on the render where the GPS fix lands. The one watching
   * `locationSettled` is declared first, so it runs first — with `loadLounges`
   * still memoised on the OLD viewport, i.e. Kansas at latitudeDelta 30. The one
   * watching `location` then moves the viewport to the member's city and a
   * second query goes out. Both are in flight at once, and the Kansas one covers
   * a 30-degree span so it returns far more documents and often finishes LAST —
   * overwriting the correct result.
   *
   * Previous attempts treated this as a viewport-tracking problem (setViewport
   * alongside animateToRegion, rather than waiting for onRegionChangeComplete).
   * That was a real fix for a real thing, and it is why the map itself ends up in
   * the right place — but it could not help the card, because nothing stopped a
   * stale response from landing after a fresh one.
   */
  const requestRef = useRef(0);

  /**
   * Real conditions for wherever the map is looking, or null when there are
   * none to be had — outside the US, or offline. Null hides the card entirely.
   */
  const [weather, setWeather] = useState<PatioConditions | null>(null);

  const loadLounges = useCallback(async () => {
    const token = ++requestRef.current;
    setError(null);
    try {
      // Scoped to the viewport. This screen used to load every lounge in the
      // country — 8,294 documents — and then render a Marker for each one,
      // which is what made the Map tab take seconds to become interactive.
      // MAX_PINS caps the render even in the densest metro; the query itself
      // widens with zoom (see radiusForViewport) so zooming out still fills
      // the map instead of leaving it suspiciously empty.
      const result = await getLoungesNear(
        { lat: viewport.lat, lng: viewport.lng },
        radiusMiles,
        MAX_PINS,
      );
      if (token !== requestRef.current) {
        // A newer query went out while this one was in flight. Dropping it is the
        // point: applying it would put pins and a card from somewhere the member
        // is not on top of a map showing where they are.
        return;
      }
      setLounges(result);
      setSelectedLoungeId(previous =>
        previous && result.some(lounge => lounge.id === previous) ? previous : result[0]?.id ?? null,
      );
    } catch {
      if (token !== requestRef.current) {
        return;
      }
      setError("Couldn't load lounges. Check your connection and try again.");
    }
  }, [viewport.lat, viewport.lng, radiusMiles]);

  // Waits for the location to settle before the first query, for the same
  // reason HomeScreen does. Without it the map fetched against the static
  // fallback region on mount and rendered pins — and a selected-lounge card —
  // for the middle of the country, then corrected itself once the GPS fix
  // arrived. The wrong state was brief but plainly visible: a lounge in
  // Nebraska captioned under a map of San Francisco.
  //
  // Does not blank `lounges` on a refetch: panning the map should not make
  // every pin vanish and reappear. Repeat queries for a nearby centre are
  // served from cache (see loungeService), so this is cheap.
  useEffect(() => {
    if (!locationSettled) {
      return;
    }
    loadLounges();
  }, [locationSettled, loadLounges]);

  // Follows the viewport, so panning to another city reports that city's weather
  // rather than the member's. Cached for half an hour per ~1km square, so a pan
  // is not a request. Same stale-response guard as the lounges: a slow reply for
  // somewhere the map has left must not overwrite a fresh one.
  useEffect(() => {
    if (!locationSettled) {
      return;
    }
    let current = true;
    getCurrentConditions(viewport.lat, viewport.lng)
      .then(result => {
        if (current) {
          setWeather(result);
        }
      })
      .catch(() => {
        if (current) {
          setWeather(null);
        }
      });
    return () => {
      current = false;
    };
  }, [locationSettled, viewport.lat, viewport.lng]);

  // initialRegion only applies at first mount; if the GPS fix resolves
  // after the map has already rendered with the fallback defaultRegion,
  // animate over to the real position once it arrives.
  //
  // Sets `viewport` here as well as animating, rather than waiting for
  // onRegionChangeComplete to report the move. A programmatic
  // animateToRegion does not reliably fire that callback on Apple Maps, and
  // when it didn't, the pins and the selected-lounge card stayed with the
  // region the map had *left*: observed showing "NVY Bar & Cigar Lounge,
  // Kearney NE" while the map itself had animated to San Francisco. The
  // destination is already known here, so there is no reason to learn it
  // second-hand from the map.
  useEffect(() => {
    if (!location) {
      return;
    }
    mapRef.current?.animateToRegion(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: LOCATED_ZOOM_DELTA,
        longitudeDelta: LOCATED_ZOOM_DELTA,
      },
      400,
    );
    setViewport({
      lat: location.latitude,
      lng: location.longitude,
      latitudeDelta: LOCATED_ZOOM_DELTA,
    });
  }, [location]);

  const selectedLounge = lounges?.find(lounge => lounge.id === selectedLoungeId) ?? null;

  /**
   * Back to where the member is.
   *
   * This animated to `initialRegion`, which is only the member's position if
   * the GPS fix had already resolved when the screen first mounted — otherwise
   * it is a static fallback somewhere in the US. So a crosshair, the universal
   * "show me where I am", could quietly take you to a default region, or
   * appear to do nothing at all if the map was already near it. Rohith reported
   * it as simply not working (2026-09-13).
   *
   * It reads the live location now. With no fix at all there is nothing honest
   * to centre on, so it says so rather than moving the map somewhere arbitrary
   * and letting the member believe that is where they are.
   */
  const recenter = () => {
    if (!location) {
      Alert.alert(
        'Location unavailable',
        "We can't tell where you are. Allow location access in Settings to centre the map on you.",
      );
      return;
    }
    /**
     * animateCamera, not animateToRegion.
     *
     * `animateToRegion` is the older API and on iOS with Apple Maps it fails
     * silently often enough to be untrustworthy — no error, no movement, which
     * is how this button came to look dead after the location fix (Rohith,
     * 2026-09-13). `animateCamera` is the current API and does the same job.
     *
     * The region call stays as a fallback: if the camera API is unavailable on
     * whatever version is installed, moving the old way beats not moving.
     */
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const center = { latitude: location.latitude, longitude: location.longitude };
    if (typeof map.animateCamera === 'function') {
      map.animateCamera({ center, zoom: LOCATED_ZOOM_LEVEL }, { duration: 400 });
    } else {
      map.animateToRegion(
        {
          ...center,
          latitudeDelta: LOCATED_ZOOM_DELTA,
          longitudeDelta: LOCATED_ZOOM_DELTA,
        },
        400,
      );
    }
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
      {/* Real map on both platforms since 2026-09-15. Android drew a
          stand-in — SimplifiedMapView, pins on a grid with no streets —
          because there was no Maps SDK for Android key. There is one now, and
          PROVIDER_DEFAULT resolves to Apple Maps on iOS and Google Maps on
          Android, so one MapView serves both. */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        userInterfaceStyle="dark"
        initialRegion={initialRegion}
        mapType={mapType}
        onPress={() => setSelectedLoungeId(null)}
        onRegionChangeComplete={region => {
          // Reuses the data cache key as the "has this meaningfully moved?"
          // test, so the threshold for refetching is exactly the
          // granularity at which the answer could differ. Returning the
          // existing object makes React bail out of the render entirely,
          // which is what keeps a long pan from re-rendering 150 markers
          // on every gesture.
          const next = {
            lat: region.latitude,
            lng: region.longitude,
            latitudeDelta: region.latitudeDelta,
          };
          const keyOf = (v: typeof next) =>
            nearbyCacheKey({ lat: v.lat, lng: v.lng }, radiusForViewport(v.latitudeDelta));
          setViewport(current => (keyOf(current) === keyOf(next) ? current : next));
        }}
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

        {/* ---------------- Weather ---------------- */}
        {/* Rendered only when there is a real reading. This card used to show a
            fixed "72° — Perfect weather for patio smoking" to everyone, always;
            the temperature was invented and the recommendation was made without
            knowing anything. Outside the US api.weather.gov has no data, and no
            card is the honest answer. */}
        {weather ? (
          <View style={styles.weatherCard}>
            <View style={styles.weatherRow}>
              <Sun size={18} color={theme.colors.accentGold} />
              <Text style={styles.weatherTemp}>{formatTemperature(weather.temperatureF)}</Text>
            </View>
            <Text style={styles.weatherMessage}>{patioVerdict(weather).message}</Text>
            <Text style={styles.weatherSource}>{weather.shortForecast} · NWS</Text>
          </View>
        ) : null}

        {/* The Concierge card is not rendered, and this is its only entry point
            in the whole app — so hiding it here takes the entire Concierge stack
            (Home, Inspiration, Results, Saved Conversations, Trip Planner) out of
            reach.
            
            Removed on 2026-08-24 for the App Store submission. askConcierge is
            deployed and grounded, but ANTHROPIC_API_KEY is still a placeholder, so
            the live function answers "The concierge isn't switched on yet — it's
            built and waiting on an API key". That degrades honestly, which is the
            right behaviour and the wrong thing for a reviewer to read: Apple
            guideline 2.1 rejects apps with placeholder or incomplete features, and
            this was one tap from the Map tab.
            
            The card's text was a fixed string anyway ("Looking for a mild Robusto
            nearby?"), not a real suggestion. Put this back the day the key lands —
            nothing else was removed. */}

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
                  <Share2 size={16} color={theme.colors.primaryBlack} />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.amenityRow}>
            {(selectedLounge.amenities ?? []).map(amenity => (
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
    backgroundColor: theme.colors.surface,
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
    backgroundColor: theme.colors.surface,
    ...theme.shadows.soft,
  },

  // ---- Weather ----
  // Named so a member can tell where the number came from — and so it is
  // obvious at a glance that it is no longer a hardcoded string.
  weatherSource: {
    ...theme.typography.medium,
    fontSize: 10,
    color: theme.colors.mutedGray,
    marginTop: 2,
  },
  weatherCard: {
    alignSelf: 'flex-end',
    width: 190,
    marginRight: theme.spacing.lg,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
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
    backgroundColor: theme.colors.surface,
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
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: withAlpha(theme.colors.accentGold, 0.3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinCircleSelected: {
    width: 52,
    height: 52,
    backgroundColor: theme.colors.accentGold,
    borderColor: theme.colors.white,
    ...theme.shadows.deep,
  },
  pinStem: {
    width: 2,
    height: 10,
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.5),
  },
  pinStemSelected: {
    backgroundColor: theme.colors.accentGold,
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
    backgroundColor: theme.colors.surface,
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
    backgroundColor: theme.colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewDetailsText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.primaryBlack,
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Amenities ----
  amenityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: withAlpha(theme.colors.secondarySilver, 0.12),
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
