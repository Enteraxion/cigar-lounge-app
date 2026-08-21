/**
 * ProfileNavigator
 *
 * Stack for the Profile tab: the Profile home screen, the Cigar Passport
 * flow (Passport home, Travel Timeline, Achievements), and the AI
 * Settings / AI Feedback pair (reached via the gear icon on Profile).
 *
 * No admin routes. AdminAgeReview and AdminClaimReview lived here until
 * 2026-08-21 and now live in admin-portal/ — reviewing two photographs of a
 * document against a date of birth is desk work that a phone makes harder, and
 * keeping them here meant the admin's email address shipped inside every
 * member's app bundle where anyone could read it out of a downloaded build.
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
import MyShopsScreen from '../screens/MyShopsScreen';
import AgeVerificationScreen from '../screens/AgeVerificationScreen';

export type ProfileStackParamList = {
  ProfileHome: undefined;
  EditProfile: undefined;
  Passport: undefined;
  TravelTimeline: undefined;
  Achievements: undefined;
  AISettings: undefined;
  AIFeedback: undefined;
  MyReviews: undefined;
  /**
   * Owner-facing. ProfileScreen only shows the entry card to members who own
   * or have claimed a lounge, so most members never see this exists.
   */
  MyShops: undefined;
  /** Member-facing 21+ ID upload. Only surfaced while there is something to do. */
  AgeVerification: undefined;
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
      <Stack.Screen name="MyShops" component={MyShopsScreen} />
      <Stack.Screen name="AgeVerification" component={AgeVerificationScreen} />
    </Stack.Navigator>
  );
}
