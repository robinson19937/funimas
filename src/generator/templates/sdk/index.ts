export function renderSdkIndex(): string {
  return `import { DatabaseClient } from './database/DatabaseClient.js';

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

export type FunimasClient = ReturnType<typeof createFunimas>;

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

export const Funimas: FunimasClient = createFunimas(defaultAuth);

export function configureFunimas(auth: AuthHelpers, baseUrl?: string) {
  const configured = createFunimas(auth, baseUrl ?? '/api');
  Object.assign(Funimas, configured);
  return Funimas;
}
`;
}

export function renderSdkBrowserIndex(): string {
  return `const FIRESTORE_SENTINEL_KEY = '__funimasFirestoreSentinel';

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null;
}

function isServerTimestampValue(value) {
  if (!isRecord(value)) {
    return false;
  }

  const methodName = Reflect.get(value, '_methodName') ?? Reflect.get(value, 'methodName');
  const constructorName = typeof value.constructor?.name === 'string' ? value.constructor.name : '';

  return methodName === 'serverTimestamp' || constructorName.includes('ServerTimestamp');
}

function isIncrementValue(value) {
  if (!isRecord(value)) {
    return false;
  }

  const methodName = Reflect.get(value, '_methodName') ?? Reflect.get(value, 'methodName');
  const constructorName = typeof value.constructor?.name === 'string' ? value.constructor.name : '';

  return methodName === 'increment' || constructorName.includes('NumericIncrementFieldValue');
}

function getIncrementAmount(value) {
  if (!isRecord(value)) {
    return 1;
  }

  const operand = Reflect.get(value, '_operand') ?? Reflect.get(value, 'operand');

  if (typeof operand === 'number') {
    return operand;
  }

  return 1;
}

function encodeFirestoreJson(value) {
  if (isServerTimestampValue(value)) {
    return { [FIRESTORE_SENTINEL_KEY]: 'serverTimestamp' };
  }

  if (isIncrementValue(value)) {
    return { [FIRESTORE_SENTINEL_KEY]: 'increment', amount: getIncrementAmount(value) };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => encodeFirestoreJson(entry));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, encodeFirestoreJson(entry)]),
    );
  }

  return value;
}

function createDocumentReference(document, fallbackId = '') {
  return {
    id: String(document.id ?? fallbackId),
    path: typeof document.path === 'string' ? document.path : undefined,
  };
}

function createDocumentSnapshot(document, fallbackId = '') {
  const ref = createDocumentReference(document ?? {}, fallbackId);

  return {
    id: ref.id,
    ref,
    exists: () => document !== null && document !== undefined,
    data: () => document ?? undefined,
  };
}

function createQuerySnapshot(documents) {
  const docs = documents.map((document) => {
    const snapshot = createDocumentSnapshot(document, String(document.id ?? ''));
    return {
      ...snapshot,
      data: () => document,
    };
  });

  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (callback) => {
      for (const doc of docs) {
        callback(doc);
      }
    },
    [Symbol.iterator]: function* () {
      yield* docs;
    },
  };
}

export class DatabaseClient {
  constructor(options) {
    this.baseUrl = (options.baseUrl ?? '/api').replace(/\\/$/, '');
    this.getIdToken = options.getIdToken;
    this.fetchFn = options.fetchFn ?? fetch.bind(globalThis);
  }

  async request(method, path, body) {
    const token = await this.getIdToken();
    if (!token) {
      throw new ApiError('Debes iniciar sesión para continuar.', 401);
    }

    const response = await this.fetchFn(this.baseUrl + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: body !== undefined ? JSON.stringify(encodeFirestoreJson(body)) : undefined,
    });

    const payload = await response.json().catch(() => ({
      success: false,
      message: 'Respuesta inválida del servidor.',
    }));

    if (!response.ok || !payload.success) {
      throw new ApiError(
        payload.message ?? 'No se pudo completar la operación.',
        response.status,
        payload.code,
      );
    }

    return payload.data;
  }

  async fetchClubDocument(clubId) {
    return this.request('POST', '/clubs/' + encodeURIComponent(clubId) + '/read', {});
  }

  async createClubDocument(clubId, settings) {
    return this.request('POST', '/clubs', { clubId, settings });
  }

  async mutateClubDocument(clubId, action) {
    return this.request('POST', '/clubs/' + encodeURIComponent(clubId) + '/mutate', { action });
  }

  async mutateFromAppState(clubId, actionType, payload) {
    return this.mutateClubDocument(clubId, { type: actionType, payload });
  }

  async pollClubDocument(clubId, intervalMs = 5000, onUpdate, signal) {
    let active = true;
    const poll = async () => {
      while (active && !signal?.aborted) {
        try {
          onUpdate(await this.fetchClubDocument(clubId));
        } catch {
          // Polling silencioso.
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    };
    void poll();
    return () => {
      active = false;
    };
  }

  async insert(collection, data) {
    const saved = await this.request('POST', '/insert', { collection, data });
    return createDocumentReference(saved);
  }

  async get(collection, id) {
    try {
      return createDocumentSnapshot(await this.request('POST', '/read', { collection, id }), id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return createDocumentSnapshot(undefined, id);
      }

      throw error;
    }
  }

  async getAtPath(...pathSegments) {
    const path = pathSegments.map(String);
    const id = path.at(-1) ?? '';
    try {
      return createDocumentSnapshot(await this.request('POST', '/read', { path }), id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return createDocumentSnapshot(undefined, id);
      }

      throw error;
    }
  }

  async list(collection) {
    return createQuerySnapshot(await this.request('POST', '/list', { collection }));
  }

  async listWhere(collection, field, operator, value) {
    return createQuerySnapshot(
      await this.request('POST', '/list', {
        collection,
        filters: [{ field, operator, value }],
      }),
    );
  }

  async set(collection, id, data) {
    await this.request('POST', '/set', { collection, id, data });
  }

  async createDocument(collection, id, data) {
    await this.request('POST', '/create', { collection, id, data });
  }

  async upsertDocument(collection, id, data) {
    await this.request('POST', '/upsert', { collection, id, data });
  }

  async setAtPath(...args) {
    const data = args.at(-1);
    const path = args.slice(0, -1).map(String);
    await this.request('POST', '/set', { path, data });
  }

  async createDocumentAtPath(...args) {
    const data = args.at(-1);
    const path = args.slice(0, -1).map(String);
    await this.request('POST', '/create', { path, data });
  }

  async upsertDocumentAtPath(...args) {
    const data = args.at(-1);
    const path = args.slice(0, -1).map(String);
    await this.request('POST', '/upsert', { path, data });
  }

  async update(collection, id, data) {
    await this.updateExistingDocument(collection, id, data);
  }

  async updateExistingDocument(collection, id, data) {
    await this.request('POST', '/update', { collection, id, data });
  }

  async updateAtPath(...args) {
    await this.updateExistingDocumentAtPath(...args);
  }

  async updateExistingDocumentAtPath(...args) {
    const data = args.at(-1);
    const path = args.slice(0, -1).map(String);
    await this.request('POST', '/update', { path, data });
  }

  async delete(collection, id) {
    await this.request('POST', '/delete', { collection, id });
  }

  async deleteAtPath(...pathSegments) {
    await this.request('POST', '/delete', { path: pathSegments.map(String) });
  }

  poll(collection, id, onNext, intervalMs = 5000) {
    let active = true;
    const run = async () => {
      while (active) {
        try {
          onNext(await this.get(collection, id));
        } catch {
          onNext({
            exists: () => false,
            data: () => undefined,
            id,
          });
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    };
    void run();
    return () => {
      active = false;
    };
  }

  pollCollection(collection, onNext, intervalMs = 5000) {
    let active = true;
    const run = async () => {
      while (active) {
        try {
          onNext(await this.list(collection));
        } catch {
          onNext({
            docs: [],
            empty: true,
            size: 0,
            forEach: () => undefined,
            [Symbol.iterator]: function* () {},
          });
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    };
    void run();
    return () => {
      active = false;
    };
  }
}

export function createFunimas(auth, baseUrl = '/api') {
  const database = new DatabaseClient({
    baseUrl,
    getIdToken: auth.getIdToken,
  });

  return {
    database,
    auth,
  };
}

const defaultAuth = {
  getIdToken: async () => null,
};

export const Funimas = createFunimas(defaultAuth);

export function configureFunimas(auth, baseUrl = '/api') {
  const configured = createFunimas(auth, baseUrl);
  Object.assign(Funimas, configured);
  return Funimas;
}
`;
}
