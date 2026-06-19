export function renderDatabaseClient(): string {
  return `import type { ClubAction, ClubActionType, ClubDocument, ClubSettings } from '../../shared/types/club.js';

export type GetIdToken = () => Promise<string | null>;

export interface DatabaseClientOptions {
  baseUrl?: string;
  getIdToken: GetIdToken;
  fetchFn?: typeof fetch;
}

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

export class DatabaseClient {
  private readonly baseUrl: string;
  private readonly getIdToken: GetIdToken;
  private readonly fetchFn: typeof fetch;

  constructor(options: DatabaseClientOptions) {
    this.baseUrl = (options.baseUrl ?? '/api').replace(/\\/$/, '');
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

    const response = await this.fetchFn(\`\${this.baseUrl}\${path}\`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: \`Bearer \${token}\`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const payload = (await response.json()) as {
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
    return this.request<ClubDocument>('POST', \`/clubs/\${encodeURIComponent(clubId)}/read\`, {});
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
      \`/clubs/\${encodeURIComponent(clubId)}/mutate\`,
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
          // Polling silencioso
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    };

    void poll();

    return () => {
      active = false;
    };
  }

  async insert(collection: string, data: unknown): Promise<void> {
    await this.request('POST', '/insert', { collection, data });
  }

  async get(collection: string, id: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/read', { collection, id });
  }

  async list(collection: string): Promise<Record<string, unknown>[]> {
    return this.request<Record<string, unknown>[]>('POST', '/list', { collection });
  }

  async set(collection: string, id: string, data: unknown): Promise<void> {
    await this.request('POST', '/set', { collection, id, data });
  }

  async update(collection: string, id: string, data: unknown): Promise<void> {
    await this.request('POST', '/update', { collection, id, data });
  }

  async delete(collection: string, id: string): Promise<void> {
    await this.request('POST', '/delete', { collection, id });
  }

  poll(
    collection: string,
    id: string,
    onNext: (snapshot: {
      exists: () => boolean;
      data: () => Record<string, unknown> | undefined;
      id: string;
    }) => void,
    intervalMs = 5000,
  ): () => void {
    let active = true;

    const run = async () => {
      while (active) {
        try {
          const data = await this.get(collection, id);
          onNext({
            exists: () => true,
            data: () => data,
            id: String(data.id ?? id),
          });
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

  pollCollection(
    collection: string,
    onNext: (snapshot: {
      docs: Array<{
        exists: () => boolean;
        data: () => Record<string, unknown>;
        id: string;
      }>;
      empty: boolean;
      forEach: (
        callback: (doc: {
          exists: () => boolean;
          data: () => Record<string, unknown>;
          id: string;
        }) => void,
      ) => void;
    }) => void,
    intervalMs = 5000,
  ): () => void {
    let active = true;

    const run = async () => {
      while (active) {
        try {
          const documents = await this.list(collection);
          const docs = documents.map((document) => ({
            exists: () => true,
            data: () => document,
            id: String(document.id ?? ''),
          }));

          onNext({
            docs,
            empty: docs.length === 0,
            forEach: (callback) => {
              for (const doc of docs) {
                callback(doc);
              }
            },
          });
        } catch {
          onNext({
            docs: [],
            empty: true,
            forEach: () => undefined,
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
`;
}
