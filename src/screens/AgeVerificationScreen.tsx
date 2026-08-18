/**
 * AgeVerificationScreen
 *
 * Where a member supplies the ID that backs the 21+ gate. Requested by
 * Dr. Brinkley in the 2026-08-17 demo — the date of birth is already checked at
 * sign-up (src/utils/ageCheck.ts), and this is the evidence a human reviews.
 *
 * Reached from the Profile card, which only appears while there is something to
 * do: a member who is already verified has no reason to be sent here.
 *
 * The screen is deliberately plain about what happens to the image, because
 * "upload a photo of your passport" is a large ask and a vague screen makes it
 * larger. It says who sees it, what it is used for, and that it can be replaced.
 */

import React, { useCallback, useState } from 'react';
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { launchImageLibrary } from 'react-native-image-picker';
import { CheckCircle2, ChevronLeft, Clock, IdCard, ShieldCheck, XCircle } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import { auth } from '../services/firebaseAuth';
import { uploadImage } from '../services/storageService';
import {
  attachIdImage,
  getAgeVerification,
} from '../services/ageVerificationService';
import type { AgeVerification } from '../types/firestore';
import { fromIsoDate, MINIMUM_AGE } from '../utils/ageCheck';
import type { ProfileStackParamList } from '../navigation/ProfileNavigator';
import { TAB_BAR_SCROLL_CLEARANCE } from '../utils/tabBarLayout';
import { keyboardAwareScrollProps } from '../utils/keyboardAware';

type Nav = NativeStackNavigationProp<ProfileStackParamList>;

/** What the member is told, per status. */
const STATUS_COPY = {
  pending: {
    title: 'Awaiting review',
    body: 'Your ID is with our team. This is usually quick — we’ll notify you here as soon as it’s checked.',
  },
  verified: {
    title: 'Verified',
    body: 'Your age has been confirmed. Nothing else is needed.',
  },
  rejected: {
    title: 'We couldn’t verify this',
    body: 'The ID we received couldn’t be confirmed. You can send a clearer photo below.',
  },
} as const;

export default function AgeVerificationScreen() {
  const navigation = useNavigation<Nav>();
  const userId = auth.currentUser?.uid;

  const [verification, setVerification] = useState<AgeVerification | null | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [localUri, setLocalUri] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!userId) {
      setVerification(null);
      return;
    }
    getAgeVerification(userId)
      .then(setVerification)
      .catch(() => setVerification(null));
  }, [userId]);

  // Refetched on focus so a decision made while the app is open is reflected
  // without a restart — the same reason My Shops does it.
  useFocusEffect(load);

  const upload = async (uri: string) => {
    if (!userId) {
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const url = await uploadImage(userId, uri, 'age-verification', setProgress);
      await attachIdImage(userId, url);
      load();
      Alert.alert(
        'ID received',
        'Thanks — our team will review it and you’ll get a notification here.',
      );
    } catch {
      // Kept as a retryable failure rather than a dead end: the most common
      // cause is a dropped connection mid-upload.
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

  const status = verification?.status;
  const copy = status ? STATUS_COPY[status] : null;
  const born = verification?.dateOfBirth ? fromIsoDate(verification.dateOfBirth) : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
        >
          <ChevronLeft size={24} color={theme.colors.white} />
        </Pressable>
        <Text style={styles.title}>Age Verification</Text>
      </View>

      {verification === undefined ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.colors.secondarySilver} />
        </View>
      ) : (
        <ScrollView {...keyboardAwareScrollProps} contentContainerStyle={styles.content}>
          {/* Status first — a member arriving here wants to know where they
              stand before they are asked to do anything. */}
          {copy ? (
            <View style={styles.statusCard}>
              <View style={styles.statusIcon}>
                {status === 'verified' ? (
                  <CheckCircle2 size={20} color={theme.colors.accentGold} />
                ) : status === 'rejected' ? (
                  <XCircle size={20} color={theme.colors.danger} />
                ) : (
                  <Clock size={20} color={theme.colors.accentGold} />
                )}
              </View>
              <View style={styles.statusText}>
                <Text style={styles.statusTitle}>{copy.title}</Text>
                <Text style={styles.statusBody}>
                  {status === 'rejected' && verification?.rejectionReason
                    ? verification.rejectionReason
                    : copy.body}
                </Text>
              </View>
            </View>
          ) : null}

          {born ? (
            <View style={styles.dobRow}>
              <Text style={styles.dobLabel}>Date of birth on file</Text>
              <Text style={styles.dobValue}>{verification?.dateOfBirth}</Text>
            </View>
          ) : null}

          {/* Why we're asking, and what happens to the photo. An unexplained
              request for a passport photo is one people are right to refuse. */}
          <View style={styles.explainer}>
            <ShieldCheck size={18} color={theme.colors.accentGold} />
            <Text style={styles.explainerText}>
              This app is for members aged {MINIMUM_AGE} and over. A photo of a passport or
              driving licence lets our team confirm your date of birth. It is reviewed by a
              person on our team, used only to check your age, and you can replace it at any
              time.
            </Text>
          </View>

          {verification?.idImageUrl || localUri ? (
            <View style={styles.previewWrap}>
              <Image
                source={{ uri: localUri ?? verification?.idImageUrl }}
                style={styles.preview}
                resizeMode="cover"
              />
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

          {status !== 'verified' ? (
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
                    {verification?.idImageUrl ? 'Replace photo of ID' : 'Upload photo of ID'}
                  </Text>
                </>
              )}
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  title: { ...theme.typography.headingMedium, fontSize: 18, color: theme.colors.white },
  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: TAB_BAR_SCROLL_CLEARANCE,
    gap: theme.spacing.lg,
  },
  statusCard: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.gold.line,
  },
  statusIcon: { paddingTop: 2 },
  statusText: { flex: 1, gap: 4 },
  statusTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.white,
  },
  statusBody: {
    ...theme.typography.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.secondarySilver,
  },
  dobRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dobLabel: { ...theme.typography.caption, fontSize: 10, color: theme.colors.accentGold },
  dobValue: { ...theme.typography.medium, fontSize: 14, color: theme.colors.white },
  explainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.gold.wash,
    borderWidth: 1,
    borderColor: theme.gold.line,
  },
  explainerText: {
    flex: 1,
    ...theme.typography.body,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.secondarySilver,
  },
  previewWrap: {
    borderRadius: theme.radius.large,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.gold.line,
  },
  preview: { width: '100%', height: 200 },
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
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
});
