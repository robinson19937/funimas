export const SUPPORTED_FIRESTORE_CALLEES = [
  'addDoc',
  'setDoc',
  'updateDoc',
  'deleteDoc',
  'getDoc',
  'getDocs',
  'onSnapshot',
] as const;

export const UNSUPPORTED_FIRESTORE_CALLEES = [
  'runTransaction',
  'writeBatch',
] as const;

const UNSUPPORTED_RECOMMENDATIONS: Record<string, string> = {
  runTransaction:
    'Migrar a mutaciones del SDK Funimas o lógica de dominio en el servidor (Admin SDK).',
  writeBatch:
    'Reemplazar por llamadas individuales al SDK Funimas o una mutación de dominio en el servidor.',
};

export function isSupportedFirestoreCallee(callee: string): boolean {
  return (SUPPORTED_FIRESTORE_CALLEES as readonly string[]).includes(callee);
}

export function getUnsupportedFirestoreRecommendation(callee: string): string {
  return (
    UNSUPPORTED_RECOMMENDATIONS[callee] ??
    'Migrar manualmente a operaciones del SDK Funimas o lógica de dominio en el servidor.'
  );
}
