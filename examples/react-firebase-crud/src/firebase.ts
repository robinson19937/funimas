import { initializeApp } from 'firebase/app';
import { addDoc, collection, getFirestore } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'demo',
  projectId: 'react-firebase-crud',
});

export const db = getFirestore(app);

export async function seedFirebase(): Promise<void> {
  await addDoc(collection(db, 'bootstrap'), { ready: true });
}
