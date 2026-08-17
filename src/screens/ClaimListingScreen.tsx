/**
 * ClaimListingScreen
 *
 * Reached from LoungeDetailScreen's "Claim this business" button (shown
 * only on unclaimed lounges). Per Julian Brinkley's direction (2026-08-10):
 * this is a sales inquiry, not a self-service purchase — there is no
 * in-app payment. The plan is $399/month with a free 43" kiosk for the
 * life of the subscription; submitting here records a pending claim (see
 * ownerService.submitLoungeClaim — still reviewed by an admin, see
 * AdminClaimReviewScreen) and emails the business's contact info to our
 * sales team (functions/src/index.ts's sendClaimInquiryEmail) so they can
 * follow up and close the deal outside the app.
 */

import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { ChevronLeft, MonitorSmartphone } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import { submitLoungeClaim } from '../services/ownerService';
import { auth } from '../services/firebaseAuth';
import type { SearchStackParamList } from '../navigation/SearchNavigator';

type ClaimListingNavigationProp = NativeStackNavigationProp<SearchStackParamList>;
type ClaimListingRouteProp = RouteProp<SearchStackParamList, 'ClaimListing'>;

// Letters, spaces, hyphens, and apostrophes only — covers real names
// (e.g. "Mary-Jane O'Brien") while rejecting digits/symbols.
const NAME_CHARS_REGEX = /^[A-Za-z' -]*$/;
const NAME_REGEX = /^[A-Za-z]+(?:[' -][A-Za-z]+)*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const functions = getFunctions();

function formatPhone(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

export default function ClaimListingScreen() {
  const navigation = useNavigation<ClaimListingNavigationProp>();
  const route = useRoute<ClaimListingRouteProp>();
  const loungeId = route.params.loungeId;

  const [ownerName, setOwnerName] = useState('');
  const [ownerContactEmail, setOwnerContactEmail] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onChangeName = (text: string) => {
    if (!NAME_CHARS_REGEX.test(text)) {
      setNameError('Only letters, spaces, hyphens, and apostrophes are allowed.');
      return;
    }
    setOwnerName(text);
    if (nameError) setNameError('');
  };

  const onChangePhone = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 10);
    setPhoneDigits(digits);
    if (phoneError) setPhoneError('');
  };

  const submitInquiry = async () => {
    if (submitting) return;
    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert('Sign in required', 'Please sign in to claim this listing.');
      return;
    }

    const trimmedName = ownerName.trim();
    const trimmedEmail = ownerContactEmail.trim();

    let hasError = false;
    if (!NAME_REGEX.test(trimmedName)) {
      setNameError('Enter your full name using letters only.');
      hasError = true;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setEmailError('Enter a valid email address (e.g. you@yourbusiness.com).');
      hasError = true;
    }
    if (phoneDigits.length !== 10) {
      setPhoneError('Enter a valid 10-digit phone number.');
      hasError = true;
    }
    if (hasError) {
      return;
    }

    const ownerContactPhone = formatPhone(phoneDigits);

    setSubmitting(true);
    try {
      await submitLoungeClaim(loungeId, userId, {
        ownerName: trimmedName,
        ownerContactEmail: trimmedEmail,
        ownerContactPhone,
      });

      try {
        const sendInquiry = httpsCallable(functions, 'sendClaimInquiryEmail');
        await sendInquiry({ loungeId, ownerName: trimmedName, ownerContactEmail: trimmedEmail, ownerContactPhone });
      } catch {
        // Best-effort — the claim itself already saved and will still show
        // up in AdminClaimReviewScreen even if the sales notification email fails.
      }

      navigation.replace('ClaimSubmitted', { loungeId });
    } catch (error) {
      Alert.alert(
        "Couldn't submit your claim",
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
        <Text style={styles.headerTitle}>Claim This Business</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.intro}>
          Are you the owner or manager of this business? Claim your listing to edit its details —
          hours, description, amenities, and pricing.
        </Text>

        <View style={styles.pricingCard}>
          <View style={styles.pricingIconWrap}>
            <MonitorSmartphone size={26} color={theme.colors.accentGold} />
          </View>
          <Text style={styles.pricingTitle}>$399/month</Text>
          <Text style={styles.pricingSubtitle}>
            Includes a free 43&quot; in-store kiosk for the life of your subscription.
          </Text>
          <Text style={styles.pricingNote}>
            Submit your info below and our sales team will reach out to get you set up — no
            payment is collected in the app.
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Your Name</Text>
          <TextInput
        accessibilityLabel="Full name"
            value={ownerName}
            onChangeText={onChangeName}
            placeholder="Full name"
            placeholderTextColor={theme.colors.mutedGray}
            style={[styles.textInput, nameError && styles.textInputError]}
          />
          {!!nameError && <Text style={styles.errorText}>{nameError}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Business Email</Text>
          <TextInput
        accessibilityLabel="you@yourbusiness.com"
            value={ownerContactEmail}
            onChangeText={text => {
              setOwnerContactEmail(text);
              if (emailError) setEmailError('');
            }}
            placeholder="you@yourbusiness.com"
            placeholderTextColor={theme.colors.mutedGray}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.textInput, emailError && styles.textInputError]}
          />
          {!!emailError && <Text style={styles.errorText}>{emailError}</Text>}
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

        <Pressable
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={submitInquiry}
          disabled={submitting}
        >
          <Text style={styles.submitButtonText}>{submitting ? 'Submitting...' : 'Submit Inquiry'}</Text>
        </Pressable>
      </ScrollView>
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
  intro: {
    ...theme.typography.body,
    fontSize: 14,
    color: theme.colors.secondarySilver,
  },
  pricingCard: {
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.xs,
    ...theme.shadows.soft,
  },
  pricingIconWrap: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.accentGold, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  pricingTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 24,
    color: theme.colors.white,
  },
  pricingSubtitle: {
    ...theme.typography.body,
    fontSize: 13,
    color: theme.colors.secondarySilver,
    textAlign: 'center',
  },
  pricingNote: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.mutedGray,
    textAlign: 'center',
    textTransform: 'none',
    marginTop: theme.spacing.sm,
  },
  field: {
    gap: theme.spacing.sm,
  },
  fieldLabel: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.accentGold,
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
  errorText: {
    ...theme.typography.caption,
    fontSize: 12,
    color: theme.colors.danger,
  },
  submitButton: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
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
