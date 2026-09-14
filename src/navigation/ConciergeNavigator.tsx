/**
 * ConciergeNavigator
 *
 * The stack behind the Concierge, mounted at the root level (AppNavigator's
 * "AIConcierge" screen) because it is presented as a modal over whichever tab
 * the member was on.
 *
 * It held six screens until 2026-09-14, five of which no member could ever
 * reach: the only way in is SearchScreen, which navigates straight to the
 * conversation, and the other five were reachable only from a home screen
 * nothing navigated to. All five were mock — invented trips, invented
 * recommendations, an invented conversation history — and three of them still
 * called getAllLounges(), the unbounded 8,513-document read retired everywhere
 * else in August. Deleted rather than wired up: there is no product decision
 * behind them to preserve, and unreachable mock screens are exactly what
 * shipping a "Coming Soon" surface to App Review looks like (audit F7).
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ConciergeConversationScreen from '../screens/ConciergeConversationScreen';

export type ConciergeStackParamList = {
  ConciergeConversation: { initialQuery?: string; conversationId?: string } | undefined;
};

const Stack = createNativeStackNavigator<ConciergeStackParamList>();

export default function ConciergeNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ConciergeConversation" component={ConciergeConversationScreen} />
    </Stack.Navigator>
  );
}
