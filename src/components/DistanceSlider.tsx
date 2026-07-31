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
 */

import React, { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { theme } from '../theme';

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

  const measureTrack = () => {
    containerRef.current?.measureInWindow((x, _y, width) => {
      trackScreenX.current = x;
      setTrackWidth(width);
    });
  };

  const updateFromPageX = (pageX: number) => {
    if (!trackWidth) {
      return;
    }
    const clamped = Math.min(Math.max(pageX - trackScreenX.current, 0), trackWidth);
    const ratio = clamped / trackWidth;
    onChange(Math.round(min + ratio * (max - min)));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => updateFromPageX(evt.nativeEvent.pageX),
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
    backgroundColor: 'rgba(192, 192, 192, 0.2)',
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    backgroundColor: theme.colors.secondarySilver,
  },
  thumb: {
    position: 'absolute',
    top: (24 - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: theme.colors.secondarySilver,
    ...theme.shadows.soft,
  },
});
