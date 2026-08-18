/**
 * ProfileNavigator
 *
 * Stack for the Profile tab: the Profile home screen, the Cigar Passport
 * flow (Passport home, Travel Timeline, Achievements), and the AI
 * Settings / AI Feedback pair (reached via the gear icon on Profile).
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import PassportScreen from '../screens/PassportScreen';
import TravelTimelineScreen from '../screens/TravelTimelineScreen';
import AchievementsScreen from '../screens/AchievementsScreen';
import AISettingsScreen from '../screens/AISettingsScreen';
import AIFeedbackScreen from '../screens/AIFeedbackScreen';
import MyReviewsScreen from '../screens/MyReviewsScreen';
import AdminClaimReviewScreen from '../screens/AdminClaimReviewScreen';
import MyShopsScreen from '../screens/MyShopsScreen';
import AgeVerificationScreen from '../screens/AgeVerificationScreen';
import AdminAgeReviewScreen from '../screens/AdminAgeReviewScreen';

export type ProfileStackParamList = {
  ProfileHome: undefined;
  EditProfile: undefined;
  Passport: undefined;
  TravelTimeline: undefined;
  Achievements: undefined;
  AISettings: undefined;
  AIFeedback: undefined;
  MyReviews: undefined;
  /** Only reachable from ProfileScreen's admin-only entry card — see src/config/admins.ts. */
  AdminClaimReview: undefined;
  /**
   * Owner-facing. ProfileScreen only shows the entry card to members who own
   * or have claimed a lounge, so most members never see this exists.
   */
  MyShops: undefined;
  /** Member-facing 21+ ID upload. Only surfaced while there is something to do. */
  AgeVerification: undefined;
  /** Admin-only, like AdminClaimReview — see src/config/admins.ts. */
  AdminAgeReview: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Passport" component={PassportScreen} />
      <Stack.Screen name="TravelTimeline" component={TravelTimelineScreen} />
      <Stack.Screen name="Achievements" component={AchievementsScreen} />
      <Stack.Screen name="AISettings" component={AISettingsScreen} />
      <Stack.Screen name="AIFeedback" component={AIFeedbackScreen} />
      <Stack.Screen name="MyReviews" component={MyReviewsScreen} />
      <Stack.Screen name="AdminClaimReview" component={AdminClaimReviewScreen} />
      <Stack.Screen name="MyShops" component={MyShopsScreen} />
      <Stack.Screen name="AgeVerification" component={AgeVerificationScreen} />
      <Stack.Screen name="AdminAgeReview" component={AdminAgeReviewScreen} />
    </Stack.Navigator>
  );
}
