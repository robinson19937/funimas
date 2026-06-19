import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const app = initializeApp({ projectId: 'demo-tx' });
export const db = getFirestore(app);
