declare module 'firebase/app' {
  export function initializeApp(config: Record<string, string>): unknown;
}

declare module 'firebase/firestore' {
  export function getFirestore(app: unknown): unknown;
  export function collection(db: unknown, path: string): unknown;
  export function addDoc(reference: unknown, data: unknown): Promise<unknown>;
}
