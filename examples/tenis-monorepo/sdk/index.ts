import { DatabaseClient } from './database/DatabaseClient.js';

export type {
  DatabaseClientOptions,
  DocumentReferenceLike,
  DocumentSnapshotLike,
  GetIdToken,
  QueryDocumentSnapshotLike,
  QuerySnapshotLike,
} from './database/DatabaseClient.js';
export { DatabaseClient, ApiError } from './database/DatabaseClient.js';

export type AuthHelpers = {
  getIdToken: () => Promise<string | null>;
};

export function createFunimas(auth: AuthHelpers, baseUrl = '/api') {
  const database = new DatabaseClient({
    baseUrl,
    getIdToken: auth.getIdToken,
  });

  return {
    database,
    auth,
  };
}

export type FunimasClient = ReturnType<typeof createFunimas>;

const defaultAuth: AuthHelpers = {
  getIdToken: async () => null,
};

export const Funimas: FunimasClient = createFunimas(defaultAuth);

export function configureFunimas(auth: AuthHelpers, baseUrl?: string) {
  const configured = createFunimas(auth, baseUrl ?? '/api');
  Object.assign(Funimas, configured);
  return Funimas;
}
