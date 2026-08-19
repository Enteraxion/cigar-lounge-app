/**
 * AgeVerificationRequiredScreen
 *
 * Step 2 of the 21+ flow agreed with Dr. Brinkley (2026-08-19): the ID upload is
 * a required step immediately after sign-up. This replaces Main in the root
 * navigator rather than living inside it, so there is no tab bar to escape
 * through and nothing to skip.
 *
 * Distinct from AgeVerificationScreen, which is the same job reached
 * voluntarily from Profile later. This one is a wall, so it carries the things a
 * wall needs and that one does not: no back button, an explanation of why it is
 * here, and a sign-out so a member is never actually trapped.
 *
 * The date of birth has already been accepted at sign-up — an under-21 date is
 * refused before an account exists — so this screen never has to judge age. It
 * only collects the evidence.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { IdCard, ShieldCheck } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import { auth, signOut } from '../services/firebaseAuth';
import { uploadImage } from '../services/storageService';
import { attachIdImage } from '../services/ageVerificationService';
import { MINIMUM_AGE } from '../utils/ageCheck';
import { keyboardAwareScrollProps } from '../utils/keyboardAware';

export default function AgeVerificationRequiredScreen({
  onSubmitted,
}: {
  /** Re-reads the verification record, which drops this wall once an ID exists. */
  onSubmitted: () => void;
}) {
  const userId = auth.currentUser?.uid;
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [localUri, setLocalUri] = useState<string | null>(null);

  const upload = async (uri: string) => {
    if (!userId) {
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const url = await uploadImage(userId, uri, 'age-verification', setProgress);
      await attachIdImage(userId, url);
      onSubmitted();
    } catch {
      // Retryable, not a dead end. The most common cause is a dropped
      // connection mid-upload, and this member cannot reach the app until it
      // succeeds — so the message has to invite another attempt.
      Alert.alert("Couldn't upload that", 'Check your connection and try again.');
      setLocalUri(null);
    } finally {
      setUploading(false);
    }
  };

  const pickId = () => {
    launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 }, response => {
      if (response.didCancel) {
        return;
      }
      if (response.errorCode) {
        Alert.alert(
          "Couldn't open photo library",
          response.errorCode === 'permission'
            ? 'Allow photo library access in Settings to choose a photo of your ID.'
            : response.errorMessage ?? 'Something went wrong.',
        );
        return;
      }
      const uri = response.assets?.[0]?.uri;
      if (!uri) {
        return;
      }
      setLocalUri(uri);
      upload(uri);
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView {...keyboardAwareScrollProps} contentContainerStyle={styles.content}>
        <View style={styles.badge}>
          <ShieldCheck size={28} color={theme.colors.accentGold} />
        </View>

        <Text style={styles.title}>One last step</Text>
        <Text style={styles.body}>
          Lounge Locator is for members aged {MINIMUM_AGE} and over. To finish setting up your
          account, upload a photo of your passport or driving licence so our team can confirm
          your date of birth.
        </Text>

        <View style={styles.explainer}>
          <Text style={styles.explainerText}>
            The photo is reviewed by a person on our team and used only to check your age. You
            can replace it at any time from your profile.
          </Text>
        </View>

        {localUri ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: localUri }} style={styles.preview} resizeMode="cover" />
            {uploading ? (
              <View style={styles.previewOverlay}>
                <ActivityIndicator color={theme.colors.accentGold} />
                <Text style={styles.previewOverlayText}>
                  Uploading {Math.round(progress * 100)}%
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Pressable
          style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
          onPress={pickId}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color={theme.colors.primaryBlack} />
          ) : (
            <>
              <IdCard size={18} color={theme.colors.primaryBlack} />
              <Text style={styles.uploadButtonText}>
                {localUri ? 'Choose a different photo' : 'Upload photo of ID'}
              </Text>
            </>
          )}
        </Pressable>

        {/* A wall with no exit is hostile. Signing out is not a way past the
            check — the requirement is still there next time they sign in — but
            it means nobody is stuck in the app with no route out. */}
        <Pressable
          style={styles.signOutButton}
          onPress={() => signOut(auth).catch(() => {})}
          disabled={uploading}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(theme.colors.surface, 0.6),
    borderWidth: 1,
    borderColor: theme.gold.line,
    marginBottom: theme.spacing.sm,
  },
  title: {
    ...theme.typography.headingMedium,
    fontSize: 24,
    color: theme.colors.white,
    textAlign: 'center',
  },
  body: {
    ...theme.typography.body,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.secondarySilver,
    textAlign: 'center',
  },
  explainer: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.gold.wash,
    borderWidth: 1,
    borderColor: theme.gold.line,
  },
  explainerText: {
    ...theme.typography.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.secondarySilver,
    textAlign: 'center',
  },
  previewWrap: {
    width: '100%',
    borderRadius: theme.radius.large,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.gold.line,
  },
  preview: { width: '100%', height: 180 },
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: withAlpha(theme.colors.background, 0.7),
  },
  previewOverlayText: { ...theme.typography.medium, fontSize: 13, color: theme.colors.white },
  uploadButton: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.accentGold,
  },
  uploadButtonDisabled: { opacity: 0.7 },
  uploadButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.primaryBlack,
  },
  signOutButton: { paddingVertical: theme.spacing.md },
  signOutText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.mutedGray,
    textDecorationLine: 'underline',
  },
});
