/**
 * UploadPhotosScreen
 *
 * Matches the top half of design-reference/Photo Upload & Review
 * Submitted.pdf: a category selector, a grid of photo upload slots, and
 * Done/Cancel actions. Opened from Write Review's "Add" slot. "Add" opens
 * the real photo library (react-native-image-picker) — each selected
 * photo shows its local preview immediately and uploads to Firebase
 * Storage in the background (src/services/storageService.ts) under
 * users/{uid}/reviews/, with a live progress bar; the local preview is
 * swapped for the real hosted URL once the upload resolves. "Done" only
 * passes back photos that finished uploading (via route params to Write
 * Review) — a still-uploading or failed slot is silently dropped rather
 * than handing Write Review a local file:// URI that won't outlive this
 * device.
 */

import React, { useState } from 'react';
import { Alert, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { launchImageLibrary } from 'react-native-image-picker';
import { Check, ChevronLeft, Plus, X } from 'lucide-react-native';
import { theme } from '../theme';
import { auth } from '../services/firebaseAuth';
import { uploadImage } from '../services/storageService';
import type { SearchStackParamList } from '../navigation/SearchNavigator';
import { TAB_BAR_SCROLL_CLEARANCE } from '../utils/tabBarLayout';

type UploadPhotosNavigationProp = NativeStackNavigationProp<SearchStackParamList>;

const CATEGORIES = [
  'Interior', 'Humidor', 'Patio', 'Food', 'Drinks', 'Events', 'Bar', 'Private Lounge',
];

const MAX_PHOTOS = 6;

const TILE_SIZE = (Dimensions.get('window').width - theme.spacing.lg * 2 - theme.spacing.md) / 2;

type PhotoSlot = {
  id: string;
  localUri: string;
  remoteUrl: string | null;
  progress: number;
  error: string | null;
};

export default function UploadPhotosScreen() {
  const navigation = useNavigation<UploadPhotosNavigationProp>();

  const [category, setCategory] = useState('Interior');
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);

  const updatePhoto = (id: string, patch: Partial<PhotoSlot>) => {
    setPhotos(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));
  };

  const uploadOne = async (id: string, localUri: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      updatePhoto(id, { error: 'You need to be signed in to upload photos.' });
      return;
    }
    try {
      const url = await uploadImage(userId, localUri, 'reviews', fraction =>
        updatePhoto(id, { progress: fraction }),
      );
      updatePhoto(id, { remoteUrl: url, progress: 1 });
    } catch {
      updatePhoto(id, { error: "Upload failed — check your connection." });
    }
  };

  const addMorePhoto = () => {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;

    launchImageLibrary({ mediaType: 'photo', selectionLimit: remaining }, response => {
      if (response.didCancel) return;
      if (response.errorCode) {
        Alert.alert(
          "Couldn't open photo library",
          response.errorCode === 'permission'
            ? 'Allow photo library access in Settings to add photos.'
            : response.errorMessage ?? 'Something went wrong.',
        );
        return;
      }
      const assets = (response.assets ?? []).filter(asset => asset.uri);
      const newSlots: PhotoSlot[] = assets.map((asset, index) => ({
        id: `${Date.now()}-${index}`,
        localUri: asset.uri as string,
        remoteUrl: null,
        progress: 0,
        error: null,
      }));
      setPhotos(prev => [...prev, ...newSlots]);
      newSlots.forEach(slot => uploadOne(slot.id, slot.localUri));
    });
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  const retryPhoto = (id: string) => {
    const photo = photos.find(p => p.id === id);
    if (!photo) return;
    updatePhoto(id, { error: null, progress: 0 });
    uploadOne(id, photo.localUri);
  };

  const done = () => {
    const stillUploading = photos.some(p => !p.remoteUrl && !p.error);
    if (stillUploading) {
      Alert.alert('Still uploading', 'Wait for your photos to finish uploading before continuing.');
      return;
    }
    const uploadedUrls = photos.filter(p => p.remoteUrl).map(p => p.remoteUrl as string);
    navigation.navigate({
      name: 'WriteReview',
      params: { selectedPhotos: uploadedUrls },
      merge: true,
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back" hitSlop={12}>
          <ChevronLeft size={24} color={theme.colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Upload Photos</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ---------------- Select Category ---------------- */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Select Category</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map(item => (
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

        {/* ---------------- Photo Grid ---------------- */}
        <View style={styles.photoGrid}>
          {photos.map(photo => (
            <View key={photo.id} style={styles.photoTile}>
              <Image source={{ uri: photo.localUri }} style={styles.photoImage} />
              <Pressable
                style={styles.removeButton}
                onPress={() => removePhoto(photo.id)}
                hitSlop={6}
              >
                <X size={12} color={theme.colors.white} />
              </Pressable>
              {photo.error ? (
                <Pressable style={styles.errorOverlay} onPress={() => retryPhoto(photo.id)}>
                  <Text style={styles.errorOverlayText}>{photo.error}</Text>
                  <Text style={styles.retryLabel}>Tap to retry</Text>
                </Pressable>
              ) : !photo.remoteUrl ? (
                <>
                  <View style={styles.photoProgressTrack}>
                    <View
                      style={[styles.photoProgressFill, { width: `${photo.progress * 100}%` }]}
                    />
                  </View>
                  <View style={styles.progressBadge}>
                    <Text style={styles.progressBadgeText}>{Math.round(photo.progress * 100)}%</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.photoOverlayLabel}>UPLOADED</Text>
              )}
            </View>
          ))}

          {photos.length < MAX_PHOTOS ? (
            <Pressable style={styles.addMoreTile} onPress={addMorePhoto}>
              <View style={styles.addMoreIcon}>
                <Plus size={18} color={theme.colors.secondarySilver} />
              </View>
              <Text style={styles.addMoreLabel}>Add Photo</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.doneButton} onPress={done}>
          <Text style={styles.doneButtonText}>Done</Text>
          <Check size={16} color={theme.colors.primaryNavy} />
        </Pressable>
        <Pressable style={styles.cancelButton} onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back" hitSlop={8}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </View>
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
  headerTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 17,
    color: theme.colors.white,
  },
  headerSpacer: {
    width: 24,
  },

  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.xl,
  },

  // ---- Category ----
  field: {
    gap: theme.spacing.sm,
  },
  fieldLabel: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.mutedGray,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
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

  // ---- Photo grid ----
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  photoTile: {
    position: 'relative',
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: theme.radius.large,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceNavy,
  },
  photoImage: {
    ...StyleSheet.absoluteFill,
  },
  photoProgressTrack: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    right: theme.spacing.sm,
    height: 3,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    overflow: 'hidden',
  },
  photoProgressFill: {
    height: 3,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentGold,
  },
  photoOverlayLabel: {
    position: 'absolute',
    bottom: theme.spacing.sm,
    left: theme.spacing.sm,
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.white,
  },
  progressBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.radius.small,
    backgroundColor: 'rgba(5, 10, 24, 0.7)',
  },
  progressBadgeText: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.white,
  },
  removeButton: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    width: 20,
    height: 20,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(5, 10, 24, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: theme.spacing.sm,
    backgroundColor: 'rgba(5, 10, 24, 0.75)',
  },
  errorOverlayText: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.white,
    textAlign: 'center',
  },
  retryLabel: {
    ...theme.typography.caption,
    fontSize: 10,
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.accentGold,
  },
  addMoreTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: theme.radius.large,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(192, 192, 192, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  addMoreIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(192, 192, 192, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreLabel: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.secondarySilver,
  },

  // ---- Footer ----
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: TAB_BAR_SCROLL_CLEARANCE,
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  doneButton: {
    width: '100%',
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.white,
  },
  doneButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 15,
    color: theme.colors.primaryNavy,
  },
  cancelButton: {
    paddingVertical: theme.spacing.xs,
  },
  cancelButtonText: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.mutedGray,
  },
});
