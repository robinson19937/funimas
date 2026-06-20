import { db, doc, getDoc, serverTimestamp, setDoc } from './firebase.js';
import { resolveCompanyId } from './companySettings.js';

const COMPANY_KEY = 'app:company-id';

async function bootstrapMissingCompanyData({ uid, email }) {
  const timestamp = serverTimestamp();
  const companyId = resolveCompanyId();

  const userRef = doc(db, 'users', uid);
  const companyRef = doc(db, 'companies', companyId);
  const settingsRef = doc(db, 'companies', companyId, 'settings', 'main');

  const [userSnap, companySnap] = await Promise.all([getDoc(userRef), getDoc(companyRef)]);

  if (!userSnap.exists()) {
    if (companySnap.exists()) {
      throw new Error('La empresa ya existe y no se puede recrear el perfil automáticamente.');
    }

    const safeEmail = (email || '').trim();
    if (!safeEmail) {
      throw new Error('No se pudo recuperar el correo del usuario.');
    }

    await setDoc(userRef, {
      email: safeEmail,
      companyId,
      createdAt: timestamp,
    });
  }

  if (!companySnap.exists()) {
    await setDoc(
      companyRef,
      {
        name: 'Mi empresa',
        ownerUid: uid,
        createdAt: timestamp,
      },
      { merge: true },
    );

    await setDoc(
      settingsRef,
      {
        businessName: 'Mi empresa',
        companyId,
        email: email || 'contacto@suempresa.com',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      { merge: true },
    );
  }

  try {
    localStorage.setItem(COMPANY_KEY, companyId);
  } catch (error) {
    console.warn('No se pudo guardar el companyId en localStorage', error);
  }

  return companyId;
}

export { bootstrapMissingCompanyData };
