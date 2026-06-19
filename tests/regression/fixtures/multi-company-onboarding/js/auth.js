import {
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { auth, db } from './firebase.js';

export async function registerCompany({ companyId, companyName, ownerUid }) {
  const companyRef = doc(db, 'companies', companyId);
  const settingsRef = doc(db, 'companies', companyId, 'settings', 'main');

  await setDoc(companyRef, {
    id: companyId,
    name: companyName,
    ownerUid,
    createdAt: serverTimestamp(),
  });

  await setDoc(
    settingsRef,
    {
      onboardingCompleted: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await setDoc(doc(db, 'users', ownerUid), {
    companyId,
    role: 'owner',
    updatedAt: serverTimestamp(),
  });
}

export async function getCurrentCompanyId() {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }

  return user.uid;
}
