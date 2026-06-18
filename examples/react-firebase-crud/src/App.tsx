import { addDoc, collection } from 'firebase/firestore';

import { db } from './firebase.js';

export async function createDemoUsers(): Promise<void> {
  await addDoc(collection(db, 'users'), { name: 'Ana' });
  await addDoc(collection(db, 'users'), { name: 'Luis' });
}

export function App(): null {
  return null;
}
