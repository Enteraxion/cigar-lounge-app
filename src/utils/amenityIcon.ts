/**
 * getAmenityIcon
 *
 * Firestore's `amenities`/`tags` fields are free-text strings (see
 * src/types/firestore.ts), not the closed AmenityKey enum the old mock
 * data used — so amenity chips/grids across Search Results and Lounge
 * Detail now pick an icon by keyword match instead of a lookup table,
 * falling back to a generic dot for anything unrecognized.
 */

import {
  Bell,
  Cigarette,
  Circle,
  CircleParking,
  Coffee,
  Lock,
  Martini,
  Tv,
  Umbrella,
  Utensils,
  Wifi,
  type LucideIcon,
} from 'lucide-react-native';

const KEYWORD_ICONS: Array<[string, LucideIcon]> = [
  ['wifi', Wifi],
  ['coffee', Coffee],
  ['terrace', Umbrella],
  ['outdoor', Umbrella],
  ['bar', Martini],
  ['whisk', Martini],
  ['martini', Martini],
  ['lock', Lock],
  ['park', CircleParking],
  ['tv', Tv],
  ['food', Utensils],
  ['drink', Utensils],
  ['utensil', Utensils],
  ['bell', Bell],
  ['concierge', Bell],
  ['humidor', Cigarette],
  ['cigar', Cigarette],
];

export function getAmenityIcon(label: string): LucideIcon {
  const needle = label.toLowerCase();
  for (const [keyword, icon] of KEYWORD_ICONS) {
    if (needle.includes(keyword)) {
      return icon;
    }
  }
  return Circle;
}
