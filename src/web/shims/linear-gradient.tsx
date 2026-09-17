/**
 * `react-native-linear-gradient` on the web.
 *
 * The package's platform entry points are Flow-typed and stop the web build,
 * and there is no reason to ship a JavaScript gradient to a browser that has
 * had CSS gradients for fifteen years. This renders the real thing.
 *
 * The app uses gradients for scrims — fading a dark background up over a
 * photograph so white text stays readable — and for the gold glow behind the
 * logo. Six files, all with the same shape: `colors`, and sometimes `start`
 * and `end` as {x, y} in 0–1 space.
 *
 * React Native measures its gradient direction as two points; CSS measures it
 * as an angle. The conversion is below, so a gradient that ran top-to-bottom
 * on the phone runs top-to-bottom in the browser rather than at some
 * plausible-looking but wrong diagonal.
 */

import React from 'react';
import { View, type ViewProps } from 'react-native';

type Point = { x: number; y: number };

function angleFor(start: Point, end: Point): number {
  // CSS angles are clockwise from "to top"; atan2 here gives the direction of
  // travel from start to end in the same frame RN uses (y grows downwards).
  const degrees = (Math.atan2(end.x - start.x, start.y - end.y) * 180) / Math.PI;
  return Math.round((degrees + 360) % 360);
}

export default function LinearGradient({
  colors,
  start = { x: 0.5, y: 0 },
  end = { x: 0.5, y: 1 },
  locations,
  style,
  children,
  ...rest
}: ViewProps & {
  colors: readonly string[];
  start?: Point;
  end?: Point;
  locations?: readonly number[];
}) {
  const stops = colors.map((colour, i) =>
    locations?.[i] === undefined ? colour : `${colour} ${locations[i] * 100}%`,
  );
  const backgroundImage = `linear-gradient(${angleFor(start, end)}deg, ${stops.join(', ')})`;

  // `backgroundImage` is not part of React Native's style API, so it is passed
  // through here rather than in the shared stylesheet — react-native-web hands
  // unknown style keys to the DOM, which is exactly what we want.
  return (
    <View style={[style, { backgroundImage } as object]} {...rest}>
      {children}
    </View>
  );
}

export { LinearGradient };
