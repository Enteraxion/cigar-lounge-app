/**
 * `react-native-document-scanner-plugin` on the web.
 *
 * On a phone this opens a real document scanner — it finds the edges of a
 * driving licence, corrects the perspective and crops it. The browser has
 * nothing equivalent, so this is a plain camera capture instead.
 *
 * That is a genuine loss and was called out in the web feasibility report: age
 * verification still works, because the automated check reads whatever
 * photograph it is given, but more submissions will be blurry or badly framed
 * and more will end up in front of a person. IdDocumentCapture already handles
 * that path — a referral is a normal outcome there, not an error.
 */
import { pickImages } from './file-picker';

export const ResponseType = { ImageFilePath: 'imageFilePath', Base64: 'base64' } as const;

export const ScanDocumentResponseStatus = { Success: 'success', Cancel: 'cancel' } as const;

async function scanDocument(_options?: {
  croppedImageQuality?: number;
  maxNumDocuments?: number;
  responseType?: string;
}): Promise<{ scannedImages?: string[]; status: string }> {
  const files = await pickImages({ multiple: false, capture: true });
  if (files.length === 0) {
    return { status: ScanDocumentResponseStatus.Cancel };
  }
  return {
    scannedImages: files.map(file => file.uri),
    status: ScanDocumentResponseStatus.Success,
  };
}

export default { scanDocument };
