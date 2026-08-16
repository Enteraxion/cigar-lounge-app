/**
 * JourneyMap
 *
 * Replaces PassportScreen's old "Journey Map" section, which was a
 * stylized dot-scatter graphic plotted from mock src/data/mockPassport.ts
 * coordinates (bug reported by Julian Brinkley on TestFlight: "The
 * Journey map should have an actual map"). This is a real, embedded
 * MapView (same react-native-maps setup as MapScreen.tsx — PROVIDER_DEFAULT,
 * SimplifiedMapView fallback on Android since there's no Maps API key
 * there yet) showing pins for the lounges the member has actually
 * visited — see src/utils/passport.ts for why a review counts as a visit.
 * Favorites are the fallback when there are no visits yet, so a member
 * who has saved places but not reviewed any still gets a real map.
 *
 * Non-interactive (scroll/zoom/rotate disabled) since it's embedded
 * inside PassportScreen's outer ScrollView — a small preview, not the
 * full Map tab. Tapping a pin still navigates to that lounge's detail
 * page, same as the real Map tab.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { Cigarette, MapPin } from 'lucide-react-native';
import { theme } from '../theme';
import SimplifiedMapView from './SimplifiedMapView';
import { auth } from '../services/firebaseAuth';
import { getUserFavorites } from '../services/userActionsService';
import { getPassport } from '../services/passportService';
import type { Lounge } from '../services/loungeService';
import type { MainTabParamList } from '../navigation/MainNavigator';

const MIN_DELTA = 0.05;
const PADDING_FACTOR = 1.6;

function regionForLounges(lounges: Lounge[]) {
  const lats = lounges.map(l => l.coordinates.lat);
  const lngs = lounges.map(l => l.coordinates.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * PADDING_FACTOR, MIN_DELTA),
    longitudeDelta: Math.max((maxLng - minLng) * PADDING_FACTOR, MIN_DELTA),
  };
}

export default function JourneyMap() {
  const tabNavigation = useNavigation<NavigationProp<MainTabParamList>>();
  const userId = auth.currentUser?.uid;
  const [loading, setLoading] = useState(true);
  const [lounges, setLounges] = useState<Lounge[]>([]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    getPassport(userId)
      .then(({ visitedLounges }) =>
        // Somewhere you've been beats somewhere you saved, but a member
        // with favorites and no reviews yet still gets a populated map
        // rather than an empty one.
        visitedLounges.length > 0 ? visitedLounges : getUserFavorites(userId),
      )
      .then(setLounges)
      .catch(() => setLounges([]))
      .finally(() => setLoading(false));
  }, [userId]);

  const openLounge = (loungeId: string) => {
    (tabNavigation.navigate as (name: string, params?: object) => void)('Search', {
      screen: 'LoungeDetail',
      params: { loungeId },
    });
  };

  // Pan/zoom are disabled (this map sits inside PassportScreen's outer
  // ScrollView), so tapping the map background — anywhere that isn't a
  // pin — opens the real, fully-interactive Map tab instead of doing
  // nothing (previously only the pin icon itself responded to a tap).
  const openMapTab = () => tabNavigation.navigate('Map');

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={theme.colors.secondarySilver} />
      </View>
    );
  }

  if (lounges.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <MapPin size={22} color={theme.colors.mutedGray} />
        <Text style={styles.emptyText}>Review a lounge you've visited to start your journey map.</Text>
      </View>
    );
  }

  if (Platform.OS === 'android') {
    return (
      <Pressable style={styles.container} onPress={openMapTab}>
        <SimplifiedMapView
          lounges={lounges}
          onPressLounge={lounge => openLounge(lounge.id)}
        />
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        userInterfaceStyle="dark"
        initialRegion={regionForLounges(lounges)}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onPress={openMapTab}
      >
        {lounges.map(lounge => (
          <Marker
            key={lounge.id}
            coordinate={{ latitude: lounge.coordinates.lat, longitude: lounge.coordinates.lng }}
            onPress={() => openLounge(lounge.id)}
            tracksViewChanges={false}
          >
            <View style={styles.pinWrap}>
              <View style={styles.pinCircle}>
                <Cigarette size={14} color={theme.colors.secondarySilver} />
              </View>
              <View style={styles.pinStem} />
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 180,
    borderRadius: theme.radius.large,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.12)',
    backgroundColor: theme.colors.surfaceNavy,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyText: {
    ...theme.typography.body,
    fontSize: 13,
    color: theme.colors.mutedGray,
    textAlign: 'center',
  },
  pinWrap: {
    alignItems: 'center',
  },
  pinCircle: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceNavy,
    borderWidth: 2,
    borderColor: 'rgba(192, 192, 192, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinStem: {
    width: 2,
    height: 8,
    backgroundColor: 'rgba(192, 192, 192, 0.5)',
  },
});
