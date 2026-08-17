/**
 * ReserveTableScreen
 *
 * Reached from LoungeDetailScreen's "Reserve a Table" button (previously
 * just an Alert.alert('Coming Soon') placeholder). A real calendar +
 * time-slot booking flow, per Julian Brinkley's direction — a fixed
 * time-slot list rather than free-form time entry, since LoungeDocument's
 * `hours` field is unstructured free text (see reservationService.ts's
 * header comment) with no real open/close data to validate a time
 * against or generate slots from. SLOTS below is a reasonable fixed
 * evening window for a cigar lounge, not lounge-specific.
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { ChevronLeft, Minus, Plus } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import { createReservation } from '../services/reservationService';
import { auth } from '../services/firebaseAuth';
import type { SearchStackParamList } from '../navigation/SearchNavigator';

const functions = getFunctions();

type NavigationProp = NativeStackNavigationProp<SearchStackParamList>;
type RouteProps = RouteProp<SearchStackParamList, 'ReserveTable'>;

const DAYS_AHEAD = 14;
const SLOTS = [
  '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM',
  '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM',
  '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM', '10:00 PM', '10:30 PM',
];
const MIN_PARTY_SIZE = 1;
const MAX_PARTY_SIZE = 8;
const NAME_CHARS_REGEX = /^[A-Za-z' -]*$/;
const NAME_REGEX = /^[A-Za-z]+(?:[' -][A-Za-z]+)*$/;

function buildUpcomingDays(count: number): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(today);
    day.setDate(today.getDate() + i);
    return day;
  });
}

function formatPhone(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

export default function ReserveTableScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { loungeId, loungeName } = route.params;
  const userId = auth.currentUser?.uid;

  const upcomingDays = useMemo(() => buildUpcomingDays(DAYS_AHEAD), []);

  const [selectedDate, setSelectedDate] = useState<Date>(upcomingDays[0]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [guestName, setGuestName] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [notes, setNotes] = useState('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onChangeName = (text: string) => {
    if (!NAME_CHARS_REGEX.test(text)) {
      setNameError('Only letters, spaces, hyphens, and apostrophes are allowed.');
      return;
    }
    setGuestName(text);
    if (nameError) setNameError('');
  };

  const onChangePhone = (text: string) => {
    setPhoneDigits(text.replace(/\D/g, '').slice(0, 10));
    if (phoneError) setPhoneError('');
  };

  const submit = async () => {
    if (!userId) {
      Alert.alert('Sign in required', 'Please sign in to reserve a table.');
      return;
    }
    if (!selectedSlot) {
      Alert.alert('Pick a time', 'Choose a time slot for your reservation.');
      return;
    }
    const trimmedName = guestName.trim();
    let hasError = false;
    if (!NAME_REGEX.test(trimmedName)) {
      setNameError('Enter your full name using letters only.');
      hasError = true;
    }
    if (phoneDigits.length !== 10) {
      setPhoneError('Enter a valid 10-digit phone number.');
      hasError = true;
    }
    if (hasError) {
      return;
    }

    setSubmitting(true);
    try {
      const contactPhone = formatPhone(phoneDigits);
      await createReservation(loungeId, userId, {
        guestName: trimmedName,
        contactPhone,
        partySize,
        date: selectedDate,
        timeSlot: selectedSlot,
        notes,
      });

      try {
        const sendReservationEmail = httpsCallable(functions, 'sendReservationEmail');
        await sendReservationEmail({
          loungeId,
          guestName: trimmedName,
          contactPhone,
          partySize,
          date: selectedDate.toDateString(),
          timeSlot: selectedSlot,
          notes,
        });
      } catch {
        // Best-effort — the reservation itself already saved. Most lounges
        // aren't claimed yet, so there's often no owner email to send to
        // anyway (see sendReservationEmail's header comment).
      }

      navigation.replace('ReservationConfirmed', {
        loungeId,
        loungeName,
        date: selectedDate.toISOString(),
        timeSlot: selectedSlot,
        partySize,
      });
    } catch (error) {
      Alert.alert(
        "Couldn't reserve your table",
        error instanceof Error ? error.message : 'Check your connection and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back" hitSlop={8}>
          <ChevronLeft size={20} color={theme.colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Reserve a Table</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.loungeName}>{loungeName}</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateRow}
          >
            {upcomingDays.map(day => {
              const isSelected = day.getTime() === selectedDate.getTime();
              return (
                <Pressable
                  key={day.toISOString()}
                  style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                  onPress={() => setSelectedDate(day)}
                >
                  <Text style={[styles.dateChipWeekday, isSelected && styles.dateChipTextSelected]}>
                    {day.toLocaleDateString(undefined, { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dateChipDay, isSelected && styles.dateChipTextSelected]}>
                    {day.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Time</Text>
          <View style={styles.slotGrid}>
            {SLOTS.map(slot => {
              const isSelected = slot === selectedSlot;
              return (
                <Pressable
                  key={slot}
                  style={[styles.slotChip, isSelected && styles.slotChipSelected]}
                  onPress={() => setSelectedSlot(slot)}
                >
                  <Text style={[styles.slotChipText, isSelected && styles.dateChipTextSelected]}>
                    {slot}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Party Size</Text>
          <View style={styles.stepperRow}>
            <Pressable
              style={styles.stepperButton}
              onPress={() => setPartySize(size => Math.max(MIN_PARTY_SIZE, size - 1))}
            >
              <Minus size={16} color={theme.colors.white} />
            </Pressable>
            <Text style={styles.stepperValue}>{partySize}</Text>
            <Pressable
              style={styles.stepperButton}
              onPress={() => setPartySize(size => Math.min(MAX_PARTY_SIZE, size + 1))}
            >
              <Plus size={16} color={theme.colors.white} />
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Your Name</Text>
          <TextInput
        accessibilityLabel="Full name"
            value={guestName}
            onChangeText={onChangeName}
            placeholder="Full name"
            placeholderTextColor={theme.colors.mutedGray}
            style={[styles.textInput, nameError && styles.textInputError]}
          />
          {!!nameError && <Text style={styles.errorText}>{nameError}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Phone Number</Text>
          <TextInput
        accessibilityLabel="(555) 123-4567"
            value={formatPhone(phoneDigits)}
            onChangeText={onChangePhone}
            placeholder="(555) 123-4567"
            placeholderTextColor={theme.colors.mutedGray}
            keyboardType="phone-pad"
            style={[styles.textInput, phoneError && styles.textInputError]}
          />
          {!!phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Notes (optional)</Text>
          <TextInput
        accessibilityLabel="e.g. celebrating a birthday, window seat preferred"
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. celebrating a birthday, window seat preferred"
            placeholderTextColor={theme.colors.mutedGray}
            style={[styles.textInput, styles.multilineInput]}
            multiline
          />
        </View>

        <Pressable
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={submit}
          disabled={submitting}
        >
          <Text style={styles.submitButtonText}>{submitting ? 'Reserving...' : 'Confirm Reservation'}</Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardAvoider: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 17,
    color: theme.colors.white,
  },
  headerSpacer: {
    width: 32,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    // Clears MainNavigator's floating pill tab bar (bottom: 24 + height: 64)
    // plus breathing room, so the submit button never sits under it.
    paddingBottom: theme.spacing.xxl + 64,
    gap: theme.spacing.xl,
  },
  loungeName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 16,
    color: theme.colors.secondarySilver,
  },
  field: {
    gap: theme.spacing.sm,
  },
  fieldLabel: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.accentGold,
  },

  dateRow: {
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.md,
  },
  dateChip: {
    width: 52,
    height: 64,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.15),
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dateChipSelected: {
    backgroundColor: theme.colors.accentGold,
    borderColor: theme.colors.white,
  },
  dateChipWeekday: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.mutedGray,
  },
  dateChipDay: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 16,
    color: theme.colors.white,
  },
  dateChipTextSelected: {
    color: theme.colors.primaryBlack,
  },

  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  slotChip: {
    paddingHorizontal: theme.spacing.md,
    height: 38,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotChipSelected: {
    backgroundColor: theme.colors.accentGold,
    borderColor: theme.colors.white,
  },
  slotChipText: {
    ...theme.typography.medium,
    fontSize: 12.5,
    color: theme.colors.secondarySilver,
  },

  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  stepperButton: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.25),
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 18,
    color: theme.colors.white,
    minWidth: 24,
    textAlign: 'center',
  },

  textInput: {
    ...theme.typography.body,
    height: 50,
    fontSize: 14,
    color: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.15),
  },
  textInputError: {
    borderColor: theme.colors.danger,
  },
  multilineInput: {
    height: 80,
    paddingTop: theme.spacing.sm,
    textAlignVertical: 'top',
  },
  errorText: {
    ...theme.typography.caption,
    fontSize: 12,
    color: theme.colors.danger,
  },

  submitButton: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.accentGold,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 15,
    color: theme.colors.primaryBlack,
  },
});
