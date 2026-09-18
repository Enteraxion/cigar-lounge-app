/**
 * `react-native/Libraries/Utilities/codegenNativeComponent` on the web.
 *
 * Native libraries use this to declare a TurboModule component that the New
 * Architecture generates bindings for. It does not exist in react-native-web,
 * and while the production build tree-shakes those declarations away, Vite's
 * dev-mode pre-bundling resolves every import eagerly and stops on it.
 *
 * Nothing on the web should ever render one of these — the libraries that
 * declare them are aliased to web shims — so this returns a component that
 * renders nothing rather than throwing. If one ever DOES appear on screen, an
 * empty box is a better failure than a white page.
 */
import React from 'react';

export default function codegenNativeComponent<Props>(_name: string) {
  return function NativeComponentUnavailableOnWeb(_props: Props) {
    return React.createElement(React.Fragment, null);
  };
}
