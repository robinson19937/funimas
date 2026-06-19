import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const app = initializeApp({ projectId: 'demo-multi-company' });
export const auth = getAuth(app);
export const db = getFirestore(app);
