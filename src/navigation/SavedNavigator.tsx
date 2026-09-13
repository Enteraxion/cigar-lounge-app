/**
 * SavedNavigator
 *
 * Stack for the Saved tab: the Favorites home (stats + favorited lounge
 * list, or the empty state), the Collections grid, the Travel Wishlist
 * (all three reached via the segmented switcher shared across them), the
 * collection detail screen reached from a grid card, and the
 * create-collection flow reached from the grid's "+ New Folder" card.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FavoritesScreen from '../screens/FavoritesScreen';
import CollectionsGridScreen from '../screens/CollectionsGridScreen';
import CollectionDetailScreen from '../screens/CollectionDetailScreen';
import CreateCollectionScreen from '../screens/CreateCollectionScreen';
import TravelWishlistScreen from '../screens/TravelWishlistScreen';

export type SavedStackParamList = {
  FavoritesHome: undefined;
  CollectionsGrid: undefined;
  CollectionDetail: { collectionId: string };
  CreateCollection: undefined;
  TravelWishlist: undefined;
};

const Stack = createNativeStackNavigator<SavedStackParamList>();

export default function SavedNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* The three switcher destinations slide nowhere. They are presented to
          the member as tabs — one row, one highlighted — so a push animation
          between them contradicts what the control says it is: tapping "Wishlist"
          should change the panel, not travel somewhere. They are also entered
          with navigation.replace rather than navigate, which keeps the stack one
          deep; pushing let it grow Favorites → Collections → Wishlist, and
          tapping a segment already in the stack then POPPED backwards to it,
          which is the "it jumps to another tab" Rohith reported on 2026-09-12. */}
      <Stack.Screen
        name="FavoritesHome"
        component={FavoritesScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen
        name="CollectionsGrid"
        component={CollectionsGridScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen
        name="TravelWishlist"
        component={TravelWishlistScreen}
        options={{ animation: 'none' }}
      />
      {/* These two are genuine pushes — they go somewhere, and keep their
          animation and their back gesture. */}
      <Stack.Screen name="CollectionDetail" component={CollectionDetailScreen} />
      <Stack.Screen name="CreateCollection" component={CreateCollectionScreen} />
    </Stack.Navigator>
  );
}
