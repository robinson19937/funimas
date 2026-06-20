import {
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { auth, db } from './firebase.js';

const loginBtn = document.getElementById('loginBtn');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const confirmPasswordInput = document.getElementById('confirmPasswordInput');
const companyNameInput = document.getElementById('companyNameInput');

let authMode = 'register';

function normalizeCompanyId(companyName, uid) {
  return `${companyName || 'empresa'}-${uid}`.toLowerCase().replace(/\s+/g, '-');
}

if (loginBtn) {
  loginBtn.addEventListener('click', async () => {
    const email = emailInput?.value.trim();
    const password = passwordInput?.value.trim();
    const confirmPassword = confirmPasswordInput?.value.trim();
    const companyName = companyNameInput?.value.trim();

    if (!email || !password || !confirmPassword) {
      return;
    }

    if (password !== confirmPassword) {
      return;
    }

    const uid = auth.currentUser?.uid || 'demo-uid';
    const companyId = normalizeCompanyId(companyName, uid);
    const businessName = companyName || 'Mi empresa';
    const timestamp = serverTimestamp();

    await setDoc(doc(db, 'users', uid), {
      companyId,
      email,
      createdAt: timestamp,
    });

    await setDoc(
      doc(db, 'companies', companyId),
      {
        name: businessName,
        ownerUid: uid,
        createdAt: timestamp,
      },
      { merge: true },
    );

    await setDoc(
      doc(db, 'companies', companyId, 'settings', 'main'),
      {
        businessName,
        companyId,
        email,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      { merge: true },
    );
  });
}
