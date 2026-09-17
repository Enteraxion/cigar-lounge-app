/**
 * `react-native-maps` on the web.
 *
 * The package ships a MapView.web.ts, but it is a stub — it exports neither
 * MAP_TYPES nor AnimatedMapView, which the library's own index re-exports, so
 * the build fails before it reaches a map. This renders the real Google Maps
 * JavaScript API instead, which is the same service the Android app now uses.
 *
 * The three maps in the app (the Map tab, search results, and the Passport's
 * journey map) pass `initialRegion`/`region`, children `<Marker>`s, and a few
 * interaction flags. That is the surface implemented here. Anything else is
 * accepted and ignored rather than crashing, because a missing feature on a map
 * should be a plainer map, not a blank screen.
 *
 * NOTE ON THE KEY: the key we created on 2026-09-15 is restricted to Android
 * apps by package name and signing fingerprint, so it will NOT work here. The
 * web needs its own key, restricted by HTTP referrer to our domain. Set it as
 * VITE_GOOGLE_MAPS_KEY. Without one the map renders as a plain dark panel and
 * the rest of the screen still works.
 */

/// <reference types="google.maps" />
import React, { useEffect, useRef, useState } from 'react';
import { View, type ViewProps } from 'react-native';

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export const PROVIDER_DEFAULT = undefined;
export const PROVIDER_GOOGLE = 'google';
export const MAP_TYPES = {
  STANDARD: 'standard',
  SATELLITE: 'satellite',
  HYBRID: 'hybrid',
  TERRAIN: 'terrain',
  NONE: 'none',
} as const;

const KEY = (import.meta as { env?: Record<string, string> }).env?.VITE_GOOGLE_MAPS_KEY ?? '';

/** Loads the Google Maps script once, however many maps are on the page. */
let loader: Promise<void> | null = null;
function loadMaps(): Promise<void> {
  if (!KEY) {
    return Promise.reject(new Error('VITE_GOOGLE_MAPS_KEY is not set'));
  }
  if (loader) {
    return loader;
  }
  loader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=marker`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  });
  return loader;
}

/** RN describes a viewport as a centre plus deltas; Google uses bounds. */
function boundsFor(region: Region) {
  return {
    north: region.latitude + region.latitudeDelta / 2,
    south: region.latitude - region.latitudeDelta / 2,
    east: region.longitude + region.longitudeDelta / 2,
    west: region.longitude - region.longitudeDelta / 2,
  };
}

type MarkerProps = {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  onPress?: () => void;
  onCalloutPress?: () => void;
  children?: React.ReactNode;
};

/**
 * A marker contributes no DOM of its own — MapView reads these off its
 * children and draws them through the Maps API.
 */
export function Marker(_props: MarkerProps) {
  return null;
}

export function Callout({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

type MapViewProps = ViewProps & {
  initialRegion?: Region;
  region?: Region;
  mapType?: string;
  onPress?: () => void;
  onRegionChangeComplete?: (region: Region) => void;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  children?: React.ReactNode;
};

function MapViewImpl(
  { initialRegion, region, mapType, onPress, onRegionChangeComplete, scrollEnabled, zoomEnabled, style, children }: MapViewProps,
  ref: React.Ref<unknown>,
) {
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);
  const [failed, setFailed] = useState(false);

  React.useImperativeHandle(ref, () => ({
    animateCamera: (camera: { center: { latitude: number; longitude: number } }) => {
      map.current?.panTo({ lat: camera.center.latitude, lng: camera.center.longitude });
    },
    animateToRegion: (next: Region) => {
      map.current?.fitBounds(boundsFor(next));
    },
  }));

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !host.current) return;
        const start = region ?? initialRegion;
        map.current = new google.maps.Map(host.current, {
          center: start ? { lat: start.latitude, lng: start.longitude } : { lat: 39.8, lng: -98.6 },
          zoom: 12,
          disableDefaultUI: true,
          gestureHandling: scrollEnabled === false ? 'none' : 'greedy',
          // Matches the app's black ground; without it the map is bright white
          // inside a dark page, which is the exact problem iOS still has.
          styles: DARK_STYLE,
        });
        if (start) {
          map.current.fitBounds(boundsFor(start));
        }
        if (onPress) {
          map.current.addListener('click', onPress);
        }
        if (onRegionChangeComplete) {
          map.current.addListener('idle', () => {
            const c = map.current?.getCenter();
            const b = map.current?.getBounds();
            if (!c || !b) return;
            onRegionChangeComplete({
              latitude: c.lat(),
              longitude: c.lng(),
              latitudeDelta: b.toJSON().north - b.toJSON().south,
              longitudeDelta: b.toJSON().east - b.toJSON().west,
            });
          });
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // Deliberately once: the map instance outlives prop changes, which are
    // applied through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw markers whenever the children change.
  useEffect(() => {
    if (!map.current) return;
    for (const m of markers.current) m.setMap(null);
    markers.current = [];
    React.Children.forEach(children, child => {
      if (!React.isValidElement<MarkerProps>(child) || !child.props?.coordinate) return;
      const { coordinate, title, onPress: press, onCalloutPress } = child.props;
      const marker = new google.maps.Marker({
        position: { lat: coordinate.latitude, lng: coordinate.longitude },
        map: map.current ?? undefined,
        title,
      });
      const handler = press ?? onCalloutPress;
      if (handler) marker.addListener('click', handler);
      markers.current.push(marker);
    });
  }, [children]);

  useEffect(() => {
    if (map.current && region) {
      map.current.fitBounds(boundsFor(region));
    }
  }, [region?.latitude, region?.longitude, region?.latitudeDelta]);

  useEffect(() => {
    if (map.current && mapType) {
      map.current.setMapTypeId(mapType === 'standard' ? 'roadmap' : mapType);
    }
  }, [mapType]);

  return (
    <View style={style}>
      <div
        ref={host}
        style={{ width: '100%', height: '100%', background: '#0a0a0c' }}
        aria-label={failed ? 'Map unavailable' : 'Map'}
      />
    </View>
  );
}

/** Dark map styling, so the map matches the app rather than fighting it. */
const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#18181c' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0c' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a92' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a30' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e12' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

const MapView = React.forwardRef(MapViewImpl);
export default MapView;
export const AnimatedMapView = MapView;
