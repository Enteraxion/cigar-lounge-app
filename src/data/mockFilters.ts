/**
 * Mock data for FilterBottomSheet — matches
 * design-reference/Filter Bottom Sheet & Categories.pdf.
 */

export type FilterOption = {
  id: string;
  label: string;
};

export const availabilityOptions: FilterOption[] = [
  { id: 'open-now', label: 'Open Now' },
  { id: 'open-late', label: 'Open Late' },
  { id: 'open-24h', label: 'Open 24 Hours' },
];

export const atmosphereOptions: FilterOption[] = [
  { id: 'quiet', label: 'Quiet' },
  { id: 'social', label: 'Social' },
  { id: 'luxury', label: 'Luxury' },
  { id: 'casual', label: 'Casual' },
  { id: 'business-friendly', label: 'Business Friendly' },
  { id: 'beginner-friendly', label: 'Beginner Friendly' },
];

export const amenitiesOptions: FilterOption[] = [
  { id: 'wifi', label: 'Wi-Fi' },
  { id: 'power-outlets', label: 'Power Outlets' },
  { id: 'outdoor-patio', label: 'Outdoor Patio' },
  { id: 'private-lounge', label: 'Private Lounge' },
  { id: 'locker-storage', label: 'Locker Storage' },
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'full-bar', label: 'Full Bar' },
  { id: 'coffee', label: 'Coffee' },
  { id: 'valet-parking', label: 'Valet Parking' },
];

export const entertainmentOptions: FilterOption[] = [
  { id: 'live-music', label: 'Live Music' },
  { id: 'poker-night', label: 'Poker Night' },
  { id: 'sports-viewing', label: 'Sports Viewing' },
  { id: 'whiskey-tastings', label: 'Whiskey Tastings' },
  { id: 'cigar-events', label: 'Cigar Events' },
];

export const defaultDistanceMiles = 25;
export const baseResultCount = 42;
export const defaultSelectedAvailability = ['open-now'];
