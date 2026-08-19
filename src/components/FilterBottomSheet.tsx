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
 *
 * Save Filter is real (users/{userId}/savedFilters — see
 * userActionsService.ts), not the "Coming Soon" stub it used to be:
 * naming and saving a preset persists the current draft to Firestore,
 * saved presets render as a horizontal chip row (tap to apply, long-press
 * or the trash icon to delete), and everything's scoped to the signed-in
 * member via the `userId` prop — omitted/signed-out shows a sign-in
 * prompt instead of silently doing nothing.
 */

import React, { useEffect, useState } from 'react';
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
  Cigarette,
  Clock,
  LayoutGrid,
  LocateFixed,
  Music,
  Search as SearchIcon,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import { LOUNGE_TYPE_OPTIONS, type LoungeType } from '../utils/loungeType';
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
import { keyboardAwareScrollProps } from '../utils/keyboardAware';
import {
  deleteSavedSearchFilter,
  getSavedSearchFilters,
  saveSearchFilter,
  type SavedFilter,
} from '../services/userActionsService';
import {
  applySearchFilters,
  viableFilterOptions,
  type LatLng,
  type SearchFilters,
} from '../utils/loungeSearch';

type Props = {
  visible: boolean;
  results: Lounge[];
  initialFilters: SearchFilters;
  onApply: (filters: SearchFilters) => void;
  onClose: () => void;
  /** Real device location (see useCurrentLocation), used for the "Show N
   * Results" live count when "Near Current Location" is toggled on.
   * Defaults to applySearchFilters' own defaultRegion fallback if omitted. */
  currentLocation?: LatLng;
  /** Real Firestore-backed Saved Filters (see userActionsService.ts) are
   * scoped to the signed-in member — omit/undefined when signed out,
   * which disables Save Filter with a sign-in prompt instead of hiding
   * it outright. */
  userId?: string;
};

type SectionId =
  | 'location'
  | 'loungeType'
  | 'availability'
  | 'atmosphere'
  | 'amenities'
  | 'entertainment';

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
  currentLocation,
  userId,
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
  const [selectedLoungeTypes, setSelectedLoungeTypes] = useState<LoungeType[]>(
    initialFilters.loungeTypes,
  );
  const [selectedEntertainment, setSelectedEntertainment] = useState<string[]>(
    initialFilters.entertainment,
  );

  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [namingFilter, setNamingFilter] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');

  const loadSavedFilters = () => {
    if (!userId) {
      return;
    }
    getSavedSearchFilters(userId)
      .then(setSavedFilters)
      .catch(() => {});
  };

  useEffect(() => {
    if (visible) {
      loadSavedFilters();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, userId]);

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
    setSelectedLoungeTypes([]);
  };

  const draftFilters: SearchFilters = {
    distanceMiles: distance,
    nearCurrentLocation,
    cityQuery,
    availability: selectedAvailability,
    atmosphere: selectedAtmosphere,
    amenities: selectedAmenities,
    entertainment: selectedEntertainment,
    loungeTypes: selectedLoungeTypes,
  };

  // Dataset is a few dozen lounges at most (see loungeService.ts), so
  // recomputing this on every render (as chips are toggled) is cheap
  // enough to skip memoizing.
  const resultCount = applySearchFilters(results, draftFilters, currentLocation).length;

  // Only offer chips that can actually match something in the data we have
  // — see viableFilterOptions for why a chip that always returns zero is
  // worse than no chip at all.
  const viableAtmosphere = viableFilterOptions(results, atmosphereOptions);
  const viableAmenities = viableFilterOptions(results, amenitiesOptions);
  const viableEntertainment = viableFilterOptions(results, entertainmentOptions);

  const handleShowResults = () => {
    onApply(draftFilters);
    onClose();
  };

  const handleSaveFilter = () => {
    if (!userId) {
      Alert.alert('Sign In Required', 'Sign in to save filters for later.');
      return;
    }
    setNewFilterName('');
    setNamingFilter(true);
  };

  const confirmSaveFilter = () => {
    if (!userId) {
      return;
    }
    const name = newFilterName.trim() || 'Untitled Filter';
    saveSearchFilter(userId, name, draftFilters)
      .then(loadSavedFilters)
      .catch(() => Alert.alert("Couldn't save filter", 'Check your connection and try again.'));
    setNamingFilter(false);
  };

  const applySavedFilter = (saved: SavedFilter) => {
    setDistance(saved.criteria.distanceMiles);
    setNearCurrentLocation(saved.criteria.nearCurrentLocation);
    setCityQuery(saved.criteria.cityQuery);
    setSelectedAvailability(saved.criteria.availability);
    setSelectedAtmosphere(saved.criteria.atmosphere);
    setSelectedAmenities(saved.criteria.amenities);
    setSelectedEntertainment(saved.criteria.entertainment);
  };

  const handleDeleteSavedFilter = (saved: SavedFilter) => {
    if (!userId) {
      return;
    }
    Alert.alert('Delete Saved Filter', `Remove "${saved.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteSavedSearchFilter(userId, saved.id)
            .then(loadSavedFilters)
            .catch(() => Alert.alert("Couldn't delete filter", 'Check your connection and try again.'));
        },
      },
    ]);
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
        {namingFilter ? (
          <View style={styles.namingRow}>
            <TextInput
        accessibilityLabel="Name this filter"
              value={newFilterName}
              onChangeText={setNewFilterName}
              placeholder="Name this filter"
              placeholderTextColor={theme.colors.mutedGray}
              style={styles.namingInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={confirmSaveFilter}
            />
            <Pressable onPress={confirmSaveFilter} hitSlop={8}>
              <Text style={styles.saveLink}>Save</Text>
            </Pressable>
            <Pressable onPress={() => setNamingFilter(false)} hitSlop={8}>
              <Text style={styles.resetLink}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.saveRow}>
            <Pressable onPress={handleSaveFilter} hitSlop={8}>
              <Text style={styles.saveLink}>Save Filter</Text>
            </Pressable>
          </View>
        )}

        {savedFilters.length > 0 ? (
          <ScrollView {...keyboardAwareScrollProps}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.savedFilterScroll}
            contentContainerStyle={styles.savedFilterRow}
          >
            {savedFilters.map(saved => (
              <Pressable
                key={saved.id}
                style={styles.savedFilterChip}
                onPress={() => applySavedFilter(saved)}
                onLongPress={() => handleDeleteSavedFilter(saved)}
              >
                <Text style={styles.savedFilterChipText} numberOfLines={1}>
                  {saved.name}
                </Text>
                <Pressable hitSlop={8} onPress={() => handleDeleteSavedFilter(saved)}>
                  <Trash2 size={12} color={theme.colors.mutedGray} />
                </Pressable>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

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
                      false: theme.colors.surface,
                      true: theme.colors.secondarySilver,
                    }}
                    thumbColor={theme.colors.white}
                  />
                </View>

                <View style={styles.cityInput}>
                  <SearchIcon size={16} color={theme.colors.mutedGray} />
                  <TextInput
        accessibilityLabel="Search Another City"
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

          {/* ---------------- Lounge Type ---------------- */}
          {/* Placed first because it is the coarsest cut a member can make —
              "show me hookah bars" narrows harder than any amenity, and
              Dr. Brinkley asked for it by name (2026-08-19).

              Not passed through `viableFilterOptions` like the sections below.
              Those hide chips that match nothing in the dataset, which is right
              for free-text attributes; type is derived for every lounge, so
              every option here always has venues behind it. */}
          <View style={styles.section}>
            <SectionHeaderRow
              icon={<Cigarette size={16} color={theme.colors.secondarySilver} />}
              title="Lounge Type"
              expanded={expandedSections.includes('loungeType')}
              onToggle={() => toggleSection('loungeType')}
            />
            {expandedSections.includes('loungeType') ? (
              <View style={styles.sectionBody}>
                <ChipGroup
                  options={LOUNGE_TYPE_OPTIONS}
                  selectedIds={selectedLoungeTypes}
                  onToggle={id =>
                    setSelectedLoungeTypes(prev => toggleId(prev, id) as LoungeType[])
                  }
                />
              </View>
            ) : null}
          </View>

          {/* ---------------- Atmosphere ---------------- */}
          {/* Hidden entirely when nothing in the dataset carries these
              attributes — an empty section reads as a broken filter. */}
          {viableAtmosphere.length > 0 ? (
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
                  options={viableAtmosphere}
                  selectedIds={selectedAtmosphere}
                  onToggle={id => setSelectedAtmosphere(prev => toggleId(prev, id))}
                />
              </View>
            ) : null}
          </View>
          ) : null}

          {/* ---------------- Amenities ---------------- */}
          {/* Hidden entirely when nothing in the dataset carries these
              attributes — an empty section reads as a broken filter. */}
          {viableAmenities.length > 0 ? (
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
                  options={viableAmenities}
                  selectedIds={selectedAmenities}
                  onToggle={id => setSelectedAmenities(prev => toggleId(prev, id))}
                />
              </View>
            ) : null}
          </View>
          ) : null}

          {/* ---------------- Entertainment ---------------- */}
          {viableEntertainment.length > 0 ? (
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
                  options={viableEntertainment}
                  selectedIds={selectedEntertainment}
                  onToggle={id => setSelectedEntertainment(prev => toggleId(prev, id))}
                />
              </View>
            ) : null}
          </View>
          ) : null}
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
    backgroundColor: withAlpha(theme.colors.background, 0.7),
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    ...theme.shadows.deep,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.3),
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
    color: theme.colors.accentGold,
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
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.15),
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
    color: theme.colors.accentGold,
    textDecorationLine: 'underline',
  },

  // ---- Save Filter naming row ----
  namingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  namingInput: {
    ...theme.typography.body,
    flex: 1,
    height: 36,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.small,
    backgroundColor: withAlpha(theme.colors.background, 0.4),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.2),
    fontSize: 13,
    color: theme.colors.white,
  },

  // ---- Saved filter chips ----
  savedFilterScroll: {
    flexGrow: 0,
    marginTop: theme.spacing.md,
  },
  savedFilterRow: {
    gap: theme.spacing.sm,
  },
  savedFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.background, 0.4),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.25),
  },
  savedFilterChipText: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.secondarySilver,
    maxWidth: 120,
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
    borderBottomColor: withAlpha(theme.colors.secondarySilver, 0.12),
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
    backgroundColor: withAlpha(theme.colors.background, 0.4),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.15),
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
    borderColor: withAlpha(theme.colors.accentGold, 0.3),
  },
  chipText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.secondarySilver,
  },
  chipTextSelected: {
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.primaryBlack,
  },

  // ---- Footer ----
  footer: {
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  showResultsButton: {
    height: 52,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showResultsButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 16,
    color: theme.colors.primaryBlack,
  },
  resetFiltersLink: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.accentGold,
    textAlign: 'center',
  },
});
