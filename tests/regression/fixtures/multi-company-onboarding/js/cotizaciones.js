import { collection, getDocs, query, where } from 'firebase/firestore';

import { db } from './firebase.js';

export async function listCotizacionesByCompany(companyId) {
  const q = query(collection(db, 'cotizaciones'), where('companyId', '==', companyId));
  return getDocs(q);
}

export async function listRecibosByUser(userId) {
  const q = query(collection(db, 'recibos'), where('userId', '==', userId));
  return getDocs(q);
}
