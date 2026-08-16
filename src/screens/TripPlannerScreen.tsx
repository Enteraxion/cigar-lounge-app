/**
 * TripPlannerScreen
 *
 * Matches design-reference/Trip Planner & Saved Conversations.pdf (top
 * half): route details (starting/destination inputs, travel date + stop
 * frequency fields), a multi-select preferences chip row, a "Generate
 * Itinerary" button, and a numbered list of route stops — some with an
 * embedded mini lounge card. Reached from the "Plan a Trip" entry point
 * on ConciergeHomeScreen. Mock data only (see
 * src/data/mockTripPlanner.ts) — no real routing/AI wired up yet.
 */

import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Calendar, ChevronDown, ChevronLeft, History, MapPin, Navigation } from 'lucide-react-native';
import { theme } from '../theme';
import { conciergeUser } from '../data/mockConcierge';
import {
  defaultSelectedPreferenceIds,
  preferenceOptions,
  routeDetails,
  routeStops,
  type RouteStop,
} from '../data/mockTripPlanner';
import type { ConciergeStackParamList } from '../navigation/ConciergeNavigator';

type ConciergeNavigationProp = NativeStackNavigationProp<ConciergeStackParamList>;

function RouteStopCard({ stop }: { stop: RouteStop }) {
  return (
    <View style={styles.stopCard}>
      <View style={styles.stopHeaderRow}>
        <View style={styles.stopBadge}>
          <Text style={styles.stopBadgeText}>{stop.order}</Text>
        </View>
        <View style={styles.stopTextGroup}>
          <Text style={styles.stopName}>{stop.name}</Text>
          <Text style={styles.stopMeta}>
            ETA: {stop.eta} • {stop.distance}
          </Text>
        </View>
      </View>

      {stop.lounge ? (
        <View style={styles.loungeCard}>
          <Image source={{ uri: stop.lounge.image }} style={styles.loungeImage} />
          <View style={styles.loungeTextGroup}>
            <Text style={styles.loungeName} numberOfLines={1}>
              {stop.lounge.name}
            </Text>
            <Text style={styles.loungeLocation} numberOfLines={1}>
              {stop.lounge.location}
            </Text>
          </View>
          <Pressable
            style={styles.reserveButton}
            onPress={() => Alert.alert('Coming Soon', 'Table reservations are not available yet.')}
          >
            <Text style={styles.reserveButtonText}>Reserve</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default function TripPlannerScreen() {
  const navigation = useNavigation<ConciergeNavigationProp>();
  const [starting, setStarting] = useState(routeDetails.starting);
  const [destination, setDestination] = useState(routeDetails.destination);
  const [selectedPreferences, setSelectedPreferences] = useState<Set<string>>(
    new Set(defaultSelectedPreferenceIds),
  );

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
              onPress={() => Alert.alert('Coming Soon', 'Date selection is coming soon.')}
            >
              <Text style={styles.sideFieldLabel}>Travel Date</Text>
              <View style={styles.sideFieldValueRow}>
                <Calendar size={14} color={theme.colors.secondarySilver} />
                <Text style={styles.sideFieldValue}>{routeDetails.travelDate}</Text>
              </View>
            </Pressable>
            <Pressable
              style={styles.sideField}
              onPress={() => Alert.alert('Coming Soon', 'Stop frequency selection is coming soon.')}
            >
              <Text style={styles.sideFieldLabel}>Stop Frequency</Text>
              <View style={styles.sideFieldValueRow}>
                <Text style={styles.sideFieldValue}>{routeDetails.stopFrequency}</Text>
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
          onPress={() => Alert.alert('Coming Soon', 'Itinerary generation is not available yet.')}
        >
          <Text style={styles.generateButtonText}>Generate Itinerary</Text>
        </Pressable>

        {/* ---------------- Route Stops ---------------- */}
        <View style={[styles.field, styles.lastField]}>
          <Text style={styles.sectionTitle}>Your Route Stops</Text>
          <View style={styles.stopList}>
            {routeStops.map(stop => (
              <RouteStopCard key={stop.id} stop={stop} />
            ))}
          </View>
        </View>
      </ScrollView>
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
