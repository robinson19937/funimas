import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

import { auth } from '../firebase.js';

export async function manageAuth(): Promise<void> {
  await signInWithEmailAndPassword(auth, 'a@b.com', 'secret');
  await createUserWithEmailAndPassword(auth, 'c@d.com', 'secret');
  await sendPasswordResetEmail(auth, 'a@b.com');
  await signOut(auth);
}
