/**
 * ConciergeNavigator
 *
 * Stack for the AI Concierge flow: the Concierge home (conversational
 * search, quick suggestions, suggested/trending lounges), the
 * conversation thread, the full recommendation results list, the
 * Discovery/Inspiration screen, the Trip Planner, and Saved
 * Conversations. Mounted at the root level (see AppNavigator's
 * "AIConcierge" screen) since it's reachable from more than one tab
 * (currently the Map screen's Concierge card).
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ConciergeHomeScreen from '../screens/ConciergeHomeScreen';
import ConciergeConversationScreen from '../screens/ConciergeConversationScreen';
import ConciergeResultsScreen from '../screens/ConciergeResultsScreen';
import ConciergeInspirationScreen from '../screens/ConciergeInspirationScreen';
import TripPlannerScreen from '../screens/TripPlannerScreen';
import SavedConversationsScreen from '../screens/SavedConversationsScreen';

export type ConciergeStackParamList = {
  ConciergeHome: undefined;
  ConciergeConversation: { initialQuery?: string; conversationId?: string } | undefined;
  ConciergeResults: undefined;
  ConciergeInspiration: undefined;
  TripPlanner: undefined;
  SavedConversations: undefined;
};

const Stack = createNativeStackNavigator<ConciergeStackParamList>();

export default function ConciergeNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ConciergeHome" component={ConciergeHomeScreen} />
      <Stack.Screen name="ConciergeConversation" component={ConciergeConversationScreen} />
      <Stack.Screen name="ConciergeResults" component={ConciergeResultsScreen} />
      <Stack.Screen name="ConciergeInspiration" component={ConciergeInspirationScreen} />
      <Stack.Screen name="TripPlanner" component={TripPlannerScreen} />
      <Stack.Screen name="SavedConversations" component={SavedConversationsScreen} />
    </Stack.Navigator>
  );
}
