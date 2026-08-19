/**
 * The "verification pending" strip.
 *
 * Step 3 of the 21+ flow (Dr. Brinkley, 2026-08-19): a member who has uploaded
 * their ID browses freely while a person reviews it. This is what tells them
 * that is happening — without it, discovering that Reserve a Table is locked
 * would be a mystery rather than an explained wait.
 *
 * Renders nothing at all when there is nothing to say: verified members, and
 * members with no record (every account predating the feature). A banner that
 * is always present stops being read.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Clock, XCircle } from 'lucide-react-native';
import { theme } from '../theme';

export default function VerificationBanner({
  awaitingReview,
  wasRejected,
  onPress,
}: {
  awaitingReview: boolean;
  wasRejected: boolean;
  /** Opens the upload screen, so a rejected member can act on it immediately. */
  onPress?: () => void;
}) {
  if (!awaitingReview && !wasRejected) {
    return null;
  }

  const rejected = wasRejected;
  return (
    <Pressable
      style={[styles.banner, rejected && styles.bannerRejected]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      {rejected ? (
        <XCircle size={14} color={theme.colors.danger} />
      ) : (
        <Clock size={14} color={theme.colors.accentGold} />
      )}
      <Text style={[styles.text, rejected && styles.textRejected]}>
        {rejected
          ? 'We couldn’t verify your ID — tap to send another photo.'
          : 'Your ID is being reviewed. Reviews and reservations unlock once you’re verified.'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.gold.wash,
    borderWidth: 1,
    borderColor: theme.gold.line,
  },
  bannerRejected: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.danger,
  },
  text: {
    flex: 1,
    ...theme.typography.medium,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.accentGold,
  },
  textRejected: { color: theme.colors.danger },
});
