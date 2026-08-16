/**
 * HomeScreen
 *
 * Matches design-reference/Home Screen.pdf top to bottom: header, featured
 * lounge hero, nearby lounges, cigar of the week, trending now, member
 * events, and a floating action button. Featured/Nearby/Trending Now all
 * read from Firestore via src/services/loungeService.ts — see that file
 * and src/types/firestore.ts for the schema. Featured is highest-rated;
 * Trending is most-reviewed; Nearby is sorted by real distance from the
 * app's placeholder "current location" (src/utils/loungeSearch.ts's
 * haversineDistanceMiles + src/data/mockMap.ts's defaultRegion — the same
 * stand-in Search/Map use, since there's no real device geolocation
 * anywhere in this app yet).
 *
 * TODO(firestore): Cigar of the Week and Member Events are still local
 * mock data (src/data/mockHome.ts) — neither is in the Firestore schema
 * yet. The header greeting (avatar/name) is the real signed-in user via
 * src/hooks/useUserProfile.ts.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import {
  Bell,
  ChevronRight,
  Compass,
  Clock,
  Leaf,
  MapPin,
  Plus,
  Star,
  User,
  Zap,
} from 'lucide-react-native';
import { theme } from '../theme';
import SectionHeader from '../components/SectionHeader';
import LoungeCard from '../components/LoungeCard';
import FavoriteButton from '../components/FavoriteButton';
import NotificationBadge from '../components/NotificationBadge';
import { getAllLounges, type Lounge } from '../services/loungeService';
import { getUserFavoriteIds } from '../services/userActionsService';
import { auth } from '../services/firebaseAuth';
import { useUserProfile } from '../hooks/useUserProfile';
import { useUnreadNotificationCount } from '../hooks/useUnreadNotificationCount';
import type { MainTabParamList } from '../navigation/MainNavigator';
import { haversineDistanceMiles } from '../utils/loungeSearch';
import { displayTags } from '../utils/displayTags';
import { defaultRegion } from '../data/mockMap';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { cigarOfTheWeek } from '../data/cigars';
import {
  getUpcomingEventsAcrossLounges,
  type MemberEvent,
} from '../services/eventService';

const NEARBY_COUNT = 4;
const TRENDING_COUNT = 3;
const EVENTS_COUNT = 5;

/** Real cigar for the current week — see src/data/cigars.ts. */
const cigarOfWeek = cigarOfTheWeek();

type TabNav = NavigationProp<MainTabParamList>;

/** Shortcuts behind the "+" button — every target is an existing screen. */
const QUICK_ACTIONS: {
  label: string;
  icon: typeof MapPin;
  go: (nav: TabNav) => void;
}[] = [
  { label: 'Find lounges near me', icon: MapPin, go: nav => nav.navigate('Map') },
  {
    label: 'Search by name or city',
    icon: Compass,
    go: nav => (nav.navigate as (n: string, p?: object) => void)('Search', { screen: 'SearchHome' }),
  },
  {
    label: 'My Cigar Passport',
    icon: User,
    go: nav =>
      (nav.navigate as (n: string, p?: object) => void)('Profile', { screen: 'Passport' }),
  },
];

export default function HomeScreen() {
  const tabNavigation = useNavigation<NavigationProp<MainTabParamList>>();
  const { profile } = useUserProfile();
  const { count: unreadNotificationCount } = useUnreadNotificationCount();
  const { location: currentLocation } = useCurrentLocation();
  const [lounges, setLounges] = useState<Lounge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  // Real owner-posted events across every lounge. Empty until a shop
  // posts one from the Owner Portal, which is the honest state — this
  // rail used to show two invented events no shop had ever posted.
  const [events, setEvents] = useState<MemberEvent[]>([]);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  const userId = auth.currentUser?.uid;

  const openLoungeDetails = (loungeId: string) => {
    // Cross-tab navigation into the Search stack's LoungeDetail screen —
    // see the same pattern/comment in MapScreen.
    (tabNavigation.navigate as (name: string, params?: object) => void)('Search', {
      screen: 'LoungeDetail',
      params: { loungeId },
    });
  };

  const loadLounges = useCallback(async () => {
    setError(null);
    setLounges(null);
    try {
      const [result, favoritedIds] = await Promise.all([
        getAllLounges(),
        userId ? getUserFavoriteIds(userId) : Promise.resolve<string[]>([]),
      ]);
      setLounges(result);
      setFavoriteIds(new Set(favoritedIds));
    } catch {
      setError("Couldn't load lounges. Check your connection and try again.");
    }
  }, [userId]);

  useEffect(() => {
    loadLounges();
  }, [loadLounges]);

  // Events load independently of lounges: an events failure (or simply
  // no shop having posted one) must not take the whole Home screen down.
  useEffect(() => {
    getUpcomingEventsAcrossLounges(EVENTS_COUNT)
      .then(setEvents)
      .catch(() => setEvents([]));
  }, []);

  const featuredLounge = lounges?.length
    ? [...lounges].sort((a, b) => b.ratings.overall - a.ratings.overall)[0]
    : null;

  // Sorted by distance from the user's real device location (see
  // src/hooks/useCurrentLocation.ts), falling back to defaultRegion if
  // permission was denied or no fix is available yet — same reference
  // point Search/Map use.
  const nearbyLounges = lounges
    ? [...lounges]
        .filter(l => l.id !== featuredLounge?.id)
        .sort(
          (a, b) =>
            haversineDistanceMiles(currentLocation ?? defaultRegion, a.coordinates) -
            haversineDistanceMiles(currentLocation ?? defaultRegion, b.coordinates),
        )
        .slice(0, NEARBY_COUNT)
    : [];

  const trendingLounges = lounges
    ? [...lounges]
        .filter(l => l.id !== featuredLounge?.id)
        .sort((a, b) => b.reviewCount - a.reviewCount)
        .slice(0, TRENDING_COUNT)
    : [];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------- Header ---------------- */}
        <View style={styles.header}>
          <Pressable
            style={styles.headerLeft}
            onPress={() => (tabNavigation.navigate as (name: string, params?: object) => void)('Profile')}
          >
            {profile?.avatarUri ? (
              <Image source={{ uri: profile.avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <User size={20} color={theme.colors.secondarySilver} />
              </View>
            )}
            <View>
              <Text style={styles.welcomeCaption}>Welcome back</Text>
              <Text style={styles.welcomeName}>{profile?.name ?? 'Member'}</Text>
            </View>
          </Pressable>
          <Pressable
            style={styles.bellButton}
            hitSlop={8}
            onPress={() => (tabNavigation.navigate as (name: string, params?: object) => void)('Notifications')}
          >
            <Bell size={18} color={theme.colors.secondarySilver} />
            <NotificationBadge count={unreadNotificationCount} />
          </Pressable>
        </View>

        {lounges === null && !error ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={theme.colors.secondarySilver} />
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={loadLounges}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* ---------------- Featured Lounge ---------------- */}
            {featuredLounge ? (
              <Pressable
                style={styles.featuredCard}
                onPress={() => openLoungeDetails(featuredLounge.id)}
              >
                <Image
                  source={{ uri: featuredLounge.images[0] }}
                  style={styles.featuredImage}
                  resizeMode="cover"
                />
                <View style={styles.featuredBadgeRow}>
                  <View style={styles.featuredBadge}>
                    <Text style={styles.featuredBadgeText}>Featured Lounge</Text>
                  </View>
                  <View style={styles.featuredTopRight}>
                    <View style={styles.ratingPill}>
                      <Star size={12} color={theme.colors.accentGold} fill={theme.colors.accentGold} />
                      <Text style={styles.ratingPillText}>{featuredLounge.ratings.overall}</Text>
                    </View>
                    {userId ? (
                      <FavoriteButton
                        style={styles.featuredFavoriteButton}
                        userId={userId}
                        loungeId={featuredLounge.id}
                        initialFavorited={favoriteIds.has(featuredLounge.id)}
                      />
                    ) : null}
                  </View>
                </View>

                <View style={styles.featuredBody}>
                  <Text style={styles.featuredName}>{featuredLounge.name}</Text>
                  <View style={styles.locationRow}>
                    <MapPin size={14} color={theme.colors.secondarySilver} />
                    <Text style={styles.locationText}>{featuredLounge.address}</Text>
                  </View>
                  <Pressable
                    style={styles.reserveButton}
                    onPress={() =>
                      (tabNavigation.navigate as (name: string, params?: object) => void)('Search', {
                        screen: 'ReserveTable',
                        params: { loungeId: featuredLounge.id, loungeName: featuredLounge.name },
                      })
                    }
                  >
                    <Text style={styles.reserveButtonText}>Reserve a Table</Text>
                    <ChevronRight size={16} color={theme.colors.primaryNavy} />
                  </Pressable>
                </View>
              </Pressable>
            ) : null}

            {/* ---------------- Nearby Lounges ---------------- */}
            <View style={styles.section}>
              <SectionHeader
                title="Nearby Lounges"
                // Deliberately not a fixed radius: nearbyLounges below is the
                // N closest lounges sorted by real distance, with no cutoff, so
                // the section is still useful somewhere with nothing within a
                // few miles. The old copy claimed "Within 5 miles of your
                // location", which was doubly wrong — nothing filtered to 5
                // miles, and "View All" hands SearchResults a 25-mile radius
                // (defaultDistanceMiles), so the two disagreed.
                subtitle="Closest to your location"
                actionLabel="View All"
                onActionPress={() =>
                  (tabNavigation.navigate as (name: string, params?: object) => void)('Search', {
                    screen: 'SearchResults',
                    params: { initialFilters: { nearCurrentLocation: true } },
                  })
                }
              />
              <FlatList
                data={nearbyLounges}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={{ width: theme.spacing.md }} />}
                renderItem={({ item }) => (
                  <Pressable onPress={() => openLoungeDetails(item.id)}>
                    <LoungeCard
                      image={{ uri: item.images[0] }}
                      name={item.name}
                      tags={displayTags(item.tags).join(' • ')}
                      rating={item.ratings.overall}
                      loungeId={item.id}
                      userId={userId}
                      favorited={favoriteIds.has(item.id)}
                    />
                  </Pressable>
                )}
              />
            </View>
          </>
        )}

        {/* ---------------- Cigar of the Week ---------------- */}
        <View style={styles.section}>
          <SectionHeader title="Cigar of the Week" />
          <View style={styles.cigarCard}>
            <Image
              source={{ uri: cigarOfWeek.imageUri }}
              style={styles.cigarImage}
              resizeMode="cover"
            />
            <View style={styles.cigarDetails}>
              <Text style={styles.cigarBrandLabel}>{cigarOfWeek.brand.toUpperCase()}</Text>
              <Text style={styles.cigarName}>{cigarOfWeek.name}</Text>

              <View style={styles.cigarStat}>
                <View style={styles.cigarStatIcon}>
                  <Leaf size={14} color={theme.colors.secondarySilver} />
                </View>
                <View>
                  <Text style={styles.cigarStatLabel}>Wrapper</Text>
                  <Text style={styles.cigarStatValue}>{cigarOfWeek.wrapper}</Text>
                </View>
              </View>

              <View style={styles.cigarStat}>
                <View style={styles.cigarStatIcon}>
                  <Zap size={14} color={theme.colors.secondarySilver} />
                </View>
                <View>
                  <Text style={styles.cigarStatLabel}>Strength</Text>
                  <Text style={styles.cigarStatValue}>{cigarOfWeek.strength}</Text>
                </View>
              </View>

              <View style={styles.cigarStat}>
                <View style={styles.cigarStatIcon}>
                  <Clock size={14} color={theme.colors.secondarySilver} />
                </View>
                <View>
                  <Text style={styles.cigarStatLabel}>Burn Time</Text>
                  <Text style={styles.cigarStatValue}>{cigarOfWeek.burnTime}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ---------------- Trending Now ---------------- */}
        {lounges && !error ? (
          <View style={styles.section}>
            <SectionHeader
              title="Trending Now"
              actionLabel="View All"
              onActionPress={() =>
                (tabNavigation.navigate as (name: string, params?: object) => void)('Search', {
                  screen: 'SearchResults',
                })
              }
            />
            <FlatList
              data={trendingLounges}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ width: theme.spacing.md }} />}
              renderItem={({ item }) => (
                <Pressable onPress={() => openLoungeDetails(item.id)}>
                  <LoungeCard
                    image={{ uri: item.images[0] }}
                    name={item.name}
                    location={item.address}
                    loungeId={item.id}
                    userId={userId}
                    favorited={favoriteIds.has(item.id)}
                  />
                </Pressable>
              )}
            />
          </View>
        ) : null}

        {/* ---------------- Member Events ---------------- */}
        {/* Real events posted by shop owners from the Owner Portal. The
            per-row "+" that used to sit here promised members could add
            their own events — nothing in the schema or the rules allows
            that (events are owner-authored only), so the row now opens
            the lounge hosting it, which is the thing a member can act on. */}
        <View style={[styles.section, styles.lastSection]}>
          <SectionHeader title="Member Events" />
          {events.length === 0 ? (
            <Text style={styles.eventsEmpty}>
              No events posted yet. Lounges announce tastings and cigar nights here.
            </Text>
          ) : (
            <View style={{ gap: theme.spacing.md }}>
              {events.map(event => {
                const startsAt = event.startsAt.toDate();
                return (
                  <Pressable
                    key={event.id}
                    style={styles.eventRow}
                    onPress={() => openLoungeDetails(event.loungeId)}
                  >
                    <View style={styles.eventDateBadge}>
                      <Text style={styles.eventMonth}>
                        {startsAt.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
                      </Text>
                      <Text style={styles.eventDay}>{startsAt.getDate()}</Text>
                    </View>
                    <View style={styles.eventDetails}>
                      <Text style={styles.eventTitle} numberOfLines={2}>
                        {event.title}
                      </Text>
                      <Text style={styles.eventVenue}>
                        {startsAt.toLocaleTimeString(undefined, {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={theme.colors.mutedGray} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ---------------- Floating Action Button ---------------- */}
      {/* Was an Alert.alert('Coming Soon'). Every destination below is a
          screen that already exists, so this is a real shortcut rather
          than a new feature — the fastest routes into the three things a
          member actually opens this app to do. */}
      <Pressable style={styles.fab} onPress={() => setQuickActionsOpen(true)}>
        <Plus size={22} color={theme.colors.primaryNavy} />
      </Pressable>

      <Modal
        visible={quickActionsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setQuickActionsOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setQuickActionsOpen(false)}>
          <Pressable style={styles.sheet} onPress={event => event.stopPropagation()}>
            <Text style={styles.sheetTitle}>Quick Actions</Text>
            {QUICK_ACTIONS.map(action => (
              <Pressable
                key={action.label}
                style={styles.sheetRow}
                onPress={() => {
                  setQuickActionsOpen(false);
                  action.go(tabNavigation);
                }}
              >
                <action.icon size={18} color={theme.colors.accentGold} />
                <Text style={styles.sheetRowText}>{action.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 140,
    gap: theme.spacing.xl,
  },

  // ---- Header ----
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
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
  welcomeCaption: {
    ...theme.typography.caption,
    color: theme.colors.mutedGray,
  },
  welcomeName: {
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

  // ---- Loading / error state ----
  stateBox: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  errorText: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.mutedGray,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
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

  // ---- Featured Lounge ----
  featuredCard: {
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceNavy,
    overflow: 'hidden',
    ...theme.shadows.soft,
  },
  featuredImage: {
    width: '100%',
    height: 220,
  },
  featuredBadgeRow: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
    right: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  featuredBadge: {
    backgroundColor: theme.colors.accentGold,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  featuredBadgeText: {
    ...theme.typography.caption,
    color: theme.colors.primaryNavy,
  },
  featuredTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(5, 10, 24, 0.75)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  ratingPillText: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.white,
  },
  featuredFavoriteButton: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(5, 10, 24, 0.75)',
  },
  featuredBody: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  featuredName: {
    ...theme.typography.headingMedium,
    fontSize: 26,
    color: theme.colors.white,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    ...theme.typography.medium,
    color: theme.colors.secondarySilver,
  },
  reserveButton: {
    marginTop: theme.spacing.xs,
    height: 48,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  reserveButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.primaryNavy,
  },

  // ---- Sections ----
  section: {
    gap: 0,
  },
  lastSection: {
    marginBottom: theme.spacing.xl,
  },

  // ---- Cigar of the Week ----
  cigarCard: {
    flexDirection: 'row',
    borderRadius: theme.radius.large,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceNavy,
    ...theme.shadows.soft,
  },
  cigarImage: {
    width: '38%',
  },
  cigarDetails: {
    flex: 1,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cigarBrandLabel: {
    ...theme.typography.caption,
    color: theme.colors.accentGold,
  },
  cigarName: {
    ...theme.typography.headingSmall,
    color: theme.colors.white,
    marginBottom: theme.spacing.xs,
  },
  cigarStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  cigarStatIcon: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.small,
    backgroundColor: 'rgba(192, 192, 192, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cigarStatLabel: {
    ...theme.typography.caption,
    color: theme.colors.mutedGray,
  },
  cigarStatValue: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.white,
    marginTop: 2,
  },

  // ---- Member Events ----
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surfaceNavy,
    borderRadius: theme.radius.large,
    padding: theme.spacing.sm,
    ...theme.shadows.soft,
  },
  eventDateBadge: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.medium,
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventMonth: {
    ...theme.typography.caption,
    color: theme.colors.accentGold,
  },
  eventDay: {
    ...theme.typography.headingSmall,
    color: theme.colors.accentGold,
    marginTop: 2,
  },
  eventDetails: {
    flex: 1,
    gap: 2,
  },
  eventTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  eventVenue: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },
  eventsEmpty: {
    ...theme.typography.body,
    fontSize: 13,
    color: theme.colors.mutedGray,
  },

  // ---- Quick actions sheet ----
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 24, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surfaceNavy,
    borderTopLeftRadius: theme.radius.large,
    borderTopRightRadius: theme.radius.large,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.xs,
  },
  sheetTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 16,
    color: theme.colors.white,
    marginBottom: theme.spacing.sm,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  sheetRowText: {
    ...theme.typography.medium,
    fontSize: 15,
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
