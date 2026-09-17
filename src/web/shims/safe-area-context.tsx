/**
 * `react-native-safe-area-context` on the web.
 *
 * The library does ship web support, but its native TurboModule spec is
 * Flow-typed and the bundler pulls it in regardless, which stops the build. The
 * app uses exactly three things from it, so a shim is smaller and more
 * predictable than fighting module resolution (2026-09-17).
 *
 * The insets are real, not zeros. iOS Safari exposes the notch and home-bar
 * cutouts through the CSS env() variables, and reading them here keeps the
 * screens' existing `edges={['top']}` behaviour honest on an iPhone — which is
 * the device most of these members will be holding.
 */

import React, { useEffect, useState } from 'react';
import { View, type ViewProps } from 'react-native';

export type EdgeInsets = { top: number; right: number; bottom: number; left: number };

const ZERO: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * env() is only readable from CSS, so this asks the browser to compute it on a
 * throwaway element. Returns zeros anywhere the variables are unsupported,
 * which is every desktop browser and is correct there.
 */
function readInsets(): EdgeInsets {
  if (typeof document === 'undefined') {
    return ZERO;
  }
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;' +
    'top:env(safe-area-inset-top);right:env(safe-area-inset-right);' +
    'bottom:env(safe-area-inset-bottom);left:env(safe-area-inset-left);';
  document.body.appendChild(probe);
  const s = getComputedStyle(probe);
  const px = (v: string) => (v.endsWith('px') ? parseFloat(v) : 0) || 0;
  const insets = { top: px(s.top), right: px(s.right), bottom: px(s.bottom), left: px(s.left) };
  probe.remove();
  return insets;
}

export function useSafeAreaInsets(): EdgeInsets {
  const [insets, setInsets] = useState<EdgeInsets>(readInsets);

  // Rotating the phone changes which edges are cut out.
  useEffect(() => {
    const update = () => setInsets(readInsets());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return insets;
}

export function SafeAreaProvider({ children }: { children?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaInsetsContext.Provider value={insets}>{children}</SafeAreaInsetsContext.Provider>
  );
}

type Edge = 'top' | 'right' | 'bottom' | 'left';

export function SafeAreaView({
  children,
  style,
  edges = ['top', 'right', 'bottom', 'left'],
  ...rest
}: ViewProps & { edges?: readonly Edge[] }) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
  };
  return (
    <View style={[padding, style]} {...rest}>
      {children}
    </View>
  );
}

/**
 * React Navigation reads the insets through this context rather than the hook,
 * so it has to exist and carry real values — without it the bottom tab bar
 * sits under the iPhone home bar.
 */
export const SafeAreaInsetsContext = React.createContext<EdgeInsets | null>(null);

export const SafeAreaFrameContext = React.createContext<{
  x: number;
  y: number;
  width: number;
  height: number;
} | null>(null);

export const initialWindowMetrics = null;

export function useSafeAreaFrame() {
  return {
    x: 0,
    y: 0,
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
  };
}
