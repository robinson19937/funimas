export function renderNetlifyTypes(): string {
  return `declare module '@netlify/functions' {
  export interface HandlerEvent {
    body: string | null;
    headers: Record<string, string | undefined>;
    httpMethod: string;
    path: string;
    rawUrl?: string;
  }

  export interface HandlerContext {
    functionName: string;
  }

  export interface HandlerResponse {
    statusCode: number;
    body?: string;
    headers?: Record<string, string>;
  }

  export type Handler = (
    event: HandlerEvent,
    context: HandlerContext,
  ) => Promise<HandlerResponse> | HandlerResponse;
}
`;
}

export function renderFirebaseAdminTypes(): string {
  return `declare const process: {
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
  export interface DocumentReference {
    id: string;
    get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
    set(data: unknown): Promise<void>;
    delete(): Promise<void>;
    update(data: unknown): Promise<void>;
  }
  export interface Transaction {
    get(ref: DocumentReference): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
    set(ref: DocumentReference, data: unknown): void;
  }
  export interface CollectionReference {
    doc(id?: string): DocumentReference;
  }
  export function getFirestore(): Firestore;
  export interface Firestore {
    collection(name: string): CollectionReference;
    runTransaction<T>(fn: (transaction: Transaction) => Promise<T>): Promise<T>;
  }
  export const FieldValue: {
    serverTimestamp(): unknown;
  };
}
`;
}
