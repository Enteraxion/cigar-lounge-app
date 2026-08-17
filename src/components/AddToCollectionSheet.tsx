/**
 * AddToCollectionSheet
 *
 * Matches design-reference/Add to Collection Screen.pdf: a bottom sheet
 * for saving a lounge into one or more collections. Opened from the
 * bookmark icon on LoungeDetail and SearchResultCard (favoriting itself
 * is a separate heart-icon action — see FavoriteButton). Loads the real
 * signed-in user's collections via userActionsService.ts's
 * getUserCollections() each time the sheet opens (so a collection
 * created moments ago via CreateCollectionScreen shows up without a full
 * app reload), and "Confirm Selection" calls addLoungeToCollection() for
 * every selected collection.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Check, Plus, Search as SearchIcon, X } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import { auth } from '../services/firebaseAuth';
import { keyboardAwareScrollProps } from '../utils/keyboardAware';
import {
  addLoungeToCollection,
  getUserCollections,
  type UserCollection,
} from '../services/userActionsService';

type LoungePreview = {
  name: string;
  location: string;
  imageUri: string;
};

type Props = {
  visible: boolean;
  loungeId: string;
  lounge: LoungePreview;
  onClose: () => void;
  onCreateNew?: () => void;
};

export default function AddToCollectionSheet({
  visible,
  loungeId,
  lounge,
  onClose,
  onCreateNew,
}: Props) {
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [collections, setCollections] = useState<UserCollection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const userId = auth.currentUser?.uid;

  const load = useCallback(async () => {
    if (!userId) {
      setCollections([]);
      return;
    }
    setError(null);
    setCollections(null);
    try {
      setCollections(await getUserCollections(userId));
    } catch {
      setError("Couldn't load your collections.");
    }
  }, [userId]);

  useEffect(() => {
    if (visible) {
      setSelectedIds([]);
      setQuery('');
      load();
    }
  }, [visible, load]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(existing => existing !== id) : [...prev, id],
    );
  };

  const confirmSelection = async () => {
    if (!userId || selectedIds.length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await Promise.all(
        selectedIds.map(collectionId => addLoungeToCollection(userId, collectionId, loungeId)),
      );
      onClose();
    } catch {
      Alert.alert("Couldn't save", 'Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const filteredCollections = (collections ?? []).filter(collection =>
    collection.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={onClose} hitSlop={8}>
            <X size={18} color={theme.colors.white} />
          </Pressable>
          <Text style={styles.title}>Add to Collection</Text>
          <Pressable style={styles.iconButton} onPress={onCreateNew} hitSlop={8}>
            <Plus size={18} color={theme.colors.white} />
          </Pressable>
        </View>

        <View style={styles.loungePreview}>
          <Image source={{ uri: lounge.imageUri }} style={styles.loungeImage} />
          <View style={styles.loungeTextGroup}>
            <Text style={styles.loungeName} numberOfLines={1}>
              {lounge.name}
            </Text>
            <Text style={styles.loungeLocation} numberOfLines={1}>
              {lounge.location}
            </Text>
          </View>
        </View>

        <View style={styles.searchBar}>
          <SearchIcon size={16} color={theme.colors.mutedGray} />
          <TextInput
        accessibilityLabel="Search collections..."
            value={query}
            onChangeText={setQuery}
            placeholder="Search collections..."
            placeholderTextColor={theme.colors.mutedGray}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.listHeaderRow}>
          <Text style={styles.listHeaderLabel}>My Collections</Text>
        </View>

        {error ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={load}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </Pressable>
          </View>
        ) : collections === null ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={theme.colors.secondarySilver} />
          </View>
        ) : filteredCollections.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>
              {collections.length === 0
                ? "You don't have any collections yet."
                : 'No collections matched your search.'}
            </Text>
          </View>
        ) : (
          <ScrollView {...keyboardAwareScrollProps} style={styles.list} showsVerticalScrollIndicator={false}>
            {filteredCollections.map(collection => {
              const selected = selectedIds.includes(collection.id);
              return (
                <Pressable
                  key={collection.id}
                  style={[styles.collectionRow, selected && styles.collectionRowSelected]}
                  onPress={() => toggleSelection(collection.id)}
                >
                  <Image source={{ uri: collection.coverImage }} style={styles.collectionImage} />
                  <View style={styles.collectionTextGroup}>
                    <Text style={styles.collectionName} numberOfLines={1}>
                      {collection.name}
                    </Text>
                    <Text style={styles.collectionMeta}>
                      {collection.loungeIds.length} items •{' '}
                      {collection.isPrivate ? 'Private' : 'Public'}
                    </Text>
                  </View>
                  <View style={[styles.selectionCircle, selected && styles.selectionCircleSelected]}>
                    {selected ? <Check size={14} color={theme.colors.primaryBlack} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <Pressable
          style={[styles.confirmButton, saving && styles.confirmButtonDisabled]}
          onPress={confirmSelection}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.primaryBlack} />
          ) : (
            <Text style={styles.confirmButtonText}>Confirm Selection</Text>
          )}
        </Pressable>
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
    maxHeight: '85%',
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
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
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 17,
    color: theme.colors.white,
  },

  // ---- Lounge preview ----
  loungePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.large,
    backgroundColor: withAlpha(theme.colors.background, 0.4),
    marginBottom: theme.spacing.md,
  },
  loungeImage: {
    width: 56,
    height: 56,
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
    fontSize: 15,
    color: theme.colors.white,
  },
  loungeLocation: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },

  // ---- Search ----
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    height: 46,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: withAlpha(theme.colors.background, 0.4),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.15),
    marginBottom: theme.spacing.md,
  },
  searchInput: {
    ...theme.typography.body,
    flex: 1,
    fontSize: 14,
    color: theme.colors.white,
    padding: 0,
  },

  // ---- List header ----
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  listHeaderLabel: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.accentGold,
  },

  // ---- Loading / error / empty state ----
  stateBox: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.mutedGray,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  retryButton: {
    paddingHorizontal: theme.spacing.lg,
    height: 40,
    borderRadius: theme.radius.medium,
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.white,
  },

  // ---- Collection rows ----
  list: {
    marginBottom: theme.spacing.md,
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.large,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: theme.spacing.sm,
  },
  collectionRowSelected: {
    borderColor: theme.colors.white,
    backgroundColor: withAlpha(theme.colors.white, 0.06),
  },
  collectionImage: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.background,
  },
  collectionTextGroup: {
    flex: 1,
    gap: 2,
  },
  collectionName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.white,
  },
  collectionMeta: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },
  selectionCircle: {
    width: 26,
    height: 26,
    borderRadius: theme.radius.full,
    borderWidth: 2,
    borderColor: withAlpha(theme.colors.accentGold, 0.4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCircleSelected: {
    backgroundColor: theme.colors.accentGold,
    borderColor: theme.colors.white,
  },

  // ---- Footer ----
  confirmButton: {
    height: 52,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 15,
    color: theme.colors.primaryBlack,
  },
});
