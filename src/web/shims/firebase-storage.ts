/**
 * `@react-native-firebase/storage` on the web.
 *
 * Everything re-exports cleanly except `putFile`, which is React Native
 * Firebase's own addition rather than part of the modular API. On a phone it
 * uploads straight from a file path on disk — exactly what the image picker
 * hands back — without reading the picture into memory.
 *
 * The browser has no file paths. What it has instead is a `blob:` or `data:`
 * URL from an <input type="file">, which fetch() can read back into a Blob,
 * and `uploadBytesResumable` takes it from there. The task it returns already
 * has the `.on('state_changed')` and thenable shape storageService.ts expects,
 * so the caller is unchanged.
 */
import './firebase-app';
import { uploadBytesResumable, type StorageReference, type UploadTask } from 'firebase/storage';

export * from 'firebase/storage';

/**
 * `uri` is whatever the platform's picker produced. On the web that is an
 * object URL or a data URL; fetch reads both.
 */
export function putFile(storageRef: StorageReference, uri: string): UploadTask {
  // uploadBytesResumable needs the bytes up front, but storageService.ts
  // expects a task back synchronously — so this returns a task-shaped object
  // that starts the real upload as soon as the blob has been read, and
  // forwards any progress listener registered in the meantime.
  type Snapshot = { bytesTransferred: number; totalBytes: number };
  let real: UploadTask | null = null;
  const pending: Array<(snapshot: Snapshot) => void> = [];

  const finished: Promise<void> = (async () => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const upload = uploadBytesResumable(storageRef, blob, {
      contentType: blob.type || 'image/jpeg',
    });
    real = upload;
    for (const listener of pending) {
      upload.on('state_changed', listener);
    }
    await upload;
  })();

  const task = {
    on(_event: string, listener: (snapshot: Snapshot) => void) {
      if (real) {
        real.on('state_changed', listener);
      } else {
        pending.push(listener);
      }
      return () => {};
    },
    then(onFulfilled?: (value: void) => unknown, onRejected?: (reason: unknown) => unknown) {
      return finished.then(onFulfilled, onRejected);
    },
    catch(onRejected?: (reason: unknown) => unknown) {
      return finished.catch(onRejected);
    },
    cancel() {
      return real ? real.cancel() : false;
    },
  };

  return task as unknown as UploadTask;
}
