/**
 * useUnreadNotificationCount
 *
 * Shared by every screen with a bell icon (Home, Favorites, Collections,
 * Wishlist, Passport, Concierge Home) so each one shows a real unread
 * badge without independently polling Firestore. Refetches once per
 * screen focus (useFocusEffect, matching this session's established
 * refetch-on-focus convention — see CollectionsGridScreen/
 * TravelWishlistScreen) rather than an `onSnapshot` listener — this
 * feature's scope (in-app only, no push) doesn't need live updates while
 * a screen just sits open.
 */

import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../services/firebaseAuth';
import { getUserNotifications } from '../services/userActionsService';

export function useUnreadNotificationCount(): { count: number } {
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        setCount(0);
        return;
      }
      getUserNotifications(userId)
        .then(notifications => setCount(notifications.filter(n => !n.read).length))
        .catch(() => setCount(0));
    }, []),
  );

  return { count };
}
