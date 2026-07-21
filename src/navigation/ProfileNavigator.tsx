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

export type ProfileStackParamList = {
  ProfileHome: undefined;
  EditProfile: undefined;
  Passport: undefined;
  TravelTimeline: undefined;
  Achievements: undefined;
  AISettings: undefined;
  AIFeedback: undefined;
  MyReviews: undefined;
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
    </Stack.Navigator>
  );
}
