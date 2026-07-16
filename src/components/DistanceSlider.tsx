/**
 * DistanceSlider
 *
 * Drag-to-set slider used for mile/distance values (Filter Bottom Sheet's
 * Location distance, AI Settings' Max Travel Distance). Built with
 * PanResponder — no bottom-sheet/slider library in this project.
 * Promoted here from FilterBottomSheet on its second use.
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
  const percent = (value - min) / (max - min);

  const updateFromX = (x: number) => {
    if (!trackWidth) {
      return;
    }
    const clamped = Math.min(Math.max(x, 0), trackWidth);
    const ratio = clamped / trackWidth;
    onChange(Math.round(min + ratio * (max - min)));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => updateFromX(evt.nativeEvent.locationX),
      onPanResponderMove: evt => updateFromX(evt.nativeEvent.locationX),
    }),
  ).current;

  return (
    <View
      style={styles.touchArea}
      hitSlop={{ top: 12, bottom: 12 }}
      onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
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
