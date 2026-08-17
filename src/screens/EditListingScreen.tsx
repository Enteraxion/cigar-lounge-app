/**
 * EditListingScreen
 *
 * Reached from LoungeDetailScreen's "Edit Listing" button, shown only
 * to the member who claimed this lounge (lounge.ownerId === signed-in
 * uid — see ClaimListingScreen/ownerService.ts). Editable fields:
 * description, hours, price range, and amenities (comma-separated free
 * text, matching how amenities are already stored/searched elsewhere —
 * see src/utils/loungeSearch.ts's keyword-matching approach). Humidor
 * items/photos aren't editable here yet — kept to the fields an owner
 * most needs to correct first (Yelp-imported lounges start with
 * "Hours not yet available" and no description).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import { getLoungeById } from '../services/loungeService';
import { updateLoungeDetails } from '../services/ownerService';
import { auth } from '../services/firebaseAuth';
import type { SearchStackParamList } from '../navigation/SearchNavigator';
import { keyboardAwareScrollProps } from '../utils/keyboardAware';

type EditListingNavigationProp = NativeStackNavigationProp<SearchStackParamList>;
type EditListingRouteProp = RouteProp<SearchStackParamList, 'EditListing'>;

export default function EditListingScreen() {
  const navigation = useNavigation<EditListingNavigationProp>();
  const route = useRoute<EditListingRouteProp>();
  const loungeId = route.params.loungeId;
  const userId = auth.currentUser?.uid;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState('');
  const [priceRange, setPriceRange] = useState('');
  const [amenitiesText, setAmenitiesText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [descriptionError, setDescriptionError] = useState('');
  const [hoursError, setHoursError] = useState('');

  const loadLounge = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    getLoungeById(loungeId)
      .then(lounge => {
        if (lounge) {
          setDescription(lounge.description);
          setHours(lounge.hours);
          setPriceRange(lounge.priceRange);
          setAmenitiesText(lounge.amenities.join(', '));
        }
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [loungeId]);

  useEffect(() => {
    loadLounge();
  }, [loadLounge]);

  const save = async () => {
    if (!userId) return;

    let hasError = false;
    if (!description.trim()) {
      setDescriptionError('Description is required.');
      hasError = true;
    }
    if (!hours.trim()) {
      setHoursError('Hours are required.');
      hasError = true;
    }
    if (hasError) {
      return;
    }

    setSubmitting(true);
    try {
      await updateLoungeDetails(loungeId, userId, {
        description,
        hours,
        priceRange,
        amenities: amenitiesText
          .split(',')
          .map(item => item.trim())
          .filter(Boolean),
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        "Couldn't save changes",
        error instanceof Error ? error.message : 'Check your connection and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back" hitSlop={8}>
          <ChevronLeft size={20} color={theme.colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Listing</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.colors.secondarySilver} />
        </View>
      ) : loadError ? (
        <View style={styles.stateBox}>
          <Text style={styles.errorStateText}>Couldn't load this listing.</Text>
          <Pressable style={styles.retryButton} onPress={loadLounge}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView {...keyboardAwareScrollProps} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
        accessibilityLabel="Tell customers about your business"
              value={description}
              onChangeText={text => {
                setDescription(text);
                if (descriptionError) setDescriptionError('');
              }}
              placeholder="Tell customers about your business"
              placeholderTextColor={theme.colors.mutedGray}
              style={[styles.textInput, styles.multilineInput, descriptionError && styles.textInputError]}
              multiline
            />
            {!!descriptionError && <Text style={styles.fieldError}>{descriptionError}</Text>}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Hours</Text>
            <TextInput
        accessibilityLabel="e.g. Mon-Sat 11am-11pm"
              value={hours}
              onChangeText={text => {
                setHours(text);
                if (hoursError) setHoursError('');
              }}
              placeholder="e.g. Mon-Sat 11am-11pm"
              placeholderTextColor={theme.colors.mutedGray}
              style={[styles.textInput, hoursError && styles.textInputError]}
            />
            {!!hoursError && <Text style={styles.fieldError}>{hoursError}</Text>}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Price Range</Text>
            <TextInput
        accessibilityLabel="e.g. $$$"
              value={priceRange}
              onChangeText={setPriceRange}
              placeholder="e.g. $$$"
              placeholderTextColor={theme.colors.mutedGray}
              style={styles.textInput}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Amenities</Text>
            <TextInput
        accessibilityLabel="e.g. Full Bar, Private Rooms, Valet Parking"
              value={amenitiesText}
              onChangeText={setAmenitiesText}
              placeholder="e.g. Full Bar, Private Rooms, Valet Parking"
              placeholderTextColor={theme.colors.mutedGray}
              style={styles.textInput}
            />
            <Text style={styles.fieldHint}>Separate each amenity with a comma.</Text>
          </View>

          <Pressable
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={save}
            disabled={submitting}
          >
            <Text style={styles.submitButtonText}>{submitting ? 'Saving...' : 'Save Changes'}</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 17,
    color: theme.colors.white,
  },
  headerSpacer: {
    width: 32,
  },
  stateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  errorStateText: {
    ...theme.typography.body,
    fontSize: 14,
    color: theme.colors.mutedGray,
  },
  retryButton: {
    paddingHorizontal: theme.spacing.lg,
    height: 44,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.25),
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    // Clears MainNavigator's floating pill tab bar (bottom: 24 + height: 64)
    // plus breathing room, so the submit button never sits under it.
    paddingBottom: theme.spacing.xxl + 64,
    gap: theme.spacing.xl,
  },
  field: {
    gap: theme.spacing.sm,
  },
  fieldLabel: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.accentGold,
  },
  fieldHint: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.mutedGray,
  },
  textInput: {
    ...theme.typography.body,
    height: 50,
    fontSize: 14,
    color: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.15),
  },
  textInputError: {
    borderColor: theme.colors.danger,
  },
  fieldError: {
    ...theme.typography.caption,
    fontSize: 12,
    color: theme.colors.danger,
  },
  multilineInput: {
    height: 100,
    paddingTop: theme.spacing.sm,
    textAlignVertical: 'top',
  },
  submitButton: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.accentGold,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 15,
    color: theme.colors.primaryBlack,
  },
});
