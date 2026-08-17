/**
 * ClaimSubmittedScreen
 *
 * Shown right after ClaimListingScreen submits a claim inquiry. There is
 * no in-app payment (see ClaimListingScreen's header comment) — this
 * deliberately does NOT say "you're verified" or "you can now edit this
 * listing." The claim is recorded for a human admin to review (see
 * ownerService.submitLoungeClaim / AdminClaimReviewScreen.tsx) while
 * sales follows up separately on the $399/month plan. Same
 * full-screen-takeover pattern as ReviewSubmittedScreen — the tab bar
 * hides while this screen is focused, computed declaratively in
 * MainNavigator.tsx from the focused route name rather than this screen
 * calling setOptions itself (see that file's header comment for why the
 * old per-screen approach could leave the tab bar broken after
 * returning).
 */

import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowRight, Clock } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import type { SearchStackParamList } from '../navigation/SearchNavigator';

type ClaimSubmittedNavigationProp = NativeStackNavigationProp<SearchStackParamList>;
type ClaimSubmittedRouteProp = RouteProp<SearchStackParamList, 'ClaimSubmitted'>;

export default function ClaimSubmittedScreen() {
  const navigation = useNavigation<ClaimSubmittedNavigationProp>();
  const route = useRoute<ClaimSubmittedRouteProp>();
  const loungeId = route.params.loungeId;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Clock size={40} color={theme.colors.accentGold} />
        </View>

        <Text style={styles.title}>Inquiry Submitted</Text>
        <Text style={styles.subtitle}>
          Thanks — our sales team will reach out about the $399/month plan and your free 43&quot;
          kiosk. Your claim is also under manual review; you'll be notified once it's approved.
        </Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoCardText}>
            You won't be able to edit this listing until your claim is approved.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => navigation.navigate('LoungeDetail', { loungeId })}
        >
          <Text style={styles.primaryButtonText}>Return to Lounge</Text>
          <ArrowRight size={18} color={theme.colors.primaryBlack} />
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
    backgroundColor: withAlpha(theme.colors.accentGold, 0.12),
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
  infoCard: {
    width: '100%',
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.secondarySilver, 0.15),
    padding: theme.spacing.md,
  },
  infoCardText: {
    ...theme.typography.caption,
    fontSize: 12,
    color: theme.colors.secondarySilver,
    textAlign: 'center',
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
    color: theme.colors.primaryBlack,
  },
});
