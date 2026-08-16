/**
 * SearchNavigator
 *
 * Stack for the Search tab: the Search home (filters, recent searches,
 * destinations, etc.), the live search suggestions screen shown once the
 * member taps the search bar, the results list for a chosen query, the
 * lounge detail screen reached from a result card, the reviews list +
 * write-review flow reached from lounge detail, and the (placeholder,
 * for now) confirmation screen shown after submitting a review. Filters
 * open as a bottom sheet directly on the results screen, not as a
 * separate route.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SearchScreen from '../screens/SearchScreen';
import SearchSuggestionsScreen from '../screens/SearchSuggestionsScreen';
import SearchResultsScreen from '../screens/SearchResultsScreen';
import LoungeDetailScreen from '../screens/LoungeDetailScreen';
import ReviewsScreen from '../screens/ReviewsScreen';
import WriteReviewScreen from '../screens/WriteReviewScreen';
import UploadPhotosScreen from '../screens/UploadPhotosScreen';
import ReviewSubmittedScreen from '../screens/ReviewSubmittedScreen';
import RatingsBreakdownScreen from '../screens/RatingsBreakdownScreen';
import CreateCollectionScreen from '../screens/CreateCollectionScreen';
import RecentlyViewedScreen from '../screens/RecentlyViewedScreen';
import ClaimListingScreen from '../screens/ClaimListingScreen';
import ClaimSubmittedScreen from '../screens/ClaimSubmittedScreen';
import EditListingScreen from '../screens/EditListingScreen';
import ReserveTableScreen from '../screens/ReserveTableScreen';
import ReservationConfirmedScreen from '../screens/ReservationConfirmedScreen';
import type { ReviewCategoryRatings } from '../types/firestore';
import type { SearchFilters } from '../utils/loungeSearch';

/**
 * Fields needed to prefill WriteReviewScreen for an edit — a subset of
 * ReviewDocument's shape (see src/types/firestore.ts), passed straight
 * through nav params rather than re-fetched, since the caller (e.g.
 * LoungeDetailScreen) already has the full review in hand.
 */
export type WriteReviewInitialData = {
  rating: number;
  text: string;
  categoryRatings: ReviewCategoryRatings;
  wouldReturn: boolean;
  recommend: boolean;
  photos: string[];
};

export type SearchStackParamList = {
  SearchHome: undefined;
  LiveSearchSuggestions: undefined;
  SearchResults:
    | {
        query?: string;
        /** Pre-selects SearchResultsScreen's quick filter chips (e.g. 'premium', 'open-now') — see SearchScreen's filter chips. */
        initialQuickFilterIds?: string[];
        /** Merged over defaultSearchFilters — see SearchScreen's filter chips ('Nearby' -> nearCurrentLocation, 'Whiskey' -> entertainment). */
        initialFilters?: Partial<SearchFilters>;
      }
    | undefined;
  LoungeDetail: { loungeId: string };
  LoungeReviews: { loungeId: string };
  WriteReview:
    | {
        loungeId?: string;
        selectedPhotos?: string[];
        /** Present only when editing an existing review instead of creating a new one. */
        reviewId?: string;
        initialReview?: WriteReviewInitialData;
      }
    | undefined;
  UploadPhotos: undefined;
  ReviewSubmitted: { loungeId?: string } | undefined;
  RatingsBreakdown: { loungeId: string };
  CreateCollection: undefined;
  RecentlyViewed: undefined;
  ClaimListing: { loungeId: string };
  /** Shown after a claim inquiry is submitted — pending admin review, not yet approved.
   * There is no in-app payment (see ClaimListingScreen's header comment). */
  ClaimSubmitted: { loungeId: string };
  EditListing: { loungeId: string };
  ReserveTable: { loungeId: string; loungeName: string };
  /** date is an ISO string (nav params must be serializable) — see ReserveTableScreen's submit. */
  ReservationConfirmed: {
    loungeId: string;
    loungeName: string;
    date: string;
    timeSlot: string;
    partySize: number;
  };
};

const Stack = createNativeStackNavigator<SearchStackParamList>();

export default function SearchNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SearchHome" component={SearchScreen} />
      <Stack.Screen name="LiveSearchSuggestions" component={SearchSuggestionsScreen} />
      <Stack.Screen name="SearchResults" component={SearchResultsScreen} />
      <Stack.Screen name="LoungeDetail" component={LoungeDetailScreen} />
      <Stack.Screen name="LoungeReviews" component={ReviewsScreen} />
      <Stack.Screen name="WriteReview" component={WriteReviewScreen} />
      <Stack.Screen name="UploadPhotos" component={UploadPhotosScreen} />
      <Stack.Screen name="ReviewSubmitted" component={ReviewSubmittedScreen} />
      <Stack.Screen name="RatingsBreakdown" component={RatingsBreakdownScreen} />
      <Stack.Screen name="CreateCollection" component={CreateCollectionScreen} />
      <Stack.Screen name="RecentlyViewed" component={RecentlyViewedScreen} />
      <Stack.Screen name="ClaimListing" component={ClaimListingScreen} />
      <Stack.Screen name="ClaimSubmitted" component={ClaimSubmittedScreen} />
      <Stack.Screen name="EditListing" component={EditListingScreen} />
      <Stack.Screen name="ReserveTable" component={ReserveTableScreen} />
      <Stack.Screen name="ReservationConfirmed" component={ReservationConfirmedScreen} />
    </Stack.Navigator>
  );
}
