/**
 * MyShopsScreen
 *
 * What an owner sees after their claim is approved — reached from the My
 * Shops card on ProfileScreen, which only appears for members who actually
 * own or have claimed a lounge.
 *
 * This screen exists because approval used to be invisible. A member filled
 * in the claim form, saw an "under review" screen, and then nothing in the
 * app ever changed for them: `ownerId` was set on a document they couldn't
 * see, and although EditListingScreen and firestore.rules' isOwnListingEdit
 * had both existed for a while, there was no route to the former anywhere in
 * the app. Owners were granted a capability with no way to reach it.
 *
 * Division of labour between here and the Owner Portal is deliberate. The
 * light listing edit lives in the app because an owner already holding their
 * phone shouldn't have to open a laptop to fix their hours. Events,
 * inventory and reservations live only in the portal (owner-portal/), and
 * are genuinely absent here rather than stubbed — so this screen links out
 * instead of pretending, and says what the portal is for before sending
 * anyone to a browser.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, ExternalLink } from 'lucide-react-native';
import { theme } from '../theme';
import { getLoungesForOwner } from '../services/ownerService';
import type { OwnedLounge } from '../utils/ownedLounges';
import { auth } from '../services/firebaseAuth';
import type { ProfileStackParamList } from '../navigation/ProfileNavigator';
import type { MainTabParamList } from '../navigation/MainNavigator';
import { TAB_BAR_SCROLL_CLEARANCE } from '../utils/tabBarLayout';
import { OWNER_PORTAL_URL, OWNER_PORTAL_FEATURES } from '../config/ownerPortal';

type MyShopsNavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

export default function MyShopsScreen() {
  const navigation = useNavigation<MyShopsNavigationProp>();
  const tabNavigation = useNavigation<NavigationProp<MainTabParamList>>();
  const userId = auth.currentUser?.uid;

  const [shops, setShops] = useState<OwnedLounge[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!userId) {
      setShops([]);
      return;
    }
    setError(null);
    getLoungesForOwner(userId)
      .then(setShops)
      .catch(() => setError("Couldn't load your shops."));
  }, [userId]);

  // Refetched on focus so returning from Edit Listing shows the saved values,
  // and so an approval that lands while the app is open is picked up without
  // a restart.
  useFocusEffect(load);

  const openPortal = () => {
    // Failure is silent by design: there is nothing useful to tell someone
    // whose device has no browser, and an error alert over a link is worse
    // than the link quietly not opening.
    Linking.openURL(OWNER_PORTAL_URL).catch(() => {});
  };

  const openEditListing = (loungeId: string) => {
    // EditListing lives in the Search stack, so this is the same cross-tab
    // navigation MyReviewsScreen and ProfileScreen use.
    (tabNavigation.navigate as (name: string, params?: object) => void)('Search', {
      screen: 'EditListing',
      params: { loungeId },
    });
  };

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
        <Text style={styles.title}>My Shops</Text>
      </View>

      {error ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : shops === null ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.colors.secondarySilver} />
        </View>
      ) : shops.length === 0 ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>
            Lounges you claim will show up here once you’ve submitted a claim.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {shops.map(shop => (
            <View key={shop.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.loungeName} numberOfLines={1}>
                  {shop.name}
                </Text>
                <View style={[styles.pill, shop.approved ? styles.pillApproved : styles.pillPending]}>
                  {shop.approved ? (
                    <CheckCircle2 size={12} color={theme.colors.primaryNavy} />
                  ) : (
                    <Clock size={12} color={theme.colors.accentGold} />
                  )}
                  <Text
                    style={[
                      styles.pillText,
                      shop.approved ? styles.pillTextApproved : styles.pillTextPending,
                    ]}
                  >
                    {shop.approved ? 'Verified owner' : 'Under review'}
                  </Text>
                </View>
              </View>

              <Text style={styles.loungeAddress} numberOfLines={1}>
                {shop.address}
              </Text>

              {shop.approved ? (
                <Pressable style={styles.action} onPress={() => openEditListing(shop.id)}>
                  <Text style={styles.actionText}>Edit listing details</Text>
                  <ChevronRight size={16} color={theme.colors.accentGold} />
                </Pressable>
              ) : (
                // Says what "under review" actually means rather than showing a
                // disabled Edit button with no explanation of why.
                <Text style={styles.pendingNote}>
                  Our team is verifying your claim. You’ll get a notification
                  here as soon as it’s approved, and you’ll be able to edit
                  this listing then.
                </Text>
              )}
            </View>
          ))}

          {/* Only worth pointing an owner at the portal once they own something
              they could actually manage there. */}
          {shops.some(shop => shop.approved) ? (
            <View style={styles.portalCard}>
              <Text style={styles.portalTitle}>Owner Portal</Text>
              <Text style={styles.portalBody}>
                Manage the rest of your business from a browser:
              </Text>
              {OWNER_PORTAL_FEATURES.map(feature => (
                <Text key={feature} style={styles.portalFeature}>
                  • {feature}
                </Text>
              ))}
              <Text style={styles.portalNote}>
                Sign in with the same email and password you use here.
              </Text>
              <Pressable style={styles.portalButton} onPress={openPortal}>
                <ExternalLink size={16} color={theme.colors.primaryNavy} />
                <Text style={styles.portalButtonText}>Open Owner Portal</Text>
              </Pressable>
              <Text style={styles.portalUrl} selectable>
                {OWNER_PORTAL_URL}
              </Text>
            </View>
          ) : null}
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
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.headingMedium,
    fontSize: 18,
    color: theme.colors.white,
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: TAB_BAR_SCROLL_CLEARANCE,
    gap: theme.spacing.lg,
  },
  stateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  stateText: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.mutedGray,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surfaceNavy,
  },
  retryText: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.accentGold,
  },
  card: {
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  loungeName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.white,
    flex: 1,
  },
  loungeAddress: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  pillApproved: {
    backgroundColor: theme.colors.accentGold,
  },
  pillPending: {
    backgroundColor: theme.colors.background,
  },
  pillText: {
    ...theme.typography.medium,
    fontSize: 11,
  },
  pillTextApproved: {
    color: theme.colors.primaryNavy,
  },
  pillTextPending: {
    color: theme.colors.accentGold,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.background,
  },
  actionText: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.accentGold,
  },
  pendingNote: {
    ...theme.typography.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.secondarySilver,
  },
  portalCard: {
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.surfaceNavy,
  },
  portalTitle: {
    ...theme.typography.headingMedium,
    fontSize: 16,
    color: theme.colors.white,
  },
  portalBody: {
    ...theme.typography.body,
    fontSize: 13,
    color: theme.colors.secondarySilver,
  },
  portalFeature: {
    ...theme.typography.body,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.secondarySilver,
  },
  portalNote: {
    ...theme.typography.body,
    fontSize: 12,
    marginTop: theme.spacing.xs,
    color: theme.colors.mutedGray,
  },
  portalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.accentGold,
  },
  portalButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.primaryNavy,
  },
  // Selectable, and shown even though the button exists, so an owner who
  // prefers a desktop browser can read the address off their phone and type
  // it there.
  portalUrl: {
    ...theme.typography.medium,
    fontSize: 11,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
    color: theme.colors.mutedGray,
  },
});
