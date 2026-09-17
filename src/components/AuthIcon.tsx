/**
 * The handful of icons the three auth screens use.
 *
 * Those screens were the only place in the app still using
 * react-native-vector-icons — the other 56 icon imports are all
 * lucide-react-native. That split did no harm on the phone, but
 * react-native-vector-icons ships untranspiled JSX inside .js files, which the
 * web build cannot parse, and it was the first thing to stop the browser build
 * (2026-09-17).
 *
 * Rather than configure the bundler around one library used six times, this
 * maps those six names onto the icon set the rest of the app already uses. The
 * screens keep their `<Icon name="..." />` shape, so the change is an import
 * swap rather than a rewrite of three of the highest-risk screens in the app.
 */

import React from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
} from 'lucide-react-native';

const ICONS = {
  'arrow-back': ArrowLeft,
  checkmark: Check,
  'checkmark-circle-outline': CheckCircle2,
  'lock-closed-outline': Lock,
  'mail-outline': Mail,
  'person-outline': User,
  'eye-outline': Eye,
  'eye-off-outline': EyeOff,
} as const;

export type AuthIconName = keyof typeof ICONS;

export default function Icon({
  name,
  size,
  color,
}: {
  name: AuthIconName;
  size?: number;
  color?: string;
}) {
  const Glyph = ICONS[name];
  if (!Glyph) {
    return null;
  }
  return <Glyph size={size} color={color} />;
}
