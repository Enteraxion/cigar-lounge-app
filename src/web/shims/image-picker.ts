/**
 * `react-native-image-picker` on the web. See file-picker.ts.
 *
 * The two callers pass `{ mediaType, selectionLimit }` and read
 * `response.assets` / `response.didCancel` in a callback, so that is the shape
 * returned here — the screens are unchanged.
 */
import { pickImages, type PickedFile } from './file-picker';

type Response = { didCancel?: boolean; errorMessage?: string; assets?: PickedFile[] };

export function launchImageLibrary(
  options: { selectionLimit?: number },
  callback: (response: Response) => void,
): void {
  pickImages({ multiple: (options.selectionLimit ?? 1) !== 1 }).then(assets => {
    callback(assets.length === 0 ? { didCancel: true } : { assets });
  });
}

export function launchCamera(
  options: { selectionLimit?: number },
  callback: (response: Response) => void,
): void {
  pickImages({ multiple: false, capture: true }).then(assets => {
    callback(assets.length === 0 ? { didCancel: true } : { assets });
  });
}
