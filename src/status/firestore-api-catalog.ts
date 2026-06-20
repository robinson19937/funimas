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
    'Funimas puede convertir funciones con múltiples escrituras en Funimas.domain.execute() si las escrituras son detectables estáticamente.',
  writeBatch:
    'Funimas puede convertir funciones con writeBatch y múltiples escrituras en Funimas.domain.execute().',
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
