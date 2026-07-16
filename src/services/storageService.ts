/**
 * storageService
 *
 * Firebase Storage uploads for user-attached photos (review photos,
 * collection cover images), using @react-native-firebase/storage's
 * modular API — same convention as loungeService.ts/
 * userActionsService.ts. `putFile` (an RNFB extension beyond the
 * firebase-js-sdk modular API) uploads directly from a local file URI —
 * exactly what react-native-image-picker hands back — without reading
 * the file into memory first.
 */

import { getStorage, ref, putFile, getDownloadURL } from '@react-native-firebase/storage';

const storage = getStorage();

/**
 * Uploads a local image (e.g. from react-native-image-picker) to
 * `users/{userId}/{folder}/{timestamp}.jpg` and returns its public
 * download URL. `onProgress` (0-1) is optional and fires as the upload
 * streams.
 */
export async function uploadImage(
  userId: string,
  imageUri: string,
  folder: string,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const path = `users/${userId}/${folder}/${Date.now()}.jpg`;
  const storageRef = ref(storage, path);
  const task = putFile(storageRef, imageUri);

  if (onProgress) {
    task.on('state_changed', snapshot => {
      onProgress(snapshot.totalBytes > 0 ? snapshot.bytesTransferred / snapshot.totalBytes : 0);
    });
  }

  await task;
  return getDownloadURL(storageRef);
}
