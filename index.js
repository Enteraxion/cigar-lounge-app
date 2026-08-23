/**
 * @format
 */

import 'react-native-gesture-handler';
// Before App, deliberately: the emulator connections have to be made before any
// service module calls getFirestore() and issues its first read. No-op unless
// src/config/devEmulators.ts has ENABLED set to true.
import './src/config/devEmulators';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
