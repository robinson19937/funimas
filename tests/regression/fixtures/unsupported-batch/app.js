import { doc, writeBatch } from 'firebase/firestore';

import { db } from './firebase.js';

export async function syncUserProfile(userId, profile) {
  const batch = writeBatch(db);
  const userRef = doc(db, 'users', userId);
  const profileRef = doc(db, 'profiles', userId);

  batch.set(userRef, profile);
  batch.set(profileRef, { displayName: profile.name, updatedAt: Date.now() });
  await batch.commit();
}
