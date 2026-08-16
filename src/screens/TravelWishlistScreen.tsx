/**
 * TravelWishlistScreen
 *
 * Matches design-reference/Travel Wishlist Screen.pdf: header, an active
 * plan hero card, a horizontal rail of upcoming destinations, a "Next Stop
 * Highlight" card, a horizontal rail of all saved lounges (reusing
 * CompactLoungeCard), a vertical travel timeline, and a floating "+"
 * button. Reached via the Favorites/Collections/Wishlist segmented
 * switcher (see FavoritesScreen).
 *
 * ONLY `activePlan`, `destinations` and `nextStopHighlight` (from
 * src/data/mockWishlist.ts) remain mock — there's no real "trip
 * planning"/"destinations" backend concept in this app yet.
 * "All Saved Lounges" is real: it fetches the signed-in user's actual
 * favorited lounges via userActionsService.ts's getUserFavorites(),
 * refetching on focus (useFocusEffect) so a lounge favorited elsewhere
 * shows up here immediately on return. The travel timeline is real too —
 * the member's five most recent visits (src/utils/passport.ts), replacing
 * a pair of invented trips every member saw identically. "Edit Route" / "View List" /
 * the floating "+" have no real backend to wire to yet, so they show a
 * "coming soon" alert instead of being silently dead.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { NavigationProp } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { Bell, MapPin, Plus, Star, User } from 'lucide-react-native';
import { theme } from '../theme';
import SectionHeader from '../components/SectionHeader';
import CompactLoungeCard from '../components/CompactLoungeCard';
import NotificationBadge from '../components/NotificationBadge';
import { useUserProfile } from '../hooks/useUserProfile';
import { useUnreadNotificationCount } from '../hooks/useUnreadNotificationCount';
import { auth } from '../services/firebaseAuth';
import { getUserFavorites } from '../services/userActionsService';
import type { Lounge } from '../services/loungeService';
import { buildWishlist, type WishlistDestination } from '../utils/wishlist';
import { getPassport } from '../services/passportService';
import type { Visit } from '../utils/passport';
import type { SavedStackParamList } from '../navigation/SavedNavigator';
import type { MainTabParamList } from '../navigation/MainNavigator';
import { displayTags } from '../utils/displayTags';

type WishlistNavigationProp = NativeStackNavigationProp<SavedStackParamList>;

function DestinationCard({ destination }: { destination: WishlistDestination }) {
  return (
    <View style={styles.destinationCard}>
      <Image source={{ uri: destination.image }} style={styles.destinationImage} />
      <LinearGradient
        colors={['transparent', 'rgba(5, 10, 24, 0.85)']}
        style={styles.destinationGradient}
        pointerEvents="none"
      />
      <View style={styles.destinationTextGroup}>
        <Text style={styles.destinationName} numberOfLines={1}>
          {destination.city}, {destination.country}
        </Text>
        <Text style={styles.destinationSubtitle}>{destination.loungesSaved} Lounges Saved</Text>
      </View>
    </View>
  );
}

function TimelineRow({ visit, onPress }: { visit: Visit; onPress: () => void }) {
  return (
    <Pressable style={styles.timelineRow} onPress={onPress}>
      <View style={styles.timelineDateBadge}>
        <Text style={styles.timelineMonth}>
          {visit.visitedAt.toLocaleDateString(undefined, { month: 'short' })}
        </Text>
        <Text style={styles.timelineDay}>{visit.visitedAt.getDate()}</Text>
      </View>
      <View style={styles.timelineTextGroup}>
        <Text style={styles.timelineTitle} numberOfLines={1}>
          {visit.loungeName}
        </Text>
        <Text style={styles.timelineLounges} numberOfLines={1}>
          {visit.city ?? visit.address}
        </Text>
      </View>
    </Pressable>
  );
}

export default function TravelWishlistScreen() {
  const navigation = useNavigation<WishlistNavigationProp>();
  const tabNavigation = useNavigation<NavigationProp<MainTabParamList>>();
  const { profile } = useUserProfile();
  const { count: unreadNotificationCount } = useUnreadNotificationCount();
  const userId = auth.currentUser?.uid;

  const [savedLounges, setSavedLounges] = useState<Lounge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The five most recent real visits — this section used to show two
  // invented trips ("New York Business Trip", "London Weekend Break")
  // that every member saw identically.
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);
  // Destinations, the plan summary and the next-stop highlight are all
  // derived from the member's own saved lounges — see src/utils/wishlist.ts.
  const wishlist = buildWishlist(savedLounges ?? [], recentVisits);
  const { activePlan, destinations, nextStopHighlight } = wishlist;

  const load = useCallback(async () => {
    if (!userId) {
      setSavedLounges([]);
      return;
    }
    setError(null);
    setSavedLounges(null);
    try {
      setSavedLounges(await getUserFavorites(userId));
    } catch {
      setError("Couldn't load your saved lounges. Check your connection and try again.");
    }
    try {
      const { passport } = await getPassport(userId);
      setRecentVisits(passport.visits.slice(0, 5));
    } catch {
      // The timeline has its own empty state — a saved-lounges failure is
      // what the error banner above is for, and this shouldn't trigger it.
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openLounge = (loungeId: string) => {
    // Cross-tab navigation into the Search stack's LoungeDetail screen —
    // see the same pattern/comment in FavoritesScreen.
    (tabNavigation.navigate as (name: string, params?: object) => void)('Search', {
      screen: 'LoungeDetail',
      params: { loungeId },
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ---------------- Header ---------------- */}
        <View style={styles.header}>
          {profile?.avatarUri ? (
            <Image source={{ uri: profile.avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <User size={20} color={theme.colors.secondarySilver} />
            </View>
          )}
          <View style={styles.headerTextGroup}>
            <Text style={styles.headerCaption}>Travel Wishlist</Text>
            <Text style={styles.headerTitle}>Adventure Bound</Text>
          </View>
          <Pressable
            style={styles.bellButton}
            hitSlop={8}
            onPress={() => (tabNavigation.navigate as (name: string, params?: object) => void)('Notifications')}
          >
            <Bell size={18} color={theme.colors.secondarySilver} />
            <NotificationBadge count={unreadNotificationCount} />
          </Pressable>
        </View>

        <View style={styles.segmentRow}>
          <Pressable style={styles.segment} onPress={() => navigation.navigate('FavoritesHome')}>
            <Text style={styles.segmentText}>Favorites</Text>
          </Pressable>
          <Pressable style={styles.segment} onPress={() => navigation.navigate('CollectionsGrid')}>
            <Text style={styles.segmentText}>Collections</Text>
          </Pressable>
          <Pressable style={[styles.segment, styles.segmentActive]}>
            <Text style={[styles.segmentText, styles.segmentTextActive]}>Wishlist</Text>
          </Pressable>
        </View>

        {/* ---------------- Active Plan Hero ---------------- */}
        <View style={styles.heroCard}>
          {activePlan.heroImage ? (
            <Image
              source={{ uri: activePlan.heroImage }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.heroImage} />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(5, 10, 24, 0.9)']}
            style={styles.heroGradient}
            pointerEvents="none"
          />
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Plan Active</Text>
          </View>
          <View style={styles.heroTextGroup}>
            <Text style={styles.heroName}>{activePlan.name}</Text>
            <Text style={styles.heroSubtitle}>
              {activePlan.destinationsCount} Destinations • {activePlan.savedLoungesCount} Saved
              Lounges
            </Text>
          </View>
        </View>

        {/* ---------------- Destinations ---------------- */}
        <View style={styles.section}>
          <SectionHeader
            title="Destinations"
            subtitle="Your upcoming stops"
            actionLabel="Edit Route"
            onActionPress={() => Alert.alert('Coming Soon', 'Trip route editing is coming soon.')}
          />
          <FlatList
            data={destinations}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ width: theme.spacing.md }} />}
            renderItem={({ item }) => <DestinationCard destination={item} />}
          />
        </View>

        {/* ---------------- Next Stop Highlight ---------------- */}
        {/* Hidden entirely when every saved lounge has been visited —
            there is no honest "next stop" to show, and an empty card
            would be worse than no card. */}
        {nextStopHighlight ? (
        <View style={styles.section}>
          <SectionHeader title="Next Stop Highlight" />
          <Pressable
            style={styles.highlightCard}
            onPress={() => openLounge(nextStopHighlight.loungeId)}
          >
            <Text style={styles.highlightLabel}>{nextStopHighlight.label}</Text>
            <Text style={styles.highlightName}>{nextStopHighlight.loungeName}</Text>

            <View style={styles.highlightBody}>
              <Image source={{ uri: nextStopHighlight.image }} style={styles.highlightThumb} />
              <View style={styles.highlightDetails}>
                <View style={styles.highlightStat}>
                  <View style={styles.highlightStatIcon}>
                    <MapPin size={14} color={theme.colors.secondarySilver} />
                  </View>
                  <View>
                    <Text style={styles.highlightStatLabel}>Location</Text>
                    <Text style={styles.highlightStatValue}>{nextStopHighlight.location}</Text>
                  </View>
                </View>
                <View style={styles.highlightStat}>
                  <View style={styles.highlightStatIcon}>
                    <Star size={14} color={theme.colors.accentGold} fill={theme.colors.accentGold} />
                  </View>
                  <View>
                    <Text style={styles.highlightStatLabel}>Rating</Text>
                    <Text style={styles.highlightStatValue}>
                      {nextStopHighlight.rating} • {nextStopHighlight.ratingLabel}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </Pressable>
        </View>
        ) : null}

        {/* ---------------- All Saved Lounges ---------------- */}
        <View style={styles.section}>
          <SectionHeader
            title="All Saved Lounges"
            actionLabel="View List"
            onActionPress={() => Alert.alert('Coming Soon', 'A full saved-lounges list view is coming soon.')}
          />
          {error ? (
            <View style={styles.savedLoungesStateBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryButton} onPress={load}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
            </View>
          ) : savedLounges === null ? (
            <View style={styles.savedLoungesStateBox}>
              <ActivityIndicator color={theme.colors.secondarySilver} />
            </View>
          ) : savedLounges.length === 0 ? (
            <View style={styles.savedLoungesStateBox}>
              <Text style={styles.emptyText}>
                You haven't favorited any lounges yet — they'll show up here once you do.
              </Text>
            </View>
          ) : (
            <FlatList
              data={savedLounges}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ width: theme.spacing.md }} />}
              renderItem={({ item }) => (
                <Pressable onPress={() => openLounge(item.id)}>
                  <CompactLoungeCard
                    image={{ uri: item.images[0] }}
                    name={item.name}
                    location={item.address}
                    tags={displayTags(item.tags)}
                    rating={item.ratings.overall}
                  />
                </Pressable>
              )}
            />
          )}
        </View>

        {/* ---------------- Travel Timeline ---------------- */}
        <View style={[styles.section, styles.lastSection]}>
          <SectionHeader title="Travel Timeline" />
          {recentVisits.length === 0 ? (
            <Text style={styles.timelineEmpty}>
              Review a lounge you've visited and your trips will show up here.
            </Text>
          ) : (
            <View style={styles.timelineList}>
              {recentVisits.map((visit, index) => (
                <TimelineRow
                  key={`${visit.loungeId}-${visit.visitedAt.getTime()}-${index}`}
                  visit={visit}
                  onPress={() => openLounge(visit.loungeId)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ---------------- Floating Action Button ---------------- */}
      <Pressable
        style={styles.fab}
        onPress={() => Alert.alert('Coming Soon', 'Adding new destinations is coming soon.')}
      >
        <Plus size={22} color={theme.colors.primaryNavy} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 140,
    gap: theme.spacing.xl,
  },

  // ---- Header ----
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.3)',
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.surfaceNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextGroup: {
    flex: 1,
  },
  headerCaption: {
    ...theme.typography.caption,
    color: theme.colors.mutedGray,
  },
  headerTitle: {
    ...theme.typography.headingSmall,
    color: theme.colors.white,
    marginTop: 2,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Segmented switcher ----
  segmentRow: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surfaceNavy,
  },
  segment: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.small,
  },
  segmentActive: {
    backgroundColor: theme.colors.white,
  },
  segmentText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.secondarySilver,
  },
  segmentTextActive: {
    color: theme.colors.primaryNavy,
  },

  // ---- Hero ----
  heroCard: {
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceNavy,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    height: 260,
    ...theme.shadows.soft,
  },
  heroImage: {
    ...StyleSheet.absoluteFill,
  },
  heroGradient: {
    ...StyleSheet.absoluteFill,
  },
  heroBadge: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
    backgroundColor: 'rgba(192, 192, 192, 0.85)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  heroBadgeText: {
    ...theme.typography.caption,
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.primaryNavy,
  },
  heroTextGroup: {
    padding: theme.spacing.md,
    gap: 4,
  },
  heroName: {
    ...theme.typography.headingLarge,
    fontSize: 30,
    color: theme.colors.white,
  },
  heroSubtitle: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.secondarySilver,
  },

  // ---- Sections ----
  section: {},
  lastSection: {
    marginBottom: 0,
  },

  // ---- Destinations ----
  destinationCard: {
    width: 160,
    height: 130,
    borderRadius: theme.radius.large,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.surfaceNavy,
  },
  destinationImage: {
    ...StyleSheet.absoluteFill,
  },
  destinationGradient: {
    ...StyleSheet.absoluteFill,
  },
  destinationTextGroup: {
    padding: theme.spacing.sm,
    gap: 2,
  },
  destinationName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.white,
  },
  destinationSubtitle: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.secondarySilver,
  },

  // ---- Next Stop Highlight ----
  highlightCard: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    gap: theme.spacing.sm,
    ...theme.shadows.soft,
  },
  highlightLabel: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.accentGold,
  },
  highlightName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 20,
    color: theme.colors.white,
  },
  highlightBody: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  highlightThumb: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.background,
  },
  highlightDetails: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  highlightStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  highlightStatIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.medium,
    backgroundColor: 'rgba(192, 192, 192, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightStatLabel: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.mutedGray,
  },
  highlightStatValue: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.white,
    marginTop: 2,
  },

  // ---- Travel Timeline ----
  timelineEmpty: {
    ...theme.typography.body,
    fontSize: 13,
    color: theme.colors.mutedGray,
  },
  timelineList: {
    gap: theme.spacing.md,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surfaceNavy,
    borderRadius: theme.radius.large,
    padding: theme.spacing.sm,
    ...theme.shadows.soft,
  },
  timelineDateBadge: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.medium,
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineMonth: {
    ...theme.typography.caption,
    color: theme.colors.accentGold,
  },
  timelineDay: {
    ...theme.typography.headingSmall,
    color: theme.colors.accentGold,
    marginTop: 2,
  },
  timelineTextGroup: {
    flex: 1,
    gap: 2,
  },
  timelineTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  timelineLounges: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },

  // ---- All Saved Lounges loading / error / empty ----
  savedLoungesStateBox: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  errorText: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.mutedGray,
    textAlign: 'center',
  },
  emptyText: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.mutedGray,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: theme.spacing.lg,
    height: 44,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surfaceNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.white,
  },

  // ---- FAB ----
  fab: {
    position: 'absolute',
    right: theme.spacing.lg,
    bottom: 96,
    width: 56,
    height: 56,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.deep,
  },
});
