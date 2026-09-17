/**
 * Picking a photograph, in a browser.
 *
 * Shared by the two native libraries that have no web equivalent:
 * react-native-image-picker (profile photos, review photos) and
 * react-native-document-scanner-plugin (identity documents).
 *
 * Both are replaced by the browser's own file input. On a phone that input
 * opens the camera or the photo library exactly as a member expects; `capture`
 * asks the browser to prefer the camera, which is what an ID photograph wants.
 *
 * The URLs handed back are object URLs, which is what the upload path already
 * copes with — see the putFile shim in firebase-storage.ts.
 */

export type PickedFile = { uri: string; fileName: string; type: string; fileSize: number };

export function pickImages(options: {
  multiple?: boolean;
  /** Ask the browser for the camera rather than the library. */
  capture?: boolean;
}): Promise<PickedFile[]> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = options.multiple ?? false;
    if (options.capture) {
      input.setAttribute('capture', 'environment');
    }
    // Safari will not open the picker for a detached input.
    input.style.cssText = 'position:fixed;left:-9999px;';
    document.body.appendChild(input);

    let settled = false;
    const finish = (files: PickedFile[]) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(files);
    };

    input.addEventListener('change', () => {
      const files = Array.from(input.files ?? []).map(file => ({
        uri: URL.createObjectURL(file),
        fileName: file.name,
        type: file.type,
        fileSize: file.size,
      }));
      finish(files);
    });

    // There is no reliable "cancelled" event across browsers. Focus returning
    // to the window without a change event means the member backed out, and
    // resolving empty is what both callers already treat as a cancellation.
    window.addEventListener(
      'focus',
      () => setTimeout(() => finish([]), 500),
      { once: true },
    );

    input.click();
  });
}
