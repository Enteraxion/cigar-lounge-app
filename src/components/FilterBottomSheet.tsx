/**
 * FilterBottomSheet
 *
 * Matches design-reference/Filter Bottom Sheet & Categories.pdf: a tall
 * bottom sheet modal with accordion sections (Location, Availability,
 * Atmosphere, Amenities, Entertainment) and a sticky "Show N Results"
 * footer. Built with RN's built-in Modal (no bottom-sheet library in
 * this project) — same pattern as SortBottomSheet. Local state here is
 * a *draft* of the filters, seeded from `initialFilters` and reported
 * back to SearchResultsScreen (the real source of truth) via `onApply`
 * — same lift-up pattern SortBottomSheet uses with selectedId/onSelect/
 * onApply. The "Show N Results" count is the real live count of
 * `results` that would match the current draft, computed via
 * src/utils/loungeSearch.ts's applySearchFilters (same rules the screen
 * uses once applied) rather than a fake estimate.
 */

import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  LayoutGrid,
  LocateFixed,
  Music,
  Search as SearchIcon,
  Sparkles,
  X,
} from 'lucide-react-native';
import { theme } from '../theme';
import DistanceSlider from './DistanceSlider';
import {
  amenitiesOptions,
  atmosphereOptions,
  availabilityOptions,
  defaultDistanceMiles,
  defaultSelectedAvailability,
  entertainmentOptions,
  type FilterOption,
} from '../data/mockFilters';
import type { Lounge } from '../services/loungeService';
import { applySearchFilters, type SearchFilters } from '../utils/loungeSearch';

type Props = {
  visible: boolean;
  results: Lounge[];
  initialFilters: SearchFilters;
  onApply: (filters: SearchFilters) => void;
  onClose: () => void;
};

type SectionId = 'location' | 'availability' | 'atmosphere' | 'amenities' | 'entertainment';

function SectionHeaderRow({
  icon,
  title,
  expanded,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable style={styles.sectionHeader} onPress={onToggle}>
      <View style={styles.sectionHeaderLeft}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {expanded ? (
        <ChevronUp size={18} color={theme.colors.secondarySilver} />
      ) : (
        <ChevronDown size={18} color={theme.colors.secondarySilver} />
      )}
    </Pressable>
  );
}

function OptionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipSelected : styles.chipUnselected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function ChipGroup({
  options,
  selectedIds,
  onToggle,
}: {
  options: FilterOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map(option => (
        <OptionChip
          key={option.id}
          label={option.label}
          selected={selectedIds.includes(option.id)}
          onPress={() => onToggle(option.id)}
        />
      ))}
    </View>
  );
}

function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter(existing => existing !== id) : [...ids, id];
}

export default function FilterBottomSheet({
  visible,
  results,
  initialFilters,
  onApply,
  onClose,
}: Props) {
  const [expandedSections, setExpandedSections] = useState<SectionId[]>(['location']);
  const [distance, setDistance] = useState(initialFilters.distanceMiles);
  const [nearCurrentLocation, setNearCurrentLocation] = useState(
    initialFilters.nearCurrentLocation,
  );
  const [cityQuery, setCityQuery] = useState(initialFilters.cityQuery);
  const [selectedAvailability, setSelectedAvailability] = useState<string[]>(
    initialFilters.availability,
  );
  const [selectedAtmosphere, setSelectedAtmosphere] = useState<string[]>(
    initialFilters.atmosphere,
  );
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(initialFilters.amenities);
  const [selectedEntertainment, setSelectedEntertainment] = useState<string[]>(
    initialFilters.entertainment,
  );

  const toggleSection = (id: SectionId) => {
    setExpandedSections(prev =>
      prev.includes(id) ? prev.filter(section => section !== id) : [...prev, id],
    );
  };

  const resetFilters = () => {
    setExpandedSections(['location']);
    setDistance(defaultDistanceMiles);
    setNearCurrentLocation(true);
    setCityQuery('');
    setSelectedAvailability(defaultSelectedAvailability);
    setSelectedAtmosphere([]);
    setSelectedAmenities([]);
    setSelectedEntertainment([]);
  };

  const draftFilters: SearchFilters = {
    distanceMiles: distance,
    nearCurrentLocation,
    cityQuery,
    availability: selectedAvailability,
    atmosphere: selectedAtmosphere,
    amenities: selectedAmenities,
    entertainment: selectedEntertainment,
  };

  // Dataset is a few dozen lounges at most (see loungeService.ts), so
  // recomputing this on every render (as chips are toggled) is cheap
  // enough to skip memoizing.
  const resultCount = applySearchFilters(results, draftFilters).length;

  const handleShowResults = () => {
    onApply(draftFilters);
    onClose();
  };

  const handleSaveFilter = () => {
    Alert.alert('Coming Soon', "Saved filters aren't available yet.");
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          <View style={styles.headerSide}>
            <Pressable onPress={resetFilters} hitSlop={8}>
              <Text style={styles.resetLink}>Reset</Text>
            </Pressable>
          </View>
          <Text style={styles.title}>Filters</Text>
          <View style={[styles.headerSide, styles.headerSideRight]}>
            <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
              <X size={16} color={theme.colors.white} />
            </Pressable>
          </View>
        </View>
        <View style={styles.saveRow}>
          <Pressable onPress={handleSaveFilter} hitSlop={8}>
            <Text style={styles.saveLink}>Save Filter</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ---------------- Location ---------------- */}
          <View style={styles.section}>
            <SectionHeaderRow
              icon={<LocateFixed size={16} color={theme.colors.secondarySilver} />}
              title="Location"
              expanded={expandedSections.includes('location')}
              onToggle={() => toggleSection('location')}
            />
            {expandedSections.includes('location') ? (
              <View style={styles.sectionBody}>
                <View style={styles.distanceHeaderRow}>
                  <Text style={styles.fieldLabel}>Distance</Text>
                  <Text style={styles.distanceValue}>{distance} miles</Text>
                </View>
                <DistanceSlider value={distance} onChange={setDistance} />

                <View style={styles.toggleRow}>
                  <Text style={styles.fieldLabel}>Near Current Location</Text>
                  <Switch
                    value={nearCurrentLocation}
                    onValueChange={setNearCurrentLocation}
                    trackColor={{
                      false: theme.colors.surfaceNavy,
                      true: theme.colors.secondarySilver,
                    }}
                    thumbColor={theme.colors.white}
                  />
                </View>

                <View style={styles.cityInput}>
                  <SearchIcon size={16} color={theme.colors.mutedGray} />
                  <TextInput
                    value={cityQuery}
                    onChangeText={setCityQuery}
                    placeholder="Search Another City"
                    placeholderTextColor={theme.colors.mutedGray}
                    style={styles.cityInputText}
                  />
                </View>
              </View>
            ) : null}
          </View>

          {/* ---------------- Availability ---------------- */}
          <View style={styles.section}>
            <SectionHeaderRow
              icon={<Clock size={16} color={theme.colors.secondarySilver} />}
              title="Availability"
              expanded={expandedSections.includes('availability')}
              onToggle={() => toggleSection('availability')}
            />
            {expandedSections.includes('availability') ? (
              <View style={styles.sectionBody}>
                <ChipGroup
                  options={availabilityOptions}
                  selectedIds={selectedAvailability}
                  onToggle={id => setSelectedAvailability(prev => toggleId(prev, id))}
                />
              </View>
            ) : null}
          </View>

          {/* ---------------- Atmosphere ---------------- */}
          <View style={styles.section}>
            <SectionHeaderRow
              icon={<Sparkles size={16} color={theme.colors.secondarySilver} />}
              title="Atmosphere"
              expanded={expandedSections.includes('atmosphere')}
              onToggle={() => toggleSection('atmosphere')}
            />
            {expandedSections.includes('atmosphere') ? (
              <View style={styles.sectionBody}>
                <ChipGroup
                  options={atmosphereOptions}
                  selectedIds={selectedAtmosphere}
                  onToggle={id => setSelectedAtmosphere(prev => toggleId(prev, id))}
                />
              </View>
            ) : null}
          </View>

          {/* ---------------- Amenities ---------------- */}
          <View style={styles.section}>
            <SectionHeaderRow
              icon={<LayoutGrid size={16} color={theme.colors.secondarySilver} />}
              title="Amenities"
              expanded={expandedSections.includes('amenities')}
              onToggle={() => toggleSection('amenities')}
            />
            {expandedSections.includes('amenities') ? (
              <View style={styles.sectionBody}>
                <ChipGroup
                  options={amenitiesOptions}
                  selectedIds={selectedAmenities}
                  onToggle={id => setSelectedAmenities(prev => toggleId(prev, id))}
                />
              </View>
            ) : null}
          </View>

          {/* ---------------- Entertainment ---------------- */}
          <View style={[styles.section, styles.lastSection]}>
            <SectionHeaderRow
              icon={<Music size={16} color={theme.colors.secondarySilver} />}
              title="Entertainment"
              expanded={expandedSections.includes('entertainment')}
              onToggle={() => toggleSection('entertainment')}
            />
            {expandedSections.includes('entertainment') ? (
              <View style={styles.sectionBody}>
                <ChipGroup
                  options={entertainmentOptions}
                  selectedIds={selectedEntertainment}
                  onToggle={id => setSelectedEntertainment(prev => toggleId(prev, id))}
                />
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.showResultsButton} onPress={handleShowResults}>
            <Text style={styles.showResultsButtonText}>Show {resultCount} Results</Text>
          </Pressable>
          <Pressable onPress={resetFilters} hitSlop={8}>
            <Text style={styles.resetFiltersLink}>Reset Filters</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 24, 0.7)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceNavy,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    ...theme.shadows.deep,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(192, 192, 192, 0.3)',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },

  // ---- Header ----
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSide: {
    flex: 1,
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  resetLink: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.mutedGray,
  },
  title: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 20,
    color: theme.colors.white,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(192, 192, 192, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveRow: {
    alignItems: 'flex-end',
    marginTop: theme.spacing.sm,
  },
  saveLink: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.secondarySilver,
    textDecorationLine: 'underline',
  },

  // ---- Scroll body ----
  scroll: {
    marginTop: theme.spacing.md,
  },
  scrollContent: {
    paddingBottom: theme.spacing.lg,
  },

  // ---- Sections ----
  section: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(192, 192, 192, 0.12)',
    paddingVertical: theme.spacing.md,
  },
  lastSection: {
    borderBottomWidth: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 16,
    color: theme.colors.white,
  },
  sectionBody: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.md,
  },

  // ---- Location fields ----
  distanceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.secondarySilver,
  },
  distanceValue: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cityInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    height: 46,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: 'rgba(5, 10, 24, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.15)',
  },
  cityInputText: {
    ...theme.typography.body,
    flex: 1,
    fontSize: 14,
    color: theme.colors.white,
    padding: 0,
  },

  // ---- Chips ----
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    height: 40,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: theme.colors.accentGold,
    borderWidth: 1,
    borderColor: theme.colors.accentGold,
  },
  chipUnselected: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.3)',
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

  // ---- Footer ----
  footer: {
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  showResultsButton: {
    height: 52,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.secondarySilver,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showResultsButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 16,
    color: theme.colors.primaryNavy,
  },
  resetFiltersLink: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.mutedGray,
    textAlign: 'center',
  },
});
