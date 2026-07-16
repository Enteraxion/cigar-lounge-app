/**
 * FavoriteButton
 *
 * Heart icon reused on LoungeDetailScreen, SearchResultCard, and
 * LoungeCard. Owns its own optimistic-update logic: tapping flips the
 * icon immediately (before the write resolves), then reconciles with
 * whatever toggleFavorite() actually confirmed, and rolls the icon back
 * with an alert if the write fails — so a flaky connection never leaves
 * the UI showing a favorite that didn't actually save (or vice versa).
 */

import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { Heart } from 'lucide-react-native';
import { theme } from '../theme';
import { toggleFavorite } from '../services/userActionsService';

type Props = {
  userId: string;
  loungeId: string;
  initialFavorited: boolean;
  size?: number;
  style?: object;
};

export default function FavoriteButton({
  userId,
  loungeId,
  initialFavorited,
  size = 18,
  style,
}: Props) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, setPending] = useState(false);

  const onPress = async () => {
    if (pending) return;
    const optimistic = !favorited;
    setFavorited(optimistic);
    setPending(true);
    try {
      const confirmed = await toggleFavorite(userId, loungeId);
      setFavorited(confirmed);
    } catch {
      setFavorited(!optimistic);
      Alert.alert("Couldn't update favorites", 'Check your connection and try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Pressable style={[styles.button, style]} onPress={onPress} hitSlop={8}>
      <Heart
        size={size}
        color={favorited ? theme.colors.accentGold : theme.colors.white}
        fill={favorited ? theme.colors.accentGold : 'transparent'}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
