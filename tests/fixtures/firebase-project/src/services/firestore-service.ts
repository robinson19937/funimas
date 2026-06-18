import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { db } from '../firebase.js';

export async function manageUsers(): Promise<void> {
  const users = collection(db, 'users');
  const userRef = doc(db, 'users', '1');

  await addDoc(users, { name: 'Alice' });
  await setDoc(userRef, { name: 'Bob' });
  await updateDoc(userRef, { active: true });
  await deleteDoc(userRef);
  await getDoc(userRef);
  await getDocs(users);
}
