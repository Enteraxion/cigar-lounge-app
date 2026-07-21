/**
 * ClaimListingScreen
 *
 * Reached from LoungeDetailScreen's "Claim this business" button (shown
 * only on unclaimed lounges). Collects the claimant's name/business
 * email/phone and calls ownerService.claimLounge — auto-approved, no
 * verification step yet (see that file's header comment). On success,
 * navigates back to LoungeDetail, which re-fetches and shows the owner
 * view (EditListingScreen entry point) instead of the claim button.
 */

import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { theme } from '../theme';
import { claimLounge } from '../services/ownerService';
import { auth } from '../services/firebaseAuth';
import type { SearchStackParamList } from '../navigation/SearchNavigator';

type ClaimListingNavigationProp = NativeStackNavigationProp<SearchStackParamList>;
type ClaimListingRouteProp = RouteProp<SearchStackParamList, 'ClaimListing'>;

export default function ClaimListingScreen() {
  const navigation = useNavigation<ClaimListingNavigationProp>();
  const route = useRoute<ClaimListingRouteProp>();
  const loungeId = route.params.loungeId;
  const userId = auth.currentUser?.uid;

  const [ownerName, setOwnerName] = useState('');
  const [ownerContactEmail, setOwnerContactEmail] = useState('');
  const [ownerContactPhone, setOwnerContactPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!userId) return;
    if (!ownerName.trim() || !ownerContactEmail.trim()) {
      Alert.alert('Missing info', 'Please enter your name and a business email.');
      return;
    }
    setSubmitting(true);
    try {
      await claimLounge(loungeId, userId, { ownerName, ownerContactEmail, ownerContactPhone });
      Alert.alert('Listing claimed', 'You can now edit this business’s details.');
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        "Couldn't claim this listing",
        error instanceof Error ? error.message : 'Check your connection and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
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

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Your Name</Text>
          <TextInput
            value={ownerName}
            onChangeText={setOwnerName}
            placeholder="Full name"
            placeholderTextColor={theme.colors.mutedGray}
            style={styles.textInput}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Business Email</Text>
          <TextInput
            value={ownerContactEmail}
            onChangeText={setOwnerContactEmail}
            placeholder="you@yourbusiness.com"
            placeholderTextColor={theme.colors.mutedGray}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.textInput}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Phone Number</Text>
          <TextInput
            value={ownerContactPhone}
            onChangeText={setOwnerContactPhone}
            placeholder="(optional)"
            placeholderTextColor={theme.colors.mutedGray}
            keyboardType="phone-pad"
            style={styles.textInput}
          />
        </View>

        <Pressable
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={submit}
          disabled={submitting}
        >
          <Text style={styles.submitButtonText}>{submitting ? 'Submitting...' : 'Claim Listing'}</Text>
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
    backgroundColor: 'rgba(192, 192, 192, 0.15)',
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
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  intro: {
    ...theme.typography.body,
    fontSize: 14,
    color: theme.colors.secondarySilver,
  },
  field: {
    gap: theme.spacing.sm,
  },
  fieldLabel: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.mutedGray,
  },
  textInput: {
    ...theme.typography.body,
    height: 50,
    fontSize: 14,
    color: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surfaceNavy,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.15)',
  },
  submitButton: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.white,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 15,
    color: theme.colors.primaryNavy,
  },
});
