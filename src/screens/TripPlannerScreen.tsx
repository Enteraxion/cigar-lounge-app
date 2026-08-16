/**
 * TripPlannerScreen
 *
 * Matches design-reference/Trip Planner & Saved Conversations.pdf (top
 * half): route details (starting/destination inputs, travel date + stop
 * frequency fields), a multi-select preferences chip row, a "Generate
 * Itinerary" button, and a numbered list of route stops — some with an
 * embedded mini lounge card. Reached from the "Plan a Trip" entry point
 * on ConciergeHomeScreen. Mock data only (see
 * src/utils/routePlanner.ts). Real: type a start and a destination city
 * and it finds the lounges that actually sit near the line between them,
 * ordered along the journey, each opening the real reservation flow.
 *
 * The corridor is a straight-line approximation rather than a driving
 * route — that needs a paid directions API — so the copy says "on your
 * route" and "miles from start" instead of quoting drive times it can't
 * know. See routePlanner.ts for the full reasoning.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Calendar, ChevronDown, ChevronLeft, History, MapPin, Navigation } from 'lucide-react-native';
import { theme } from '../theme';
import { conciergeUser } from '../data/mockConcierge';
import { defaultSelectedPreferenceIds, preferenceOptions } from '../data/mockTripPlanner';
import { getAllLounges } from '../services/loungeService';
import { findCityCoordinates } from '../utils/cityAutocomplete';
import { planRoute, preferenceMatch, type RoutePlan, type RouteStop } from '../utils/routePlanner';
import { displayTags } from '../utils/displayTags';
import type { ConciergeStackParamList } from '../navigation/ConciergeNavigator';
import type { MainTabParamList } from '../navigation/MainNavigator';
import { loungeImageUri } from '../utils/loungeImage';

type ConciergeNavigationProp = NativeStackNavigationProp<ConciergeStackParamList>;

/** Next 30 days — a trip you're planning is a trip you take soon. */
const UPCOMING_DAYS: Date[] = Array.from({ length: 30 }, (_, index) => {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() + index);
  return day;
});

function RouteStopCard({
  stop,
  order,
  match,
  onReserve,
}: {
  stop: RouteStop;
  order: number;
  match: number | null;
  onReserve: () => void;
}) {
  const { lounge } = stop;
  return (
    <View style={styles.stopCard}>
      <View style={styles.stopHeaderRow}>
        <View style={styles.stopBadge}>
          <Text style={styles.stopBadgeText}>{order}</Text>
        </View>
        <View style={styles.stopTextGroup}>
          <Text style={styles.stopName}>{lounge.city ?? lounge.address}</Text>
          {/* Miles along the route, not an ETA — we have coordinates, not
              drive times, and inventing an arrival time would be fiction. */}
          <Text style={styles.stopMeta}>
            {stop.milesFromStart} mi from start
            {stop.detourMiles > 1 ? ` • ${stop.detourMiles} mi off route` : ' • on your route'}
            {match !== null ? ` • ${match}% match` : ''}
          </Text>
        </View>
      </View>

      <Pressable style={styles.loungeCard} onPress={onReserve}>
        <Image source={{ uri: loungeImageUri(lounge) }} style={styles.loungeImage} />
        <View style={styles.loungeTextGroup}>
          <Text style={styles.loungeName} numberOfLines={1}>
            {lounge.name}
          </Text>
          <Text style={styles.loungeLocation} numberOfLines={1}>
            {displayTags(lounge.tags).slice(0, 2).join(' • ') || lounge.address}
          </Text>
        </View>
        <View style={styles.reserveButton}>
          <Text style={styles.reserveButtonText}>Reserve</Text>
        </View>
      </Pressable>
    </View>
  );
}

export default function TripPlannerScreen() {
  const navigation = useNavigation<ConciergeNavigationProp>();
  const tabNavigation = useNavigation<NavigationProp<MainTabParamList>>();
  // Empty rather than a prefilled London → Edinburgh trip nobody asked for.
  const [starting, setStarting] = useState('');
  const [destination, setDestination] = useState('');
  const [travelDate, setTravelDate] = useState<Date | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [maxStops, setMaxStops] = useState(6);
  const [selectedPreferences, setSelectedPreferences] = useState<Set<string>>(
    new Set(defaultSelectedPreferenceIds),
  );
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const preferenceLabels = preferenceOptions
    .filter(option => selectedPreferences.has(option.id))
    .map(option => option.label);

  const generateItinerary = async () => {
    const from = findCityCoordinates(starting);
    const to = findCityCoordinates(destination);
    if (!from || !to) {
      // Naming which end failed saves the member guessing which of the two
      // city names we didn't recognise.
      setPlanError(
        !from
          ? `We don't recognise "${starting.trim() || 'that start'}" as a city.`
          : `We don't recognise "${destination.trim() || 'that destination'}" as a city.`,
      );
      setPlan(null);
      return;
    }
    setPlanning(true);
    setPlanError(null);
    try {
      const lounges = await getAllLounges();
      const next = planRoute(from, to, lounges, maxStops);
      setPlan(next);
      if (next.stops.length === 0) {
        setPlanError('No lounges on that route yet. Try two larger cities.');
      }
    } catch {
      setPlanError("Couldn't build your itinerary. Check your connection and try again.");
      setPlan(null);
    } finally {
      setPlanning(false);
    }
  };

  const togglePreference = (id: string) => {
    setSelectedPreferences(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ---------------- Header ---------------- */}
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={() => navigation.goBack()} hitSlop={8}>
            <ChevronLeft size={20} color={theme.colors.white} />
          </Pressable>
          <Image source={{ uri: conciergeUser.avatarUri }} style={styles.avatar} />
          <View style={styles.headerTextGroup}>
            <Text style={styles.headerCaption}>Experience</Text>
            <Text style={styles.headerTitle}>Trip Planner</Text>
          </View>
          <Pressable
            style={styles.headerButton}
            onPress={() => navigation.navigate('SavedConversations')}
            hitSlop={8}
          >
            <History size={18} color={theme.colors.secondarySilver} />
          </Pressable>
        </View>

        {/* ---------------- Route Details ---------------- */}
        <View style={styles.field}>
          <Text style={styles.sectionLabel}>Route Details</Text>

          <View style={styles.inputRow}>
            <Navigation size={16} color={theme.colors.accentGold} />
            <Text style={styles.inputPrefix}>Starting:</Text>
            <TextInput
              style={styles.input}
              value={starting}
              onChangeText={setStarting}
              placeholderTextColor={theme.colors.mutedGray}
            />
          </View>

          <View style={styles.inputRow}>
            <MapPin size={16} color={theme.colors.accentGold} />
            <Text style={styles.inputPrefix}>Destination:</Text>
            <TextInput
              style={styles.input}
              value={destination}
              onChangeText={setDestination}
              placeholderTextColor={theme.colors.mutedGray}
            />
          </View>

          <View style={styles.sideBySideRow}>
            <Pressable
              style={styles.sideField}
              onPress={() => setDatePickerOpen(true)}
            >
              <Text style={styles.sideFieldLabel}>Travel Date</Text>
              <View style={styles.sideFieldValueRow}>
                <Calendar size={14} color={theme.colors.secondarySilver} />
                <Text style={styles.sideFieldValue}>
                  {travelDate
                    ? travelDate.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Pick a date'}
                </Text>
              </View>
            </Pressable>
            <Pressable
              style={styles.sideField}
              onPress={() => setMaxStops(current => (current >= 10 ? 4 : current + 2))}
            >
              <Text style={styles.sideFieldLabel}>Stop Frequency</Text>
              <View style={styles.sideFieldValueRow}>
                <Text style={styles.sideFieldValue}>{maxStops} stops</Text>
                <ChevronDown size={14} color={theme.colors.secondarySilver} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* ---------------- Preferences ---------------- */}
        <View style={styles.field}>
          <Text style={styles.sectionLabel}>Preferences</Text>
          <View style={styles.chipWrap}>
            {preferenceOptions.map(option => {
              const selected = selectedPreferences.has(option.id);
              return (
                <Pressable
                  key={option.id}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => togglePreference(option.id)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ---------------- Generate Itinerary ---------------- */}
        <Pressable
          style={styles.generateButton}
          onPress={generateItinerary}
          disabled={planning}
        >
          {planning ? (
            <ActivityIndicator color={theme.colors.primaryNavy} />
          ) : (
            <Text style={styles.generateButtonText}>Generate Itinerary</Text>
          )}
        </Pressable>

        {planError ? <Text style={styles.planError}>{planError}</Text> : null}
        {plan && plan.stops.length > 0 ? (
          <Text style={styles.planSummary}>
            {plan.stops.length} {plan.stops.length === 1 ? 'stop' : 'stops'} over{' '}
            {plan.totalMiles.toLocaleString()} miles
            {travelDate
              ? ` on ${travelDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
              : ''}
          </Text>
        ) : null}

        {/* ---------------- Route Stops ---------------- */}
        <View style={[styles.field, styles.lastField]}>
          <Text style={styles.sectionTitle}>Your Route Stops</Text>
          <View style={styles.stopList}>
            {(plan?.stops ?? []).map((stop: RouteStop, index: number) => (
              <RouteStopCard
                key={stop.lounge.id}
                stop={stop}
                order={index + 1}
                match={preferenceMatch(stop.lounge, preferenceLabels)}
                onReserve={() =>
                  (tabNavigation.navigate as (n: string, p?: object) => void)('Search', {
                    screen: 'ReserveTable',
                    params: { loungeId: stop.lounge.id, loungeName: stop.lounge.name },
                  })
                }
              />
            ))}
          </View>
        </View>
      </ScrollView>
      <Modal
        visible={datePickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDatePickerOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setDatePickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={event => event.stopPropagation()}>
            <Text style={styles.sheetTitle}>Travel date</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {UPCOMING_DAYS.map(day => (
                <Pressable
                  key={day.toISOString()}
                  style={styles.sheetRow}
                  onPress={() => {
                    setTravelDate(day);
                    setDatePickerOpen(false);
                  }}
                >
                  <Text style={styles.sheetRowText}>
                    {day.toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: 120,
    gap: theme.spacing.xl,
  },

  // ---- Header ----
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
  },
  headerTextGroup: {
    flex: 1,
    gap: 2,
  },
  headerCaption: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.mutedGray,
  },
  headerTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 18,
    color: theme.colors.white,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Fields ----
  field: {
    gap: theme.spacing.md,
  },
  lastField: {
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.mutedGray,
  },
  sectionTitle: {
    ...theme.typography.headingSmall,
    fontSize: 18,
    color: theme.colors.white,
  },

  // ---- Route inputs ----
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    height: 52,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
  },
  inputPrefix: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.mutedGray,
  },
  input: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.white,
    flex: 1,
    padding: 0,
  },

  // ---- Side-by-side fields ----
  sideBySideRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  sideField: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    gap: 6,
  },
  sideFieldLabel: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.mutedGray,
  },
  sideFieldValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.xs,
  },
  sideFieldValue: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },

  // ---- Preferences chips ----
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    height: 36,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceNavy,
  },
  chipSelected: {
    backgroundColor: theme.colors.secondarySilver,
  },
  chipText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.secondarySilver,
  },
  chipTextSelected: {
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.primaryNavy,
  },

  planError: {
    ...theme.typography.body,
    fontSize: 13,
    color: theme.colors.mutedGray,
    marginTop: theme.spacing.sm,
  },
  planSummary: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.secondarySilver,
    marginTop: theme.spacing.sm,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 24, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '70%',
    backgroundColor: theme.colors.surfaceNavy,
    borderTopLeftRadius: theme.radius.large,
    borderTopRightRadius: theme.radius.large,
    padding: theme.spacing.lg,
  },
  sheetTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 16,
    color: theme.colors.white,
    marginBottom: theme.spacing.sm,
  },
  sheetRow: {
    paddingVertical: theme.spacing.md,
  },
  sheetRowText: {
    ...theme.typography.medium,
    fontSize: 15,
    color: theme.colors.white,
  },

  // ---- Generate button ----
  generateButton: {
    height: 52,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.primaryNavy,
  },

  // ---- Route stops ----
  stopList: {
    gap: theme.spacing.md,
  },
  stopCard: {
    gap: theme.spacing.sm,
  },
  stopHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  stopBadge: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBadgeText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 13,
    color: theme.colors.primaryNavy,
  },
  stopTextGroup: {
    flex: 1,
    gap: 2,
  },
  stopName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.white,
  },
  stopMeta: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },

  // ---- Mini lounge card ----
  loungeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginLeft: 40,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
  },
  loungeImage: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.background,
  },
  loungeTextGroup: {
    flex: 1,
    gap: 2,
  },
  loungeName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  loungeLocation: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },
  reserveButton: {
    paddingHorizontal: theme.spacing.md,
    height: 34,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reserveButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 12,
    color: theme.colors.primaryNavy,
  },
});
