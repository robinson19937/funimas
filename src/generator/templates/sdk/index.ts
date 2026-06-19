export function renderSdkIndex(): string {
  return `import { DatabaseClient } from './database/DatabaseClient.js';

export type { DatabaseClientOptions, GetIdToken } from './database/DatabaseClient.js';
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

const defaultAuth: AuthHelpers = {
  getIdToken: async () => null,
};

export const Funimas = createFunimas(defaultAuth);

export function configureFunimas(auth: AuthHelpers, baseUrl?: string) {
  return createFunimas(auth, baseUrl ?? '/api');
}
`;
}
