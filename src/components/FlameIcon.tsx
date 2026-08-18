/**
 * FlameIcon
 *
 * Exact vector path exported from the original Figma logo mark (the app was
 * called "The Reserve" then; it is now Lounge Locator — see
 * design-reference/logo/ for the current mark)
 * (viewBox 21x24), rendered natively via react-native-svg instead of
 * an approximated icon-font glyph.
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { theme } from '../theme';

type Props = {
  size?: number;
  color?: string;
};

const ASPECT_RATIO = 21 / 24;

export default function FlameIcon({ size = 24, color = theme.colors.secondarySilver }: Props) {
  return (
    <Svg width={size * ASPECT_RATIO} height={size} viewBox="0 0 21 24" fill="none">
      <Path
        d="M15.1406 2.4375C18.5625 5.57812 21 10.7344 21 13.2188C21 19.1719 16.2656 24 10.5 24C4.68748 24 -2.47955e-05 19.1719 -2.47955e-05 13.2188C-2.47955e-05 9.84375 3.23435 4.3125 7.87498 0C9.65623 1.6875 11.25 3.46875 12.5156 5.25C13.2656 4.26562 14.1562 3.32812 15.1406 2.4375ZM14.25 18.375C16.5469 16.7812 17.0625 13.6406 15.7969 11.2031C15.6562 10.9219 15.4687 10.5938 15.2812 10.2656L12.5156 13.4062C12.5156 13.4062 8.2031 7.875 7.87498 7.5C5.62498 10.2656 4.49998 11.8594 4.49998 13.6406C4.49998 17.2969 7.21873 19.5 10.5937 19.5C11.9531 19.5 13.2187 19.125 14.25 18.375Z"
        fill={color}
      />
    </Svg>
  );
}
