import { doc, runTransaction } from 'firebase/firestore';

import { db } from './firebase.js';

export async function transferCredits(fromId, toId, amount) {
  const fromRef = doc(db, 'accounts', fromId);
  const toRef = doc(db, 'accounts', toId);

  await runTransaction(db, async (transaction) => {
    const fromSnap = await transaction.get(fromRef);
    const toSnap = await transaction.get(toRef);

    transaction.update(fromRef, { balance: fromSnap.data().balance - amount });
    transaction.update(toRef, { balance: toSnap.data().balance + amount });
  });
}
