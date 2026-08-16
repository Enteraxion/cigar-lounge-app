/**
 * ReservationConfirmedScreen
 *
 * Shown right after ReserveTableScreen's booking succeeds. Same
 * full-screen-takeover pattern as ReviewSubmittedScreen/ClaimSubmittedScreen
 * — the tab bar hides while any of these three are focused, computed
 * declaratively in MainNavigator.tsx from the focused route name rather
 * than this screen calling setOptions itself (see that file's header
 * comment for why the old per-screen approach could leave the tab bar
 * broken after returning). Unlike the claim flow, a reservation is
 * confirmed immediately — no review step — since there's no owner-side
 * capacity/approval system yet (see reservationService.ts).
 */

import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowRight, CalendarCheck } from 'lucide-react-native';
import { theme } from '../theme';
import type { SearchStackParamList } from '../navigation/SearchNavigator';

type NavigationProp = NativeStackNavigationProp<SearchStackParamList>;
type RouteProps = RouteProp<SearchStackParamList, 'ReservationConfirmed'>;

export default function ReservationConfirmedScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { loungeId, loungeName, date, timeSlot, partySize } = route.params;

  const formattedDate = new Date(date).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <CalendarCheck size={40} color={theme.colors.accentGold} />
        </View>

        <Text style={styles.title}>Table Reserved</Text>
        <Text style={styles.subtitle}>
          Your table at {loungeName} is booked. Show this confirmation when you arrive.
        </Text>

        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{formattedDate}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Time</Text>
            <Text style={styles.detailValue}>{timeSlot}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Party Size</Text>
            <Text style={styles.detailValue}>{partySize}</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => navigation.navigate('LoungeDetail', { loungeId })}
        >
          <Text style={styles.primaryButtonText}>Return to Lounge</Text>
          <ArrowRight size={18} color={theme.colors.primaryNavy} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...theme.typography.headingLarge,
    color: theme.colors.white,
    textAlign: 'center',
  },
  subtitle: {
    ...theme.typography.medium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: theme.colors.mutedGray,
    paddingHorizontal: theme.spacing.md,
  },
  detailCard: {
    width: '100%',
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surfaceNavy,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.15)',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.mutedGray,
  },
  detailValue: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.white,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  primaryButton: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.white,
  },
  primaryButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 15,
    color: theme.colors.primaryNavy,
  },
});
