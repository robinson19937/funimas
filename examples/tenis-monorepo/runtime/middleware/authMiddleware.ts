import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import type { AuthenticatedRequest } from '../models/Request.js';

let app: App | undefined;
let auth: Auth | undefined;

function getFirebaseApp(): App {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
    return app;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    app = initializeApp({ projectId });
    return app;
  }

  throw new Error(
    'Configuración de Firebase Admin incompleta. Define FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY.',
  );
}

function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

export async function verifyAuthToken(
  headers: Record<string, string>,
): Promise<{ uid: string } | { error: string; status: number }> {
  const authorization = headers.authorization ?? headers.Authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return { error: 'Token de autenticación requerido.', status: 401 };
  }

  const token = authorization.slice('Bearer '.length).trim();

  if (!token) {
    return { error: 'Token de autenticación inválido.', status: 401 };
  }

  try {
    const decoded = await getFirebaseAuth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return { error: 'Token de autenticación expirado o inválido.', status: 401 };
  }
}

export async function authenticateRequest(
  request: Omit<AuthenticatedRequest, 'uid'>,
): Promise<AuthenticatedRequest | { error: string; status: number }> {
  const authResult = await verifyAuthToken(request.headers);

  if ('error' in authResult) {
    return authResult;
  }

  return { ...request, uid: authResult.uid };
}
