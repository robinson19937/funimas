import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { storage } from '../firebase.js';

export async function manageFiles(): Promise<void> {
  const fileRef = ref(storage, 'avatars/user.png');

  await uploadBytes(fileRef, new Uint8Array());
  await getDownloadURL(fileRef);
  await deleteObject(fileRef);
}
