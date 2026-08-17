/**
 * Native-module stubs for the unit suite.
 *
 * The pure logic under test imports type-only from the service layer, so
 * almost nothing here is load-bearing — these exist so that a util which
 * transitively touches a native module doesn't take the whole suite down.
 */
jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn() }), { virtual: true });
jest.mock('@react-native-firebase/auth', () => ({ getAuth: () => ({ currentUser: null }) }), {
  virtual: true,
});
jest.mock('@react-native-firebase/firestore', () => ({ getFirestore: jest.fn() }), {
  virtual: true,
});
jest.mock('@react-native-firebase/functions', () => ({ getFunctions: jest.fn() }), {
  virtual: true,
});
jest.mock('@react-native-community/geolocation', () => ({
  setRNConfiguration: jest.fn(),
  requestAuthorization: jest.fn(),
  getCurrentPosition: jest.fn(),
}), { virtual: true });
