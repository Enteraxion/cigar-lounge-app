/**
 * WriteReviewScreen
 *
 * Matches design-reference/Lounge Reviews & Write Review.pdf (Part 2):
 * overall star rating, visit date, Would-You-Return / Recommend toggles,
 * a review text area, a photo-upload row, a detailed per-category rating
 * list, and a submit button. Submitting calls
 * src/services/userActionsService.ts's submitReview() with the real
 * signed-in user's uid/name/avatar (never the demo seed user) and only
 * navigates to ReviewSubmitted once the write actually succeeds — a
 * failed submission shows an alert and leaves the form intact so nothing
 * is lost. `photos` are real Firebase Storage download URLs by the time
 * they arrive here — UploadPhotosScreen (reached via "Add Photos" below)
 * uploads each selected photo via src/services/storageService.ts and
 * only ever hands back photos that finished uploading.
 *
 * Also doubles as the edit-review screen: when nav params include a
 * `reviewId` (see WriteReviewInitialData in ../navigation/SearchNavigator),
 * the form is prefilled from `initialReview` and submitting calls
 * updateReview() instead of submitReview(), then just goes back rather
 * than to ReviewSubmitted (that screen's copy is specifically for new
 * reviews).
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Calendar, ImagePlus, X } from 'lucide-react-native';
import { theme } from '../theme';
import StarRating from '../components/StarRating';
import { detailedRatingCategories } from '../data/mockReviews';
import {
  submitReview as submitReviewToFirestore,
  updateReview as updateReviewInFirestore,
} from '../services/userActionsService';
import { auth } from '../services/firebaseAuth';
import type { ReviewCategoryRatings } from '../types/firestore';
import type { SearchStackParamList } from '../navigation/SearchNavigator';
import { TAB_BAR_SCROLL_CLEARANCE } from '../utils/tabBarLayout';

type WriteReviewNavigationProp = NativeStackNavigationProp<SearchStackParamList>;
type WriteReviewRouteProp = RouteProp<SearchStackParamList, 'WriteReview'>;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Maps the design's display labels (src/data/mockReviews.ts) to the
// schema's camelCase ReviewCategoryRatings keys (src/types/firestore.ts).
const CATEGORY_KEY_MAP: Record<string, keyof ReviewCategoryRatings> = {
  Atmosphere: 'atmosphere',
  'Humidor Selection': 'humidorVariety',
  'Staff Knowledge': 'staffKnowledge',
  Service: 'service',
  Ventilation: 'ventilation',
  Comfort: 'comfort',
  'Whiskey Selection': 'whiskeySelection',
  'Luxury Experience': 'luxuryExperience',
};

function formatToday() {
  const today = new Date();
  return `${MONTH_NAMES[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
}

export default function WriteReviewScreen() {
  const navigation = useNavigation<WriteReviewNavigationProp>();
  const route = useRoute<WriteReviewRouteProp>();
  const loungeId = route.params?.loungeId;
  const reviewId = route.params?.reviewId;
  const isEditMode = Boolean(reviewId);

  const [overallRating, setOverallRating] = useState(0);
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(true);
  const [recommend, setRecommend] = useState<boolean | null>(true);
  const [reviewText, setReviewText] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [categoryScores, setCategoryScores] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (route.params?.selectedPhotos) {
      setPhotos(route.params.selectedPhotos);
      navigation.setParams({ selectedPhotos: undefined });
    }
  }, [route.params?.selectedPhotos, navigation]);

  // Edit mode — prefill the form from the review passed in via nav params
  // (see WriteReviewInitialData in SearchNavigator.tsx) instead of a
  // fresh re-fetch, since the caller already has the full review.
  useEffect(() => {
    const initial = route.params?.initialReview;
    if (!initial) return;
    setOverallRating(initial.rating);
    setWouldReturn(initial.wouldReturn);
    setRecommend(initial.recommend);
    setReviewText(initial.text);
    setPhotos(initial.photos);

    const scores: Record<string, number> = {};
    for (const [label, key] of Object.entries(CATEGORY_KEY_MAP)) {
      const score = initial.categoryRatings[key];
      if (score) scores[label] = score;
    }
    setCategoryScores(scores);
    // Only meant to run once, off the initial params — not on every render.
  }, [route.params?.initialReview]);

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const setCategoryScore = (label: string, score: number) => {
    setCategoryScores(prev => ({ ...prev, [label]: score }));
  };

  const submitReview = async () => {
    const user = auth.currentUser;
    if (!loungeId || !user) {
      Alert.alert(
        isEditMode ? "Couldn't update review" : "Couldn't submit review",
        'You need to be signed in to write a review.',
      );
      return;
    }
    if (overallRating === 0) {
      Alert.alert('Add a rating', 'Rate your overall experience before submitting.');
      return;
    }
    if (submitting) return;

    const categoryRatings: ReviewCategoryRatings = {};
    for (const [label, score] of Object.entries(categoryScores)) {
      const key = CATEGORY_KEY_MAP[label];
      if (key && score > 0) categoryRatings[key] = score;
    }

    setSubmitting(true);
    try {
      if (isEditMode && reviewId) {
        await updateReviewInFirestore(loungeId, reviewId, {
          rating: overallRating,
          text: reviewText,
          categoryRatings,
          wouldReturn: wouldReturn ?? true,
          recommend: recommend ?? true,
          photos,
        });
        Alert.alert('Review Updated', 'Your changes have been saved.');
        navigation.goBack();
      } else {
        await submitReviewToFirestore(loungeId, {
          userId: user.uid,
          userName: user.displayName ?? user.email ?? 'Member',
          userAvatar: user.photoURL ?? '',
          rating: overallRating,
          text: reviewText,
          categoryRatings,
          wouldReturn: wouldReturn ?? true,
          recommend: recommend ?? true,
          photos,
          visitDate: new Date(),
        });
        navigation.replace('ReviewSubmitted', { loungeId });
      }
    } catch {
      Alert.alert(
        isEditMode ? "Couldn't update review" : "Couldn't submit review",
        'Check your connection and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.closeButton} onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back" hitSlop={8}>
          <X size={18} color={theme.colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit Review' : 'Write Review'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ---------------- Overall Rating ---------------- */}
        <View style={styles.overallSection}>
          <Text style={styles.overallLabel}>Rate Your Overall Experience</Text>
          <StarRating rating={overallRating} onChange={setOverallRating} size={34} />
        </View>

        {/* ---------------- Visit Date ---------------- */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Visit Date</Text>
          <View style={styles.dateRow}>
            <Text style={styles.dateText}>{formatToday()}</Text>
            <Calendar size={18} color={theme.colors.secondarySilver} />
          </View>
        </View>

        {/* ---------------- Would Return / Recommend ---------------- */}
        <View style={styles.toggleSectionRow}>
          <View style={styles.toggleField}>
            <Text style={styles.fieldLabel}>Would You Return?</Text>
            <View style={styles.toggleGroup}>
              <Pressable
                style={[styles.toggleButton, wouldReturn === true && styles.toggleButtonActive]}
                onPress={() => setWouldReturn(true)}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    wouldReturn === true && styles.toggleButtonTextActive,
                  ]}
                >
                  Yes
                </Text>
              </Pressable>
              <Pressable
                style={[styles.toggleButton, wouldReturn === false && styles.toggleButtonActive]}
                onPress={() => setWouldReturn(false)}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    wouldReturn === false && styles.toggleButtonTextActive,
                  ]}
                >
                  No
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.toggleField}>
            <Text style={styles.fieldLabel}>Recommend?</Text>
            <View style={styles.toggleGroup}>
              <Pressable
                style={[styles.toggleButton, recommend === true && styles.toggleButtonActive]}
                onPress={() => setRecommend(true)}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    recommend === true && styles.toggleButtonTextActive,
                  ]}
                >
                  Yes
                </Text>
              </Pressable>
              <Pressable
                style={[styles.toggleButton, recommend === false && styles.toggleButtonActive]}
                onPress={() => setRecommend(false)}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    recommend === false && styles.toggleButtonTextActive,
                  ]}
                >
                  No
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ---------------- Review Details ---------------- */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Review Details</Text>
          <TextInput
        accessibilityLabel="Tell others about the atmosphere, the cigar selection, and the service..."
            value={reviewText}
            onChangeText={setReviewText}
            placeholder="Tell others about the atmosphere, the cigar selection, and the service..."
            placeholderTextColor={theme.colors.mutedGray}
            style={styles.textArea}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {/* ---------------- Add Photos ---------------- */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Add Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.photoRow}>
              <Pressable
                style={styles.addPhotoSlot}
                onPress={() => navigation.navigate('UploadPhotos')}
              >
                <ImagePlus size={20} color={theme.colors.secondarySilver} />
                <Text style={styles.addPhotoLabel}>Add</Text>
              </Pressable>
              {photos.map((uri, index) => (
                <View key={index} style={styles.photoSlot}>
                  <Image source={{ uri }} style={styles.photoThumbnail} />
                  <Pressable
                    style={styles.removePhotoButton}
                    onPress={() => removePhoto(index)}
                    hitSlop={6}
                  >
                    <X size={11} color={theme.colors.white} />
                  </Pressable>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* ---------------- Detailed Ratings ---------------- */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Detailed Ratings</Text>
          <View style={styles.detailedRatingsList}>
            {detailedRatingCategories.map(category => (
              <View key={category} style={styles.detailedRatingRow}>
                <Text style={styles.detailedRatingLabel}>{category}</Text>
                <StarRating
                  rating={categoryScores[category] ?? 0}
                  onChange={score => setCategoryScore(category, score)}
                  size={16}
                />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={submitReview}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={theme.colors.primaryNavy} />
          ) : (
            <Text style={styles.submitButtonText}>
              {isEditMode ? 'Save Changes' : 'Submit Review'}
            </Text>
          )}
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardAvoider: {
    flex: 1,
  },

  // ---- Header ----
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(192, 192, 192, 0.15)',
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

  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.xl,
  },

  // ---- Overall rating ----
  overallSection: {
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  overallLabel: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.mutedGray,
  },

  // ---- Fields ----
  field: {
    gap: theme.spacing.sm,
  },
  fieldLabel: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.mutedGray,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surfaceNavy,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.15)',
  },
  dateText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },

  // ---- Would Return / Recommend ----
  toggleSectionRow: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
  },
  toggleField: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  toggleButton: {
    flex: 1,
    height: 44,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.secondarySilver,
    borderColor: theme.colors.secondarySilver,
  },
  toggleButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.secondarySilver,
  },
  toggleButtonTextActive: {
    color: theme.colors.primaryNavy,
  },

  // ---- Review text area ----
  textArea: {
    ...theme.typography.body,
    height: 140,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surfaceNavy,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.15)',
  },

  // ---- Photos ----
  photoRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  addPhotoSlot: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(192, 192, 192, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addPhotoLabel: {
    ...theme.typography.medium,
    fontSize: 11,
    color: theme.colors.secondarySilver,
  },
  photoSlot: {
    position: 'relative',
    width: 72,
    height: 72,
  },
  photoThumbnail: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.background,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Detailed ratings ----
  detailedRatingsList: {
    gap: theme.spacing.md,
  },
  detailedRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailedRatingLabel: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.white,
  },

  // ---- Submit (fixed footer) ----
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: TAB_BAR_SCROLL_CLEARANCE,
    backgroundColor: theme.colors.background,
  },
  submitButton: {
    height: 52,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 15,
    color: theme.colors.primaryNavy,
  },
});
