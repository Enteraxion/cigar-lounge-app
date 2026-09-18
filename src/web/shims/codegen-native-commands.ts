/**
 * `react-native/Libraries/Utilities/codegenNativeCommands` on the web — the
 * companion to codegen-native-component.ts. Commands are imperative calls into
 * a native view; there is no native view here, so each is a no-op.
 */
export default function codegenNativeCommands<T extends object>(_spec: {
  supportedCommands: readonly string[];
}): T {
  return new Proxy({} as T, { get: () => () => {} });
}
