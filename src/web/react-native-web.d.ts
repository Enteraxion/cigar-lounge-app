/**
 * react-native-web ships no type declarations of its own.
 *
 * Pointing them at `react-native`'s is not a convenience — it is the check
 * that matters. The whole web build rests on the claim that react-native-web
 * implements React Native's API, so typing it as anything looser (or as `any`)
 * would remove the one place that claim is verified.
 */
declare module 'react-native-web' {
  export * from 'react-native';
}
