/**
 * EditProfileScreen
 *
 * Matches the app's existing edit-form design system (see
 * CreateCollectionScreen for the same tappable-photo + text-field +
 * submit-button pattern). Reached from ProfileScreen's "Edit Profile"
 * button. Editable fields: profile photo, name, home city, favorite
 * brand, favorite lounge — all three autocomplete as you type (Julian
 * Brinkley's TestFlight feedback, 2026-08-13: "should auto complete. If
 * any can't be found in our database the user should be able to add
 * them") via the local AutocompleteField below, but none force a
 * selection — whatever's typed is what gets saved, matching that ask.
 * Home City suggests from src/utils/cityAutocomplete.ts's real US +
 * international city dataset; Favorite Brand suggests from
 * src/data/cigarBrands.ts's curated real-brand reference list (no
 * Firestore-backed brand data exists anywhere in this app yet — see that
 * file's header comment); Favorite Lounge suggests from real Firestore
 * lounges via loungeService.searchLounges, debounced since that's a full
 * collection read.
 *
 * Saving writes to two places:
 *  - Firebase Auth (updateProfile: displayName/photoURL) — the source of
 *    truth for identity, read back by useUserProfile.ts.
 *  - Firestore users/{userId} (setDoc with merge: true, via
 *    userActionsService.ts's updateUserProfile()) — works whether the
 *    doc already exists or is being created for the first time, since
 *    real sign-ups never get one created automatically.
 *
 * The photo picker + upload flow mirrors CreateCollectionScreen's cover
 * photo exactly: local preview immediately, upload to Firebase Storage
 * in the background (src/services/storageService.ts, under
 * users/{uid}/profile/) with a progress/error overlay, and Save blocks
 * until that upload resolves.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { launchImageLibrary } from 'react-native-image-picker';
import { Camera, Check, ChevronLeft, User } from 'lucide-react-native';
import { updateProfile } from '@react-native-firebase/auth';
import { theme, withAlpha } from '../theme';
import { auth } from '../services/firebaseAuth';
import { getUserProfile, updateUserProfile } from '../services/userActionsService';
import { uploadImage } from '../services/storageService';
import { searchLounges } from '../services/loungeService';
import { searchUsCities } from '../utils/cityAutocomplete';
import { CIGAR_BRANDS } from '../data/cigarBrands';
import type { ProfileStackParamList } from '../navigation/ProfileNavigator';

type EditProfileNavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

/**
 * A text field with a tap-to-fill suggestion dropdown underneath — never
 * forces a selection, so whatever's typed is always what gets saved even
 * if it matches nothing (see this screen's header comment).
 */
function AutocompleteField({
  label,
  value,
  onChangeText,
  placeholder,
  suggestions,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  suggestions: string[];
}) {
  const [focused, setFocused] = useState(false);
  const showSuggestions = focused && value.trim().length > 0 && suggestions.length > 0;

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        // Delay hiding so a tap on a suggestion row below registers first.
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.mutedGray}
        style={styles.textInput}
      />
      {showSuggestions && (
        <View style={styles.suggestionList}>
          {suggestions.map(suggestion => (
            <Pressable
              key={suggestion}
              style={styles.suggestionRow}
              onPress={() => {
                onChangeText(suggestion);
                setFocused(false);
              }}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default function EditProfileScreen() {
  const navigation = useNavigation<EditProfileNavigationProp>();
  const authUser = auth.currentUser;

  const [name, setName] = useState(authUser?.displayName ?? '');
  const [homeCity, setHomeCity] = useState('');
  const [favoriteBrand, setFavoriteBrand] = useState('');
  const [favoriteLounge, setFavoriteLounge] = useState('');

  const [avatarUri, setAvatarUri] = useState<string | null>(authUser?.photoURL ?? null);
  const [avatarRemoteUrl, setAvatarRemoteUrl] = useState<string | null>(authUser?.photoURL ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const citySuggestions = useMemo(
    () => searchUsCities(homeCity, 6).map(city => city.name),
    [homeCity],
  );
  const brandSuggestions = useMemo(() => {
    const query = favoriteBrand.trim().toLowerCase();
    if (!query) return [];
    return CIGAR_BRANDS.filter(brand => brand.toLowerCase().includes(query)).slice(0, 6);
  }, [favoriteBrand]);

  // Debounced — searchLounges reads the whole `lounges` collection
  // (thousands of docs), so this shouldn't fire on every keystroke.
  const [loungeSuggestions, setLoungeSuggestions] = useState<string[]>([]);
  useEffect(() => {
    const query = favoriteLounge.trim();
    if (!query) {
      setLoungeSuggestions([]);
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(() => {
      searchLounges(query).then(lounges => {
        if (!cancelled) {
          setLoungeSuggestions(lounges.slice(0, 6).map(lounge => lounge.name));
        }
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [favoriteLounge]);

  useEffect(() => {
    if (!authUser) return;
    getUserProfile(authUser.uid)
      .then(profile => {
        if (!profile) return;
        setHomeCity(profile.homeCity ?? '');
        setFavoriteBrand(profile.favoriteBrand ?? '');
        setFavoriteLounge(profile.favoriteLounge ?? '');
        if (!authUser.photoURL && profile.avatarUrl) {
          setAvatarUri(profile.avatarUrl);
          setAvatarRemoteUrl(profile.avatarUrl);
        }
      })
      .catch(() => {
        // Fields just stay empty — not worth blocking the edit form over
        // a failed prefill read.
      });
  }, [authUser]);

  const uploadAvatar = async (localUri: string) => {
    if (!authUser) return;
    setAvatarUploading(true);
    setAvatarError(null);
    setAvatarProgress(0);
    try {
      const url = await uploadImage(authUser.uid, localUri, 'profile', setAvatarProgress);
      setAvatarRemoteUrl(url);
    } catch (error) {
      console.error('Avatar upload failed', error);
      const code = (error as { code?: string })?.code;
      setAvatarError(
        code === 'storage/unauthorized'
          ? "Upload failed — you don't have permission to save a photo."
          : 'Upload failed — check your connection.',
      );
    } finally {
      setAvatarUploading(false);
    }
  };

  const pickAvatar = () => {
    launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 }, response => {
      if (response.didCancel) return;
      if (response.errorCode) {
        Alert.alert(
          "Couldn't open photo library",
          response.errorCode === 'permission'
            ? 'Allow photo library access in Settings to choose a profile photo.'
            : response.errorMessage ?? 'Something went wrong.',
        );
        return;
      }
      const uri = response.assets?.[0]?.uri;
      if (!uri) return;
      setAvatarUri(uri);
      setAvatarRemoteUrl(null);
      uploadAvatar(uri);
    });
  };

  const save = async () => {
    if (!authUser) {
      Alert.alert("Couldn't save", 'You need to be signed in to do that.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Name required', 'Enter your name before saving.');
      return;
    }
    if (avatarUploading) {
      Alert.alert('Still uploading', 'Wait for your profile photo to finish uploading.');
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    try {
      await updateProfile(authUser, {
        displayName: name.trim(),
        ...(avatarRemoteUrl ? { photoURL: avatarRemoteUrl } : null),
      });
      await updateUserProfile(authUser.uid, {
        name: name.trim(),
        email: authUser.email ?? '',
        avatarUrl: avatarRemoteUrl ?? '',
        homeCity: homeCity.trim(),
        favoriteBrand: favoriteBrand.trim(),
        favoriteLounge: favoriteLounge.trim(),
      });
      navigation.goBack();
    } catch {
      Alert.alert("Couldn't save profile", 'Check your connection and try again.');
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
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ---------------- Profile Photo ---------------- */}
        <View style={styles.avatarField}>
          <Pressable style={styles.avatarArea} onPress={pickAvatar}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
                <User size={40} color={theme.colors.secondarySilver} />
              </View>
            )}
            <View style={styles.avatarOverlay}>
              {avatarUploading ? (
                <>
                  <ActivityIndicator color={theme.colors.white} />
                  <Text style={styles.avatarOverlayLabel}>{Math.round(avatarProgress * 100)}%</Text>
                </>
              ) : avatarError ? (
                <>
                  <Text style={styles.avatarOverlayLabel}>{avatarError}</Text>
                  <Text style={styles.avatarRetryLabel}>Tap to try again</Text>
                </>
              ) : (
                <View style={styles.avatarIconCircle}>
                  <Camera size={18} color={theme.colors.primaryBlack} />
                </View>
              )}
            </View>
          </Pressable>
        </View>

        {/* ---------------- Name ---------------- */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
        accessibilityLabel="Your name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={theme.colors.mutedGray}
            style={styles.textInput}
          />
        </View>

        {/* ---------------- Home City ---------------- */}
        <AutocompleteField
          label="Home City"
          value={homeCity}
          onChangeText={setHomeCity}
          placeholder="e.g. New York, NY"
          suggestions={citySuggestions}
        />

        {/* ---------------- Favorite Brand ---------------- */}
        <AutocompleteField
          label="Favorite Brand"
          value={favoriteBrand}
          onChangeText={setFavoriteBrand}
          placeholder="e.g. Padrón"
          suggestions={brandSuggestions}
        />

        {/* ---------------- Favorite Lounge ---------------- */}
        <AutocompleteField
          label="Favorite Lounge"
          value={favoriteLounge}
          onChangeText={setFavoriteLounge}
          placeholder="e.g. The Heritage Oak Room"
          suggestions={loungeSuggestions}
        />

        <Pressable
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={save}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={theme.colors.primaryBlack} />
          ) : (
            <>
              <Text style={styles.submitButtonText}>Save Changes</Text>
              <Check size={18} color={theme.colors.primaryBlack} />
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

  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.xl,
  },

  // ---- Avatar ----
  avatarField: {
    alignItems: 'center',
  },
  avatarArea: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.secondarySilver, 0.2),
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: withAlpha(theme.colors.background, 0.35),
  },
  avatarOverlayLabel: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 12,
    color: theme.colors.white,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  avatarRetryLabel: {
    ...theme.typography.caption,
    fontSize: 10,
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.accentGold,
  },
  avatarIconCircle: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
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
  textInput: {
    ...theme.typography.body,
    height: 50,
    fontSize: 14,
    color: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.secondarySilver, 0.15),
  },

  // ---- Autocomplete suggestions ----
  suggestionList: {
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.secondarySilver, 0.15),
    overflow: 'hidden',
  },
  suggestionRow: {
    height: 42,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: withAlpha(theme.colors.secondarySilver, 0.1),
  },
  suggestionText: {
    ...theme.typography.body,
    fontSize: 13,
    color: theme.colors.secondarySilver,
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
    color: theme.colors.primaryBlack,
  },
});
