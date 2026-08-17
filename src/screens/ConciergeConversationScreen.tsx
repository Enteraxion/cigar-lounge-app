/**
 * ConciergeConversationScreen
 *
 * Matches design-reference/Concierge Home & Conversation View.pdf (bottom
 * half): a message thread where user turns render as right-aligned text
 * bubbles and AI turns render as rich recommendation cards (image, name,
 * distance, rating, amenity tags, quick actions) rather than chat
 * bubbles — that's the deliberate differentiator from a generic chatbot
 * look. Sending a message shows a brief "Crafting Your Experience"
 * loading state, then either a recommendation or a "No Lounges Found"
 * card. Mock data + keyword matching only (see src/data/mockConcierge.ts)
 * — no real AI wired up yet.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  Heart,
  MapPin,
  Navigation,
  Search,
  Send,
  Share2,
  Sparkles,
  Star,
} from 'lucide-react-native';
import { theme } from '../theme';
import {
  conciergeUser,
  loadingStatusMessages,
  noResultsSuggestions,
  type CompactSuggestion,
  type RecommendationCard,
} from '../data/mockConcierge';
import { askConcierge, type ConciergeTurn } from '../services/conciergeService';
import { useUserProfile } from '../hooks/useUserProfile';
import { displayTags } from '../utils/displayTags';
import type { Lounge } from '../services/loungeService';
import type { ConciergeStackParamList } from '../navigation/ConciergeNavigator';
import { loungeImageUri } from '../utils/loungeImage';

/**
 * Defined here rather than imported from mockConcierge because a real
 * reply often has no lounge attached at all — the member asked how to cut
 * a cigar, not where to smoke one — which the mock shape couldn't express.
 */
type ConversationMessage =
  | { id: string; role: 'user'; text: string; timestamp: string }
  | {
      id: string;
      role: 'ai';
      text: string;
      recommendation: RecommendationCard | null;
      moreSuggestion?: CompactSuggestion;
    }
  | { id: string; role: 'ai-no-results'; query: string };

/** Real lounge → the card this screen already knows how to render. */
function toRecommendationCard(lounge: Lounge): RecommendationCard {
  return {
    id: lounge.id,
    name: lounge.name,
    location: lounge.city ?? lounge.address,
    // Distance needs a device fix this screen doesn't have; the card hides
    // the row when it's empty rather than printing an invented number.
    distance: '',
    rating: lounge.ratings.overall,
    image: loungeImageUri(lounge),
    tags: displayTags(lounge.tags).slice(0, 3),
  };
}

function toCompactSuggestion(lounge: Lounge): CompactSuggestion {
  return {
    id: lounge.id,
    name: lounge.name,
    subtitle: lounge.city ?? lounge.address,
    image: loungeImageUri(lounge),
  };
}

type ConciergeNavigationProp = NativeStackNavigationProp<ConciergeStackParamList>;
type ConciergeConversationRouteProp = RouteProp<ConciergeStackParamList, 'ConciergeConversation'>;

function LoadingOverlay() {
  const spin = useRef(new Animated.Value(0)).current;
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spinLoop.start();
    const interval = setInterval(() => {
      setStatusIndex(index => (index + 1) % loadingStatusMessages.length);
    }, 850);
    return () => {
      spinLoop.stop();
      clearInterval(interval);
    };
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.loadingScreen}>
      <View style={styles.loadingRing}>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Sparkles size={30} color={theme.colors.accentGold} />
        </Animated.View>
      </View>
      <Text style={styles.loadingTitle}>Crafting Your Experience</Text>
      <Text style={styles.loadingStatus}>{loadingStatusMessages[statusIndex]}</Text>
    </View>
  );
}

function RecommendationCardView({
  card,
  favorited,
  onToggleFavorite,
  onViewDetails,
}: {
  card: RecommendationCard;
  favorited: boolean;
  onToggleFavorite: () => void;
  onViewDetails: () => void;
}) {
  const onShare = () => {
    Share.share({ message: card.name }).catch(() => {});
  };

  const onGetDirections = () => {
    // RecommendationCard has no lat/lng fields (see mockConcierge.ts), so
    // fall back to a text search query built from the lounge's name/location.
    const query = encodeURIComponent(`${card.name} ${card.location}`);
    const url =
      Platform.OS === 'ios'
        ? `https://maps.apple.com/?q=${query}`
        : `https://www.google.com/maps/search/?api=1&query=${query}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={styles.recCard}>
      <View style={styles.recImageWrap}>
        <Image source={{ uri: card.image }} style={styles.recImage} />
        <View style={styles.recRatingBadge}>
          <Star size={11} color={theme.colors.accentGold} fill={theme.colors.accentGold} />
          <Text style={styles.recRatingText}>{card.rating}</Text>
        </View>
      </View>

      <View style={styles.recBody}>
        <View style={styles.recNameRow}>
          <Text style={styles.recName} numberOfLines={1}>
            {card.name}
          </Text>
          {card.distance ? <Text style={styles.recDistance}>{card.distance}</Text> : null}
        </View>
        <View style={styles.recLocationRow}>
          <MapPin size={12} color={theme.colors.mutedGray} />
          <Text style={styles.recLocationText}>{card.location}</Text>
        </View>

        <View style={styles.recTagRow}>
          {card.tags.map(tag => (
            <View key={tag} style={styles.recTagChip}>
              <Text style={styles.recTagText}>{tag}</Text>
            </View>
          ))}
        </View>

        <View style={styles.recActionRow}>
          <Pressable style={styles.viewDetailsButton} onPress={onViewDetails}>
            <Text style={styles.viewDetailsText}>View Details</Text>
          </Pressable>
          <Pressable style={styles.directionsButton} onPress={onGetDirections}>
            <Navigation size={14} color={theme.colors.white} />
            <Text style={styles.directionsText}>Directions</Text>
          </Pressable>
        </View>

        <View style={styles.recSecondaryRow}>
          <Pressable style={styles.secondaryAction} onPress={onToggleFavorite} hitSlop={8}>
            <Heart
              size={14}
              color={favorited ? theme.colors.accentGold : theme.colors.mutedGray}
              fill={favorited ? theme.colors.accentGold : 'transparent'}
            />
            <Text style={styles.secondaryActionText}>Save</Text>
          </Pressable>
          <Pressable style={styles.secondaryAction} onPress={onShare} hitSlop={8}>
            <Share2 size={14} color={theme.colors.mutedGray} />
            <Text style={styles.secondaryActionText}>Share</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function CompactSuggestionRow({ suggestion }: { suggestion: CompactSuggestion }) {
  return (
    <View style={styles.compactRow}>
      <Image source={{ uri: suggestion.image }} style={styles.compactThumb} />
      <View style={styles.compactTextGroup}>
        <Text style={styles.compactName} numberOfLines={1}>
          {suggestion.name}
        </Text>
        <Text style={styles.compactSubtitle} numberOfLines={1}>
          {suggestion.subtitle}
        </Text>
      </View>
      <ChevronRight size={16} color={theme.colors.secondarySilver} />
    </View>
  );
}

function NoResultsCard({
  query,
  onExplore,
  onOpenMap,
}: {
  query: string;
  onExplore: () => void;
  onOpenMap: () => void;
}) {
  return (
    <View style={styles.noResultsCard}>
      <View style={styles.noResultsIconBox}>
        <Search size={22} color={theme.colors.mutedGray} />
      </View>
      <Text style={styles.noResultsTitle}>No Lounges Found</Text>
      <Text style={styles.noResultsText}>
        We couldn&apos;t find a match for &quot;{query}&quot;. Try:
      </Text>
      <View style={styles.noResultsList}>
        {noResultsSuggestions.map(suggestion => (
          <View key={suggestion} style={styles.noResultsRow}>
            <View style={styles.noResultsDot} />
            <Text style={styles.noResultsRowText}>{suggestion}</Text>
          </View>
        ))}
      </View>
      <View style={styles.noResultsActionRow}>
        <Pressable style={styles.noResultsPrimaryButton} onPress={onExplore}>
          <Text style={styles.noResultsPrimaryText}>Explore Nearby Lounges</Text>
        </Pressable>
        <Pressable style={styles.noResultsSecondaryButton} onPress={onOpenMap}>
          <Text style={styles.noResultsSecondaryText}>Open Map</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ConciergeConversationScreen() {
  const navigation = useNavigation<ConciergeNavigationProp>();
  const route = useRoute<ConciergeConversationRouteProp>();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const handledInitialQuery = useRef(false);
  const { profile } = useUserProfile();

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    const userMessage: ConversationMessage = {
      id: `user-${messages.length}-${trimmed.slice(0, 8)}`,
      role: 'user',
      text: trimmed,
      timestamp: 'Sent just now',
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    // The whole conversation goes back each turn — the concierge is
    // stateless server-side, so this is what gives it memory of what the
    // member already said.
    const turns: ConciergeTurn[] = [...messages, userMessage]
      .filter((m): m is Extract<ConversationMessage, { role: 'user' | 'ai' }> =>
        m.role === 'user' || m.role === 'ai',
      )
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', text: m.text }));

    const key = `ai-${messages.length}-${trimmed.slice(0, 8)}`;
    askConcierge(turns, profile?.homeCity)
      .then(({ reply, lounges }) => {
        setMessages(prev => [
          ...prev,
          lounges.length > 0
            ? {
                id: key,
                role: 'ai',
                text: reply,
                recommendation: toRecommendationCard(lounges[0]),
                moreSuggestion: lounges[1] ? toCompactSuggestion(lounges[1]) : undefined,
              }
            : { id: key, role: 'ai', text: reply, recommendation: null },
        ]);
      })
      .catch(() => {
        setMessages(prev => [...prev, { id: key, role: 'ai-no-results', query: trimmed }]);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (route.params?.initialQuery && !handledInitialQuery.current) {
      handledInitialQuery.current = true;
      sendMessage(route.params.initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.initialQuery]);

  // Concierge recommendation *content* is still mock (from
  // mockConcierge.ts) — the AI Concierge is out of scope for real backend
  // wiring in this pass. The mock card's own `id` is never a real
  // Firestore lounge id, so rather than navigate straight to a "not
  // found" LoungeDetail, best-effort match the card's name against real
  // lounges (see useLoungeNameLookup) and only navigate when it resolves.
  const openLoungeDetails = (card: RecommendationCard) => {
    // card.id is a real Firestore lounge id now — the concierge only ever
    // recommends from lounges the function pulled out of the database, so
    // the old best-effort name match (useLoungeNameLookup, needed while the
    // recommendations were invented) isn't required any more.
    const realLoungeId = card.id;
    // Cross-boundary navigation from this root-level modal stack into
    // Main's Search tab stack's LoungeDetail screen. RootStackParamList
    // doesn't model nested-stack params, so a plain typed call can't
    // express this; React Navigation supports nested `screen`/`params`
    // objects fine at runtime.
    (navigation.navigate as (name: string, params?: object) => void)('Main', {
      screen: 'Search',
      params: { screen: 'LoungeDetail', params: { loungeId: realLoungeId } },
    });
  };

  const exploreNearbyLounges = () => {
    (navigation.navigate as (name: string, params?: object) => void)('Main', { screen: 'Search' });
  };

  const openMap = () => {
    (navigation.navigate as (name: string, params?: object) => void)('Main', { screen: 'Map' });
  };

  const toggleFavorite = (id: string) => {
    setFavoritedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* ---------------- Header ---------------- */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back" hitSlop={12}>
          <ChevronLeft size={24} color={theme.colors.white} />
        </Pressable>
        <Image source={{ uri: conciergeUser.avatarUri }} style={styles.avatar} />
        <View style={styles.headerTextGroup}>
          <Text style={styles.headerCaption}>AI Concierge</Text>
          <Text style={styles.headerName}>{conciergeUser.name}</Text>
        </View>
        <Pressable
          style={styles.optionsButton}
          onPress={() => Alert.alert('Coming Soon', 'Conversation options are coming soon.')}
          hitSlop={8}
        >
          <EllipsisVertical size={18} color={theme.colors.secondarySilver} />
        </Pressable>
      </View>

      {isLoading ? (
        <LoadingOverlay />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {messages.map(message => {
            if (message.role === 'user') {
              return (
                <View key={message.id} style={styles.userBlock}>
                  <View style={styles.userBubble}>
                    <Text style={styles.userBubbleText}>{message.text}</Text>
                  </View>
                  <Text style={styles.userTimestamp}>{message.timestamp}</Text>
                </View>
              );
            }

            if (message.role === 'ai-no-results') {
              return (
                <View key={message.id} style={styles.aiBlock}>
                  <NoResultsCard
                    query={message.query}
                    onExplore={exploreNearbyLounges}
                    onOpenMap={openMap}
                  />
                </View>
              );
            }

            // A reply with no lounge attached is normal, not a failure —
            // "how do I cut a torpedo?" has an answer and no venue.
            const card = message.recommendation;
            return (
              <View key={message.id} style={styles.aiBlock}>
                <View style={styles.aiTextCard}>
                  <Text style={styles.aiText}>{message.text}</Text>
                </View>
                {card ? (
                  <RecommendationCardView
                    card={card}
                    favorited={favoritedIds.has(card.id)}
                    onToggleFavorite={() => toggleFavorite(card.id)}
                    onViewDetails={() => openLoungeDetails(card)}
                  />
                ) : null}
                {message.moreSuggestion ? (
                  <CompactSuggestionRow suggestion={message.moreSuggestion} />
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ---------------- Input bar ---------------- */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputBar}>
          <TextInput
        accessibilityLabel="Ask anything..."
            style={styles.input}
            placeholder="Ask anything..."
            placeholderTextColor={theme.colors.mutedGray}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => sendMessage(inputText)}
            editable={!isLoading}
            returnKeyType="send"
          />
          <Pressable style={styles.sendButton} onPress={() => sendMessage(inputText)} hitSlop={8}>
            <Send size={16} color={theme.colors.primaryNavy} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // ---- Header ----
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
  },
  headerTextGroup: {
    flex: 1,
    gap: 2,
  },
  headerCaption: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.mutedGray,
  },
  headerName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.white,
  },
  optionsButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.lg,
  },

  // ---- Loading ----
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
  },
  loadingRing: {
    width: 84,
    height: 84,
    borderRadius: theme.radius.full,
    borderWidth: 2,
    borderColor: 'rgba(234, 179, 8, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTitle: {
    ...theme.typography.headingSmall,
    fontSize: 18,
    color: theme.colors.white,
  },
  loadingStatus: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.mutedGray,
  },

  // ---- User message ----
  userBlock: {
    alignItems: 'flex-end',
    gap: 4,
  },
  userBubble: {
    maxWidth: '85%',
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    borderTopRightRadius: theme.radius.small,
    backgroundColor: theme.colors.surfaceNavy,
  },
  userBubbleText: {
    ...theme.typography.medium,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.white,
  },
  userTimestamp: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.mutedGray,
  },

  // ---- AI message ----
  aiBlock: {
    gap: theme.spacing.sm,
  },
  aiTextCard: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    borderTopLeftRadius: theme.radius.small,
    backgroundColor: theme.colors.surfaceNavy,
  },
  aiText: {
    ...theme.typography.medium,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.white,
  },

  // ---- Recommendation card ----
  recCard: {
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    overflow: 'hidden',
    ...theme.shadows.soft,
  },
  recImageWrap: {
    position: 'relative',
    aspectRatio: 16 / 9,
    backgroundColor: theme.colors.background,
  },
  recImage: {
    ...StyleSheet.absoluteFill,
  },
  recRatingBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(5, 10, 24, 0.7)',
  },
  recRatingText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 12,
    color: theme.colors.white,
  },
  recBody: {
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  recNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  recName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 17,
    color: theme.colors.white,
    flex: 1,
  },
  recDistance: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.mutedGray,
  },
  recLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recLocationText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.mutedGray,
  },
  recTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  recTagChip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.25)',
  },
  recTagText: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.secondarySilver,
  },
  recActionRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  viewDetailsButton: {
    flex: 1,
    height: 42,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewDetailsText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.primaryNavy,
  },
  directionsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    height: 42,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.25)',
  },
  directionsText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.white,
  },
  recSecondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xl,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(192, 192, 192, 0.12)',
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  secondaryActionText: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.secondarySilver,
  },

  // ---- Compact suggestion ----
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
  },
  compactThumb: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.background,
  },
  compactTextGroup: {
    flex: 1,
    gap: 2,
  },
  compactName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.white,
  },
  compactSubtitle: {
    ...theme.typography.medium,
    fontSize: 11,
    color: theme.colors.mutedGray,
  },

  // ---- No results ----
  noResultsCard: {
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    gap: theme.spacing.xs,
  },
  noResultsIconBox: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  noResultsTitle: {
    ...theme.typography.headingSmall,
    fontSize: 17,
    color: theme.colors.white,
  },
  noResultsText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.mutedGray,
    textAlign: 'center',
  },
  noResultsList: {
    alignSelf: 'stretch',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  noResultsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  noResultsDot: {
    width: 4,
    height: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.mutedGray,
  },
  noResultsRowText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.secondarySilver,
  },
  noResultsActionRow: {
    alignSelf: 'stretch',
    gap: theme.spacing.sm,
  },
  noResultsPrimaryButton: {
    height: 44,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsPrimaryText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.primaryNavy,
  },
  noResultsSecondaryButton: {
    height: 44,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsSecondaryText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },

  // ---- Input bar ----
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(192, 192, 192, 0.12)',
  },
  input: {
    flex: 1,
    height: 46,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceNavy,
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.white,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
