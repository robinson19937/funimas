import type { ClubAction, ClubActionType, ClubDocument, ClubSettings } from '../../shared/types/club.js';

export type GetIdToken = () => Promise<string | null>;
export type JsonRecord = Record<string, unknown>;

export interface DocumentReferenceLike {
  id: string;
  path?: string;
}

export interface DocumentSnapshotLike<TData extends JsonRecord = JsonRecord> {
  id: string;
  ref: DocumentReferenceLike;
  exists(): boolean;
  data(): TData | undefined;
}

export interface QueryDocumentSnapshotLike<TData extends JsonRecord = JsonRecord>
  extends DocumentSnapshotLike<TData> {
  data(): TData;
}

export interface QuerySnapshotLike<TData extends JsonRecord = JsonRecord>
  extends Iterable<QueryDocumentSnapshotLike<TData>> {
  docs: QueryDocumentSnapshotLike<TData>[];
  empty: boolean;
  size: number;
  forEach(callback: (doc: QueryDocumentSnapshotLike<TData>) => void): void;
}

export interface DatabaseClientOptions {
  baseUrl?: string;
  getIdToken: GetIdToken;
  fetchFn?: typeof fetch;
}

const FIRESTORE_SENTINEL_KEY = '__funimasFirestoreSentinel';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function isServerTimestampValue(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const methodName = Reflect.get(value, '_methodName') ?? Reflect.get(value, 'methodName');
  const constructorName = typeof value.constructor?.name === 'string' ? value.constructor.name : '';

  return methodName === 'serverTimestamp' || constructorName.includes('ServerTimestamp');
}

function encodeFirestoreJson(value: unknown): unknown {
  if (isServerTimestampValue(value)) {
    return { [FIRESTORE_SENTINEL_KEY]: 'serverTimestamp' };
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

function createDocumentReference(document: JsonRecord, fallbackId = ''): DocumentReferenceLike {
  return {
    id: String(document.id ?? fallbackId),
    path: typeof document.path === 'string' ? document.path : undefined,
  };
}

function createDocumentSnapshot<TData extends JsonRecord>(
  document: TData | null | undefined,
  fallbackId = '',
): DocumentSnapshotLike<TData> {
  const ref = createDocumentReference(document ?? {}, fallbackId);

  return {
    id: ref.id,
    ref,
    exists: () => document !== null && document !== undefined,
    data: () => document ?? undefined,
  };
}

function createQuerySnapshot<TData extends JsonRecord>(documents: TData[]): QuerySnapshotLike<TData> {
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
  private readonly baseUrl: string;
  private readonly getIdToken: GetIdToken;
  private readonly fetchFn: typeof fetch;

  constructor(options: DatabaseClientOptions) {
    this.baseUrl = (options.baseUrl ?? '/api').replace(/\/$/, '');
    this.getIdToken = options.getIdToken;
    this.fetchFn = options.fetchFn ?? fetch.bind(globalThis);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = await this.getIdToken();
    if (!token) {
      throw new ApiError('Debes iniciar sesión para continuar.', 401);
    }

    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body !== undefined ? JSON.stringify(encodeFirestoreJson(body)) : undefined,
    });

    const payload = (await response.json().catch(() => ({
      success: false,
      message: 'Respuesta inválida del servidor.',
    }))) as {
      success: boolean;
      data?: T;
      message?: string;
      code?: string;
    };

    if (!response.ok || !payload.success) {
      throw new ApiError(
        payload.message ?? 'No se pudo completar la operación.',
        response.status,
        payload.code,
      );
    }

    return payload.data as T;
  }

  async fetchClubDocument(clubId: string): Promise<ClubDocument> {
    return this.request<ClubDocument>('POST', `/clubs/${encodeURIComponent(clubId)}/read`, {});
  }

  async createClubDocument(
    clubId: string,
    settings: ClubSettings,
    _creatorUid: string,
  ): Promise<{ clubId: string; club: ClubDocument }> {
    return this.request('POST', '/clubs', { clubId, settings });
  }

  async mutateClubDocument(clubId: string, action: ClubAction): Promise<ClubDocument> {
    return this.request<ClubDocument>(
      'POST',
      `/clubs/${encodeURIComponent(clubId)}/mutate`,
      { action },
    );
  }

  async mutateFromAppState<T>(
    clubId: string,
    actionType: ClubActionType,
    payload: ClubAction['payload'],
    _patch?: (state: T) => T,
  ): Promise<ClubDocument> {
    return this.mutateClubDocument(clubId, {
      type: actionType,
      payload,
    } as ClubAction);
  }

  async pollClubDocument(
    clubId: string,
    intervalMs = 5000,
    onUpdate: (club: ClubDocument) => void,
    signal?: AbortSignal,
  ): Promise<() => void> {
    let active = true;

    const poll = async () => {
      while (active && !signal?.aborted) {
        try {
          const club = await this.fetchClubDocument(clubId);
          onUpdate(club);
        } catch {
          // Polling silencioso; el consumidor puede manejar errores en UI.
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    };

    void poll();

    return () => {
      active = false;
    };
  }

  /** Compatibilidad con rewrites de addDoc() en proyectos protegidos. */
  async insert(collection: string, data: unknown): Promise<DocumentReferenceLike> {
    const saved = await this.request<JsonRecord>('POST', '/insert', { collection, data });
    return createDocumentReference(saved);
  }

  async get(collection: string, id: string): Promise<DocumentSnapshotLike> {
    try {
      const data = await this.request<JsonRecord>('POST', '/read', {
        collection,
        id,
      });
      return createDocumentSnapshot(data, id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return createDocumentSnapshot(undefined, id);
      }

      throw error;
    }
  }

  async getAtPath(...pathSegments: Array<string | number>): Promise<DocumentSnapshotLike> {
    const path = pathSegments.map(String);
    const id = path.at(-1) ?? '';

    try {
      const data = await this.request<JsonRecord>('POST', '/read', { path });
      return createDocumentSnapshot(data, id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return createDocumentSnapshot(undefined, id);
      }

      throw error;
    }
  }

  async list(collection: string): Promise<QuerySnapshotLike> {
    const documents = await this.request<JsonRecord[]>('POST', '/list', { collection });
    return createQuerySnapshot(documents);
  }

  async listWhere(
    collection: string,
    field: string,
    operator: string,
    value: unknown,
  ): Promise<QuerySnapshotLike> {
    const documents = await this.request<JsonRecord[]>('POST', '/list', {
      collection,
      filters: [{ field, operator, value }],
    });
    return createQuerySnapshot(documents);
  }

  /**
   * set reemplaza el documento completo y puede crearlo si no existe.
   * Para merges idempotentes usa upsertDocument(); para exigir existencia usa updateExistingDocument().
   */
  async set(collection: string, id: string, data: unknown): Promise<void> {
    await this.request('POST', '/set', { collection, id, data });
  }

  /** Crea un documento con ID conocido y falla si ya existe. */
  async createDocument(collection: string, id: string, data: unknown): Promise<void> {
    await this.request('POST', '/create', { collection, id, data });
  }

  /** Crea o mezcla campos sin borrar los existentes; seguro para datos iniciales reintentables. */
  async upsertDocument(collection: string, id: string, data: unknown): Promise<void> {
    await this.request('POST', '/upsert', { collection, id, data });
  }

  async setAtPath(...args: Array<string | number | JsonRecord>): Promise<void> {
    const data = args.at(-1) as JsonRecord;
    const path = args.slice(0, -1).map(String);
    await this.request('POST', '/set', { path, data });
  }

  async createDocumentAtPath(...args: Array<string | number | JsonRecord>): Promise<void> {
    const data = args.at(-1) as JsonRecord;
    const path = args.slice(0, -1).map(String);
    await this.request('POST', '/create', { path, data });
  }

  async upsertDocumentAtPath(...args: Array<string | number | JsonRecord>): Promise<void> {
    const data = args.at(-1) as JsonRecord;
    const path = args.slice(0, -1).map(String);
    await this.request('POST', '/upsert', { path, data });
  }

  /** Alias histórico: update solo modifica documentos existentes. */
  async update(collection: string, id: string, data: unknown): Promise<void> {
    await this.updateExistingDocument(collection, id, data);
  }

  async updateExistingDocument(collection: string, id: string, data: unknown): Promise<void> {
    await this.request('POST', '/update', { collection, id, data });
  }

  async updateAtPath(...args: Array<string | number | JsonRecord>): Promise<void> {
    await this.updateExistingDocumentAtPath(...args);
  }

  async updateExistingDocumentAtPath(...args: Array<string | number | JsonRecord>): Promise<void> {
    const data = args.at(-1) as JsonRecord;
    const path = args.slice(0, -1).map(String);
    await this.request('POST', '/update', { path, data });
  }

  async delete(collection: string, id: string): Promise<void> {
    await this.request('POST', '/delete', { collection, id });
  }

  async deleteAtPath(...pathSegments: Array<string | number>): Promise<void> {
    await this.request('POST', '/delete', {
      path: pathSegments.map(String),
    });
  }

  poll(
    collection: string,
    id: string,
    onNext: (snapshot: DocumentSnapshotLike) => void,
    intervalMs = 5000,
  ): () => void {
    let active = true;

    const run = async () => {
      while (active) {
        try {
          onNext(await this.get(collection, id));
        } catch {
          onNext(createDocumentSnapshot(undefined, id));
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    };

    void run();

    return () => {
      active = false;
    };
  }

  pollCollection(
    collection: string,
    onNext: (snapshot: QuerySnapshotLike) => void,
    intervalMs = 5000,
  ): () => void {
    let active = true;

    const run = async () => {
      while (active) {
        try {
          onNext(await this.list(collection));
        } catch {
          onNext(createQuerySnapshot([]));
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
