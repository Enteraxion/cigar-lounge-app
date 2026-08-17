/**
 * DistanceSlider
 *
 * Drag-to-set slider used for mile/distance values (Filter Bottom Sheet's
 * Location distance, AI Settings' Max Travel Distance). Built with
 * PanResponder — no bottom-sheet/slider library in this project.
 * Promoted here from FilterBottomSheet on its second use.
 *
 * Uses `pageX` (absolute screen coordinate) minus the track's own
 * measured screen position, rather than `locationX` — with the New
 * Architecture enabled (see ios/.../Info.plist RCTNewArchEnabled),
 * `locationX` is reported relative to whichever nested child view is
 * directly under the finger (the thumb overlay, the track, etc.), not
 * consistently relative to this outer PanResponder view, which is what
 * made the slider appear stuck: touches on the thumb itself never
 * reached the expected coordinate space. Absolute screen coordinates
 * sidestep that entirely.
 *
 * Both places this is used sit inside a vertical ScrollView, and that is
 * the second reason it could feel stuck: a horizontal drag starting on
 * the thumb was being claimed by the scroll view, so the value never
 * moved. The four capture/termination handlers below are what keep the
 * gesture here — `onStartShouldSetPanResponderCapture` claims the touch
 * before the scroll view sees it, `onPanResponderTerminationRequest`
 * refuses to hand it back mid-drag, and `onShouldBlockNativeResponder`
 * stops the native scroller taking over on iOS.
 *
 * The track is also re-measured on every touch rather than only on
 * layout: it lives in a Modal that slides in and in a list that scrolls,
 * so a position captured once at layout time can be stale by the time a
 * finger arrives — which would map the touch to the wrong value.
 */

import React, { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { theme, withAlpha } from '../theme';

const THUMB_SIZE = 20;

type Props = {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
};

export default function DistanceSlider({ value, min = 1, max = 100, onChange }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackScreenX = useRef(0);
  const containerRef = useRef<View>(null);
  const percent = (value - min) / (max - min);

  // Kept in refs as well as state: the PanResponder below is created once
  // (useRef) and would otherwise close over the first render's values, so
  // reading state directly there would leave it permanently measuring
  // against a width of 0 — the early return would swallow every drag.
  const trackWidthRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const rangeRef = useRef({ min, max });
  rangeRef.current = { min, max };

  const measureTrack = () => {
    containerRef.current?.measureInWindow((x, _y, width) => {
      trackScreenX.current = x;
      trackWidthRef.current = width;
      setTrackWidth(width);
    });
  };

  const updateFromPageX = (pageX: number) => {
    const width = trackWidthRef.current;
    if (!width) {
      return;
    }
    const clamped = Math.min(Math.max(pageX - trackScreenX.current, 0), width);
    const ratio = clamped / width;
    const range = rangeRef.current;
    onChangeRef.current(Math.round(range.min + ratio * (range.max - range.min)));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      // Never surrender the gesture to the surrounding ScrollView once the
      // drag has started, and stop the native scroller competing for it.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: evt => {
        measureTrack();
        updateFromPageX(evt.nativeEvent.pageX);
      },
      onPanResponderMove: evt => updateFromPageX(evt.nativeEvent.pageX),
    }),
  ).current;

  return (
    <View
      ref={containerRef}
      style={styles.touchArea}
      hitSlop={{ top: 12, bottom: 12 }}
      onLayout={measureTrack}
      {...panResponder.panHandlers}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent * 100}%` }]} />
      </View>
      <View style={[styles.thumb, { left: Math.max(0, percent * trackWidth - THUMB_SIZE / 2) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  touchArea: {
    justifyContent: 'center',
    height: 24,
  },
  track: {
    height: 4,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.2),
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    backgroundColor: theme.colors.accentGold,
  },
  thumb: {
    position: 'absolute',
    top: (24 - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: theme.colors.accentGold,
    ...theme.shadows.soft,
  },
});
