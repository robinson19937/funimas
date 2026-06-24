declare const process: {
  env: Record<string, string | undefined>;
};

declare module 'firebase-admin/app' {
  export interface App {}
  export function initializeApp(options?: unknown): App;
  export function getApps(): App[];
  export function cert(options: unknown): unknown;
}

declare module 'firebase-admin/auth' {
  export interface Auth {}
  export interface DecodedIdToken {
    uid: string;
  }
  export function getAuth(app?: unknown): Auth;
  export interface Auth {
    verifyIdToken(token: string): Promise<DecodedIdToken>;
  }
}

declare module 'firebase-admin/firestore' {
  export interface Firestore {}
  export interface DocumentSnapshot {
    id: string;
    exists: boolean;
    data(): Record<string, unknown> | undefined;
  }
  export interface QuerySnapshot {
    docs: DocumentSnapshot[];
  }
  export interface DocumentReference {
    id: string;
    get(): Promise<DocumentSnapshot>;
    set(data: unknown, options?: { merge?: boolean }): Promise<void>;
    delete(): Promise<void>;
    update(data: unknown): Promise<void>;
  }
  export interface Transaction {
    get(ref: DocumentReference): Promise<DocumentSnapshot>;
    set(ref: DocumentReference, data: unknown): void;
  }
  export interface Query {
    where(field: string, op: string, value: unknown): Query;
    get(): Promise<QuerySnapshot>;
  }
  export interface CollectionReference {
    doc(id?: string): DocumentReference;
    get(): Promise<QuerySnapshot>;
    where(field: string, op: string, value: unknown): Query;
  }
  export function getFirestore(): Firestore;
  export interface Firestore {
    collection(name: string): CollectionReference;
    doc(path: string): DocumentReference;
    runTransaction<T>(fn: (transaction: Transaction) => Promise<T>): Promise<T>;
  }
  export const FieldValue: {
    serverTimestamp(): unknown;
  };
}
