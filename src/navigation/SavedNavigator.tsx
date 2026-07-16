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
      <Stack.Screen name="FavoritesHome" component={FavoritesScreen} />
      <Stack.Screen name="CollectionsGrid" component={CollectionsGridScreen} />
      <Stack.Screen name="CollectionDetail" component={CollectionDetailScreen} />
      <Stack.Screen name="CreateCollection" component={CreateCollectionScreen} />
      <Stack.Screen name="TravelWishlist" component={TravelWishlistScreen} />
    </Stack.Navigator>
  );
}
