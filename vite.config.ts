/**
 * Web build for Lounge Locator.
 *
 * Apple rejected the app under guideline 1.4.3 — tobacco — on concept grounds
 * rather than implementation, so it cannot be fixed and resubmitted. Dr.
 * Brinkley's decision on 2026-09-17 was to reach people through the mobile web
 * instead. This config builds the SAME src/ that the phone app builds from, so
 * there is one codebase and not two.
 *
 * Two aliases do the work:
 *
 *   react-native -> react-native-web, which renders React Native's View, Text,
 *   Pressable and StyleSheet as ordinary DOM. The screens use only those
 *   primitives, which is why 81 screens port without being rewritten.
 *
 *   @react-native-firebase/* -> src/web/shims/*, which re-export the web
 *   Firebase SDK. Both libraries expose the same modular API, so the 24 files
 *   that talk to Firebase need no changes at all.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const shim = (name: string) => path.resolve(__dirname, `src/web/shims/${name}.ts`);
const shimx = (name: string) => path.resolve(__dirname, `src/web/shims/${name}.tsx`);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      '@react-native-firebase/app': shim('firebase-app'),
      '@react-native-firebase/auth': shim('firebase-auth'),
      '@react-native-firebase/firestore': shim('firebase-firestore'),
      '@react-native-firebase/storage': shim('firebase-storage'),
      '@react-native-firebase/functions': shim('firebase-functions'),
      '@react-native-firebase/messaging': shim('firebase-messaging'),

      // Both ship web support, but each also drags in a Flow-typed native
      // file that the web build cannot parse. The app uses four symbols
      // between them, so shimming is smaller than fighting resolution.
      'react-native-safe-area-context': shimx('safe-area-context'),
      'react-native-gesture-handler': shimx('gesture-handler'),
      // Flow-typed platform entry points, and the browser has had CSS
      // gradients for fifteen years.
      'react-native-linear-gradient': shimx('linear-gradient'),

      // The hardware features. Each has a browser equivalent — the file input,
      // the geolocation API, the Maps JavaScript API — but none of the native
      // libraries build for the web, so each is replaced rather than patched.
      'react-native-maps': shimx('maps'),
      'react-native-image-picker': shim('image-picker'),
      'react-native-document-scanner-plugin': shim('document-scanner'),
      '@react-native-community/geolocation': shim('geolocation'),
      '@react-native-voice/voice': shim('voice'),
    },
    // So a file can be given a web-only variant as Name.web.tsx, the way the
    // native build already resolves .ios/.android.
    // .web.* must come first so a library's own web variant wins over its
    // native one — react-native-screens ships TabsHost.web.js beside
    // TabsHost.ios.js, and without .web.js here the bundler finds neither.
    extensions: [
      '.web.tsx', '.web.ts', '.web.jsx', '.web.js',
      '.tsx', '.ts', '.jsx', '.js', '.json',
    ],
  },
  define: {
    // react-native-web expects these; they are compiled away in the bundle.
    global: 'globalThis',
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
  server: { port: 5175 },
  build: { outDir: 'web-build' },
});
