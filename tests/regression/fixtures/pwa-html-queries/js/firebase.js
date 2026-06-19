import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const app = initializeApp({ projectId: 'demo-pwa' });
export const db = getFirestore(app);
