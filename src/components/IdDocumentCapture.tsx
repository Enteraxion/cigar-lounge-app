/**
 * IdDocumentCapture
 *
 * The 21+ ID submission, as two steps: pick the document, then photograph every
 * side it needs. Dr. Brinkley, 2026-08-19 — the previous single "Upload photo of
 * ID" button asked for one image without saying what of, which is the version of
 * this ask that produces unusable photos.
 *
 * Shared by both places a member can be asked for an ID, because the *job* is
 * identical in each and only the framing differs:
 *
 *  - AgeVerificationRequiredScreen — the wall straight after sign-up, no way
 *    past it;
 *  - AgeVerificationScreen — the same thing reached voluntarily from Profile,
 *    wrapped in the current status.
 *
 * Two deliberate design decisions worth not undoing:
 *
 * **Photos are held locally until every required side is in hand, then uploaded
 * together.** Uploading each side as it is taken would be simpler, but it writes
 * a record that is missing a side, and a record missing a side is exactly what
 * the app gate (useAgeVerification) refuses to let past. A member who took one
 * photo and lost signal would be pinned at the wall by our own half-written
 * record. Nothing is written until the submission is complete.
 *
 * **Camera first, library second.** A photograph taken now is of the document in
 * the member's hand; a library pick can be a screenshot of someone else's. The
 * camera is the primary action and the library is the fallback, offered because
 * some members photograph their ID once and keep it, and because the simulator
 * has no camera at all.
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import {
  BadgeCheck,
  BookUser,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  IdCard,
  RotateCcw,
  ScanLine,
} from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import { auth } from '../services/firebaseAuth';
import { uploadImage } from '../services/storageService';
import { attachIdDocument } from '../services/ageVerificationService';
import type { AgeVerification, IdDocumentType } from '../types/firestore';
import {
  ID_DOCUMENT_OPTIONS,
  imageForSide,
  requiredSides,
  sideHint,
  sideLabel,
  type IdDocumentSide,
} from '../utils/idDocument';

/** Icon per document, so the picker rows are distinguishable at a glance. */
const DOCUMENT_ICON: Record<IdDocumentType, typeof IdCard> = {
  drivers_license: IdCard,
  state_id: IdCard,
  passport: BookUser,
  military_id: BadgeCheck,
};

/**
 * Real-world proportions for the capture frames. An ID-1 card (every US licence
 * and state ID) is 85.6 x 54 mm; a passport's data page is 125 x 88 mm. Framing
 * the target at its true shape is what makes a member fill the frame instead of
 * photographing a card floating in a square, and a cropped corner is the single
 * most common reason a reviewer cannot accept an image.
 */
const CARD_ASPECT = 85.6 / 54;
const PASSPORT_ASPECT = 125 / 88;

type Props = {
  /** Called once the record is written — the caller re-reads it. */
  onSubmitted: () => void;
  /**
   * The member's existing record, when there is one. Used to pre-select the
   * document they chose last time, so someone re-sending after a rejection is
   * not made to answer the same question again.
   */
  existing?: AgeVerification | null;
};

export default function IdDocumentCapture({ onSubmitted, existing }: Props) {
  const userId = auth.currentUser?.uid;

  const [documentType, setDocumentType] = useState<IdDocumentType | null>(
    existing?.documentType ?? null,
  );
  const [shots, setShots] = useState<Partial<Record<IdDocumentSide, string>>>({});
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const sides = useMemo(() => requiredSides(documentType), [documentType]);

  /**
   * A side already on file that can stand as part of this submission.
   *
   * Only counted when the member is still sending the same document they sent
   * last time. Stored images belong to whatever was chosen then, so reusing the
   * back of a licence as the back of a military ID would submit two halves of
   * two different documents. Legacy records carry no `documentType` at all and so
   * never match, which is right — we do not know what they show.
   */
  const stored = (side: IdDocumentSide): string | undefined =>
    documentType && existing?.documentType === documentType
      ? imageForSide(existing, side)
      : undefined;

  /** What the tile shows: a photo taken now, else one already on file. */
  const shownFor = (side: IdDocumentSide): string | undefined => shots[side] ?? stored(side);

  const outstanding = sides.filter(side => !shownFor(side));
  const retaken = sides.some(side => !!shots[side]);
  // Every side accounted for, and something actually new to send. Without the
  // second half, a member reviewing a rejected submission could re-send the exact
  // photos that were just refused and land back in the queue unchanged.
  const ready = outstanding.length === 0 && retaken;

  const chooseDocument = (type: IdDocumentType) => {
    setDocumentType(type);
    // Photos taken for a different document are never right for this one — a
    // licence's back is not a passport's anything.
    setShots({});
  };

  const handlePicked = (side: IdDocumentSide, response: ImagePickerResponse) => {
    if (response.didCancel) {
      return;
    }
    if (response.errorCode) {
      Alert.alert(
        "Couldn't open the camera",
        response.errorCode === 'permission'
          ? 'Allow camera and photo access in Settings so you can photograph your ID.'
          : response.errorMessage ?? 'Try choosing a photo from your library instead.',
      );
      return;
    }
    const asset: Asset | undefined = response.assets?.[0];
    if (!asset?.uri) {
      return;
    }
    setShots(current => ({ ...current, [side]: asset.uri }));
  };

  const capture = (side: IdDocumentSide) => {
    const options = {
      mediaType: 'photo' as const,
      selectionLimit: 1,
      // Full-resolution phone photos of an ID are several megabytes and the
      // small text is what a reviewer needs, so this caps the long edge rather
      // than compressing detail away. 2000px still resolves a date of birth.
      maxWidth: 2000,
      maxHeight: 2000,
      quality: 0.9 as const,
      saveToPhotos: false,
    };
    Alert.alert(sideLabel(documentType, side), 'How would you like to add this photo?', [
      { text: 'Take Photo', onPress: () => launchCamera(options, r => handlePicked(side, r)) },
      {
        text: 'Choose from Library',
        onPress: () => launchImageLibrary(options, r => handlePicked(side, r)),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submit = async () => {
    if (!userId || !documentType || !ready) {
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      // Sequential, and progress is reported across the whole set rather than
      // per file — a bar that fills and resets reads as a failed upload.
      const urls: Partial<Record<IdDocumentSide, string>> = {};
      for (let index = 0; index < sides.length; index += 1) {
        const side = sides[index];
        const uri = shots[side];
        if (!uri) {
          // Untouched side — keep the URL already on file rather than making the
          // member photograph a side nobody asked them to change.
          urls[side] = stored(side);
          setProgress((index + 1) / sides.length);
          continue;
        }
        urls[side] = await uploadImage(userId, uri, 'age-verification', fraction =>
          setProgress((index + fraction) / sides.length),
        );
      }
      if (!urls.front) {
        throw new Error('missing front image');
      }
      await attachIdDocument(userId, documentType, { front: urls.front, back: urls.back });
      onSubmitted();
    } catch {
      // Retryable, not a dead end: the usual cause is a dropped connection, and
      // a member at the sign-up wall cannot reach the app until this succeeds, so
      // the message has to invite another attempt. The local photos are kept so
      // "try again" does not mean "photograph everything again".
      Alert.alert(
        "Couldn't send that",
        'Check your connection and tap Submit again — your photos are still here.',
      );
    } finally {
      setUploading(false);
    }
  };

  // ---------------- Step 1: which document ----------------
  if (!documentType) {
    return (
      <View style={styles.container}>
        <StepHeader step={1} label="Choose your ID" />
        <Text style={styles.stepBody}>
          Pick the document you'd like to send. We'll tell you exactly which photos we need.
        </Text>

        <View style={styles.optionList}>
          {ID_DOCUMENT_OPTIONS.map(option => {
            const Icon = DOCUMENT_ICON[option.id];
            return (
              <Pressable
                key={option.id}
                style={styles.optionRow}
                onPress={() => chooseDocument(option.id)}
                accessibilityRole="button"
                accessibilityLabel={option.label}
              >
                <View style={styles.optionIcon}>
                  <Icon size={20} color={theme.colors.accentGold} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionHint}>{option.hint}</Text>
                </View>
                <ChevronRight size={18} color={theme.colors.mutedGray} />
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  // ---------------- Step 2: photograph it ----------------
  const aspect = documentType === 'passport' ? PASSPORT_ASPECT : CARD_ASPECT;

  return (
    <View style={styles.container}>
      <StepHeader step={2} label={sides.length > 1 ? 'Photograph both sides' : 'Photograph it'} />

      <Pressable
        style={styles.changeRow}
        onPress={() => setDocumentType(null)}
        disabled={uploading}
        accessibilityRole="button"
      >
        <ChevronLeft size={14} color={theme.colors.accentGold} />
        <Text style={styles.changeText}>
          {ID_DOCUMENT_OPTIONS.find(o => o.id === documentType)?.label} — change
        </Text>
      </Pressable>

      {sides.map(side => {
        const uri = shownFor(side);
        const isNew = !!shots[side];
        return (
          <View key={side} style={styles.captureBlock}>
            <View style={styles.captureLabelRow}>
              <Text style={styles.captureLabel}>{sideLabel(documentType, side)}</Text>
              {uri ? (
                <View style={[styles.doneBadge, !isNew && styles.storedBadge]}>
                  <Check
                    size={11}
                    color={isNew ? theme.colors.primaryBlack : theme.colors.secondarySilver}
                  />
                  <Text style={[styles.doneBadgeText, !isNew && styles.storedBadgeText]}>
                    {isNew ? 'Added' : 'On file'}
                  </Text>
                </View>
              ) : null}
            </View>

            <Pressable
              style={[styles.frame, { aspectRatio: aspect }, uri && styles.frameFilled]}
              onPress={() => capture(side)}
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel={`${sideLabel(documentType, side)} — ${uri ? 'retake' : 'add photo'}`}
            >
              {uri ? (
                <>
                  <Image source={{ uri }} style={styles.shot} resizeMode="cover" />
                  <View style={styles.retakePill}>
                    <RotateCcw size={12} color={theme.colors.white} />
                    <Text style={styles.retakeText}>{isNew ? 'Retake' : 'Replace'}</Text>
                  </View>
                </>
              ) : (
                <>
                  {/* Corner marks rather than a plain dashed box: they read as a
                      viewfinder, which is the instruction "line the card up
                      inside this" without a sentence saying so. */}
                  <View style={[styles.corner, styles.cornerTopLeft]} />
                  <View style={[styles.corner, styles.cornerTopRight]} />
                  <View style={[styles.corner, styles.cornerBottomLeft]} />
                  <View style={[styles.corner, styles.cornerBottomRight]} />
                  <Camera size={26} color={theme.colors.accentGold} />
                  <Text style={styles.frameHint}>{sideHint(documentType, side)}</Text>
                </>
              )}
            </Pressable>
          </View>
        );
      })}

      <View style={styles.tips}>
        <View style={styles.tipsHeader}>
          <ScanLine size={14} color={theme.colors.accentGold} />
          <Text style={styles.tipsTitle}>For a photo we can accept</Text>
        </View>
        <Text style={styles.tip}>• All four corners inside the frame</Text>
        <Text style={styles.tip}>• Flat, in good light, no flash glare</Text>
        <Text style={styles.tip}>• Nothing covering your date of birth</Text>
      </View>

      <Pressable
        style={[styles.submitButton, (!ready || uploading) && styles.submitButtonDisabled]}
        onPress={submit}
        disabled={!ready || uploading}
      >
        {uploading ? (
          <>
            <ActivityIndicator color={theme.colors.primaryBlack} />
            <Text style={styles.submitButtonText}>Sending {Math.round(progress * 100)}%</Text>
          </>
        ) : (
          <Text style={styles.submitButtonText}>
            {ready
              ? 'Submit for review'
              : outstanding.length > 0
                ? `Add ${sideLabel(documentType, outstanding[0]).toLowerCase()} to continue`
                : 'Take a new photo to resubmit'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

/** Numbered step marker — tells the member how far in they are and how far is left. */
function StepHeader({ step, label }: { step: 1 | 2; label: string }) {
  return (
    <View style={styles.stepHeader}>
      <View style={styles.stepDots}>
        <View style={[styles.stepDot, styles.stepDotActive]} />
        <View style={[styles.stepDot, step === 2 && styles.stepDotActive]} />
      </View>
      <Text style={styles.stepLabel}>
        Step {step} of 2 · {label}
      </Text>
    </View>
  );
}

const CORNER = 18;

const styles = StyleSheet.create({
  container: { gap: theme.spacing.md },

  stepHeader: { gap: theme.spacing.sm },
  stepDots: { flexDirection: 'row', gap: 6 },
  stepDot: {
    height: 3,
    flex: 1,
    borderRadius: 2,
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.2),
  },
  stepDotActive: { backgroundColor: theme.colors.accentGold },
  stepLabel: { ...theme.typography.caption, fontSize: 10, color: theme.colors.accentGold },
  stepBody: {
    ...theme.typography.body,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.secondarySilver,
  },

  optionList: { gap: theme.spacing.sm },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.gold.line,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.gold.wash,
  },
  optionText: { flex: 1, gap: 2 },
  optionLabel: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.white,
  },
  optionHint: { ...theme.typography.body, fontSize: 12, color: theme.colors.mutedGray },

  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  changeText: { ...theme.typography.medium, fontSize: 12, color: theme.colors.accentGold },

  captureBlock: { gap: theme.spacing.sm },
  captureLabelRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  captureLabel: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentGold,
  },
  doneBadgeText: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.primaryBlack,
  },
  // An image already on file reads as context, not as something just achieved —
  // a gold "Added" badge on a photo the member did not take is a small lie.
  storedBadge: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.secondarySilver, 0.35),
  },
  storedBadgeText: { color: theme.colors.secondarySilver },

  frame: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    overflow: 'hidden',
    borderRadius: theme.radius.large,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.gold.line,
    backgroundColor: withAlpha(theme.colors.surface, 0.5),
  },
  frameFilled: { borderStyle: 'solid', borderColor: theme.gold.lineStrong },
  frameHint: {
    ...theme.typography.body,
    fontSize: 11,
    color: theme.colors.mutedGray,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: theme.colors.accentGold,
  },
  cornerTopLeft: { top: 10, left: 10, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 6 },
  cornerTopRight: {
    top: 10,
    right: 10,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 6,
  },
  cornerBottomLeft: {
    bottom: 10,
    left: 10,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 6,
  },
  cornerBottomRight: {
    bottom: 10,
    right: 10,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 6,
  },
  shot: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  retakePill: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.primaryBlack, 0.75),
  },
  retakeText: { ...theme.typography.medium, fontSize: 11, color: theme.colors.white },

  tips: {
    gap: 4,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.gold.wash,
    borderWidth: 1,
    borderColor: theme.gold.line,
  },
  tipsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  tipsTitle: { ...theme.typography.caption, fontSize: 10, color: theme.colors.accentGold },
  tip: {
    ...theme.typography.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.secondarySilver,
  },

  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.accentGold,
  },
  submitButtonDisabled: { opacity: 0.45 },
  submitButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.primaryBlack,
  },
});
