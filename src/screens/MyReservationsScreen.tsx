/**
 * MyReservationsScreen
 *
 * The member's own bookings — the screen QA found missing (BUG-001,
 * 2026-08-23). ReserveTableScreen had been writing real reservation documents
 * to `lounges/{loungeId}/reservations` since the feature shipped, and the
 * Owner Portal could list them for a shop, but the member who made the booking
 * had nowhere at all to see it again. From their side "Reservation Confirmed"
 * was the entire feature.
 *
 * Upcoming and past are split rather than shown as one list. A booking for
 * next Friday and one from three weeks ago need completely different things
 * from a member — the first can still be cancelled and needs to be found
 * quickly, the second is a receipt — so sorting them into one stream by date
 * would bury whichever matters.
 *
 * Cancelling deletes the document (firestore.rules has always allowed the
 * guest to). Deliberately not a "cancelled" status flag: nothing reads such a
 * flag, and a lounge owner scanning the Owner Portal's list wants the table
 * free, not a row explaining that it is.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';
import { CalendarClock, ChevronLeft, Clock, MapPin, Users } from 'lucide-react-native';
import { theme } from '../theme';
import { auth } from '../services/firebaseAuth';
import {
  cancelReservation,
  getMyReservations,
  type MyReservation,
} from '../services/reservationService';
import type { ProfileStackParamList } from '../navigation/ProfileNavigator';

/** Midnight today — a booking earlier TODAY is still "upcoming" to the member. */
function startOfToday(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

function formatDate(seconds: number): string {
  return new Date(seconds * 1000).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function ReservationCard({
  reservation,
  onOpenLounge,
  onCancel,
}: {
  reservation: MyReservation;
  onOpenLounge: (() => void) | null;
  onCancel: (() => void) | null;
}) {
  return (
    <View style={styles.card}>
      <Pressable onPress={onOpenLounge ?? undefined} disabled={!onOpenLounge}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {/* The lounge document can genuinely be gone — an import can drop a
              listing that closed. Naming the booking after the reservation
              itself is better than rendering a blank heading. */}
          {reservation.lounge?.name ?? 'This lounge is no longer listed'}
        </Text>
        {reservation.lounge?.address ? (
          <View style={styles.metaRow}>
            <MapPin size={13} color={theme.colors.mutedGray} />
            <Text style={styles.metaText} numberOfLines={1}>
              {reservation.lounge.address}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <View style={styles.divider} />

      <View style={styles.factsRow}>
        <View style={styles.fact}>
          <CalendarClock size={14} color={theme.colors.accentGold} />
          <Text style={styles.factText}>{formatDate(reservation.date.seconds)}</Text>
        </View>
        <View style={styles.fact}>
          <Clock size={14} color={theme.colors.accentGold} />
          <Text style={styles.factText}>{reservation.timeSlot}</Text>
        </View>
        <View style={styles.fact}>
          <Users size={14} color={theme.colors.accentGold} />
          <Text style={styles.factText}>
            {reservation.partySize} {reservation.partySize === 1 ? 'guest' : 'guests'}
          </Text>
        </View>
      </View>

      <Text style={styles.bookedFor}>
        Booked for {reservation.guestName} · {reservation.contactPhone}
      </Text>
      {reservation.notes ? <Text style={styles.notes}>“{reservation.notes}”</Text> : null}

      {onCancel ? (
        <Pressable style={styles.cancelButton} onPress={onCancel} hitSlop={6}>
          <Text style={styles.cancelButtonText}>Cancel reservation</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function MyReservationsScreen() {
  const navigation = useNavigation<NavigationProp<ProfileStackParamList>>();
  const userId = auth.currentUser?.uid;

  const [reservations, setReservations] = useState<MyReservation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setReservations([]);
      return;
    }
    setError(null);
    try {
      setReservations(await getMyReservations(userId));
    } catch {
      setError("Couldn't load your reservations. Check your connection and try again.");
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmCancel = (reservation: MyReservation) => {
    Alert.alert(
      'Cancel this reservation?',
      `${reservation.lounge?.name ?? 'This lounge'} on ${formatDate(reservation.date.seconds)} at ${
        reservation.timeSlot
      }. The lounge will no longer see this booking.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel it',
          style: 'destructive',
          onPress: async () => {
            setCancelling(reservation.id);
            try {
              await cancelReservation(reservation.loungeId, reservation.id);
              setReservations(prev => prev?.filter(r => r.id !== reservation.id) ?? prev);
            } catch {
              // Told, not swallowed. The member needs to know the lounge still
              // has the booking, or they will not turn up to a table that is
              // still being held for them.
              Alert.alert(
                "Couldn't cancel that",
                'The reservation is still booked. Check your connection and try again, or call the lounge.',
              );
            } finally {
              setCancelling(null);
            }
          },
        },
      ],
    );
  };

  const today = startOfToday();
  const upcoming = reservations?.filter(r => r.date.seconds * 1000 >= today) ?? [];
  const past = reservations?.filter(r => r.date.seconds * 1000 < today) ?? [];

  const openLounge = (reservation: MyReservation) =>
    reservation.lounge
      ? () =>
          // Reservations are made from several tabs, so this screen lives in the
          // Profile stack and reaches a lounge the same cross-stack way
          // FavoritesScreen does.
          (navigation.navigate as (name: string, params?: object) => void)('Main', {
            screen: 'Search',
            params: { screen: 'LoungeDetail', params: { loungeId: reservation.loungeId } },
          })
      : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
        >
          <ChevronLeft size={24} color={theme.colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>My Reservations</Text>
        <View style={styles.headerSpacer} />
      </View>

      {error ? (
        <View style={styles.stateBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : reservations === null ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.colors.secondarySilver} />
        </View>
      ) : reservations.length === 0 ? (
        <View style={styles.stateBox}>
          <View style={styles.emptyIconWrap}>
            <CalendarClock size={28} color={theme.colors.mutedGray} />
          </View>
          <Text style={styles.emptyTitle}>No Reservations Yet</Text>
          <Text style={styles.emptyDescription}>
            When you reserve a table at a lounge, it will show up here so you can check the
            details or cancel it.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {upcoming.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Upcoming</Text>
              <View style={styles.list}>
                {upcoming.map(reservation => (
                  <ReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    onOpenLounge={openLounge(reservation)}
                    onCancel={
                      cancelling === reservation.id ? null : () => confirmCancel(reservation)
                    }
                  />
                ))}
              </View>
            </>
          )}

          {past.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Past</Text>
              <View style={styles.list}>
                {past.map(reservation => (
                  <ReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    onOpenLounge={openLounge(reservation)}
                    // A date that has passed cannot be cancelled — there is
                    // nothing left to withdraw.
                    onCancel={null}
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  headerTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 18,
    color: theme.colors.white,
  },
  headerSpacer: {
    width: 24,
  },

  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  sectionTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.colors.mutedGray,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  list: {
    gap: theme.spacing.sm,
  },

  card: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.xs,
    ...theme.shadows.soft,
  },
  cardTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.white,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.mutedGray,
    opacity: 0.3,
    marginVertical: theme.spacing.xs,
  },
  factsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  factText: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.secondarySilver,
  },
  bookedFor: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
    marginTop: 2,
  },
  notes: {
    ...theme.typography.medium,
    fontSize: 12,
    fontStyle: 'italic',
    color: theme.colors.secondarySilver,
  },
  cancelButton: {
    alignSelf: 'flex-start',
    marginTop: theme.spacing.xs,
  },
  cancelButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 12,
    color: theme.colors.accentGold,
  },

  stateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  emptyTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 17,
    color: theme.colors.white,
    marginTop: theme.spacing.xs,
  },
  emptyDescription: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.mutedGray,
    textAlign: 'center',
    lineHeight: 19,
  },
  errorText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.secondarySilver,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: theme.spacing.lg,
    height: 40,
    borderRadius: theme.radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  retryButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.white,
  },
});
