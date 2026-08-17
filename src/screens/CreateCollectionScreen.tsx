/**
 * CreateCollectionScreen
 *
 * Matches design-reference/Create Collection Screen.pdf: a tappable cover
 * photo area, name/description fields, a single-select category chip
 * row, a privacy toggle card, and a full-width submit button. Opened
 * from CollectionsGrid's "+ New Folder" card (and from AddToCollectionSheet's
 * "+" icon). Tapping the cover area opens the real photo library
 * (react-native-image-picker); the picked photo shows as a local preview
 * immediately and uploads to Firebase Storage in the background
 * (src/services/storageService.ts, under users/{uid}/collections/) with
 * a progress overlay. Submitting calls userActionsService.ts's
 * createCollection() with the real signed-in user's uid and the
 * uploaded cover's Storage URL, and only navigates back once the write
 * succeeds — it also blocks submission while the cover is still
 * uploading, since the collection doc needs a real URL, not a local
 * file:// one.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { launchImageLibrary } from 'react-native-image-picker';
import { Camera, ChevronLeft, Lock, Plus } from 'lucide-react-native';
import { theme } from '../theme';
import { loungeInteriors } from '../data/mockImages';
import { collectionCategories } from '../data/mockCollections';
import { createCollection as createCollectionInFirestore } from '../services/userActionsService';
import { uploadImage } from '../services/storageService';
import { auth } from '../services/firebaseAuth';
import type { SavedStackParamList } from '../navigation/SavedNavigator';

type CreateCollectionNavigationProp = NativeStackNavigationProp<SavedStackParamList>;

const DEFAULT_COVER_IMAGE = loungeInteriors[0];

export default function CreateCollectionScreen() {
  const navigation = useNavigation<CreateCollectionNavigationProp>();

  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverRemoteUrl, setCoverRemoteUrl] = useState<string | null>(null);
  const [coverProgress, setCoverProgress] = useState(0);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Speakeasy');
  const [isPrivate, setIsPrivate] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const uploadCover = async (localUri: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setCoverError('You need to be signed in to upload photos.');
      return;
    }
    setCoverUploading(true);
    setCoverError(null);
    setCoverProgress(0);
    try {
      const url = await uploadImage(userId, localUri, 'collections', setCoverProgress);
      setCoverRemoteUrl(url);
    } catch {
      setCoverError('Upload failed — check your connection.');
    } finally {
      setCoverUploading(false);
    }
  };

  const pickCoverImage = () => {
    launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 }, response => {
      if (response.didCancel) return;
      if (response.errorCode) {
        Alert.alert(
          "Couldn't open photo library",
          response.errorCode === 'permission'
            ? 'Allow photo library access in Settings to choose a cover photo.'
            : response.errorMessage ?? 'Something went wrong.',
        );
        return;
      }
      const uri = response.assets?.[0]?.uri;
      if (!uri) return;
      setCoverImage(uri);
      setCoverRemoteUrl(null);
      uploadCover(uri);
    });
  };

  const createCollection = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert("Couldn't create collection", 'You need to be signed in to do that.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Name required', 'Give your collection a name before saving.');
      return;
    }
    if (coverUploading) {
      Alert.alert('Still uploading', 'Wait for your cover photo to finish uploading.');
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    try {
      await createCollectionInFirestore(userId, {
        name: name.trim(),
        description: description.trim(),
        coverImage: coverRemoteUrl ?? DEFAULT_COVER_IMAGE,
        category,
        isPrivate,
      });
      navigation.goBack();
    } catch {
      Alert.alert("Couldn't create collection", 'Check your connection and try again.');
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
        <Text style={styles.headerTitle}>New Collection</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ---------------- Cover Photo ---------------- */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Collection Cover</Text>
          <Pressable style={styles.coverArea} onPress={pickCoverImage}>
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.coverImage} />
            ) : null}
            {coverUploading ? (
              <View style={styles.coverOverlay}>
                <ActivityIndicator color={theme.colors.white} />
                <Text style={styles.coverOverlayLabel}>{Math.round(coverProgress * 100)}%</Text>
              </View>
            ) : coverError ? (
              <View style={styles.coverOverlay}>
                <Text style={styles.coverOverlayLabel}>{coverError}</Text>
                <Text style={styles.coverRetryLabel}>Tap to try again</Text>
              </View>
            ) : (
              <View style={styles.coverOverlay}>
                <View style={styles.coverIconCircle}>
                  <Camera size={22} color={theme.colors.primaryNavy} />
                </View>
                <Text style={styles.coverOverlayLabel}>
                  {coverRemoteUrl ? 'Change Photo' : 'Add Photo'}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* ---------------- Name ---------------- */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Collection Name</Text>
          <TextInput
        accessibilityLabel="e.g. London Weekend Spots"
            value={name}
            onChangeText={setName}
            placeholder="e.g. London Weekend Spots"
            placeholderTextColor={theme.colors.mutedGray}
            style={styles.textInput}
          />
        </View>

        {/* ---------------- Description ---------------- */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
        accessibilityLabel="Tell more about this collection..."
            value={description}
            onChangeText={setDescription}
            placeholder="Tell more about this collection..."
            placeholderTextColor={theme.colors.mutedGray}
            style={styles.textArea}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        {/* ---------------- Category ---------------- */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.categoryRow}>
            {collectionCategories.map(item => (
              <Pressable
                key={item}
                style={[styles.categoryChip, category === item && styles.categoryChipActive]}
                onPress={() => setCategory(item)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    category === item && styles.categoryChipTextActive,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ---------------- Privacy ---------------- */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Privacy</Text>
          <View style={styles.privacyCard}>
            <View style={styles.privacyIconBox}>
              <Lock size={16} color={theme.colors.accentGold} />
            </View>
            <View style={styles.privacyTextGroup}>
              <Text style={styles.privacyTitle}>Private Folder</Text>
              <Text style={styles.privacySubtitle}>Only you can see this</Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: theme.colors.surfaceNavy, true: theme.colors.secondarySilver }}
              thumbColor={theme.colors.white}
            />
          </View>
        </View>

        <Pressable
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={createCollection}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={theme.colors.primaryNavy} />
          ) : (
            <>
              <Text style={styles.submitButtonText}>Create Collection</Text>
              <Plus size={18} color={theme.colors.primaryNavy} />
            </>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
  backButton: {
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

  // ---- Fields ----
  field: {
    gap: theme.spacing.sm,
  },
  fieldLabel: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.mutedGray,
  },

  // ---- Cover photo ----
  coverArea: {
    height: 180,
    borderRadius: theme.radius.large,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceNavy,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.2)',
  },
  coverImage: {
    ...StyleSheet.absoluteFill,
  },
  coverOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: 'rgba(5, 10, 24, 0.35)',
  },
  coverIconCircle: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverOverlayLabel: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  coverRetryLabel: {
    ...theme.typography.caption,
    fontSize: 11,
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.accentGold,
  },

  // ---- Text inputs ----
  textInput: {
    ...theme.typography.body,
    height: 50,
    fontSize: 14,
    color: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surfaceNavy,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.15)',
  },
  textArea: {
    ...theme.typography.body,
    height: 120,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surfaceNavy,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.15)',
  },

  // ---- Category ----
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: theme.spacing.md,
    height: 40,
    justifyContent: 'center',
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.3)',
  },
  categoryChipActive: {
    backgroundColor: theme.colors.secondarySilver,
    borderColor: theme.colors.secondarySilver,
  },
  categoryChipText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.secondarySilver,
  },
  categoryChipTextActive: {
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.primaryNavy,
  },

  // ---- Privacy ----
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
  },
  privacyIconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyTextGroup: {
    flex: 1,
    gap: 2,
  },
  privacyTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.white,
  },
  privacySubtitle: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },

  // ---- Submit ----
  submitButton: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.white,
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
