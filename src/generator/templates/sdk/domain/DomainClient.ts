export function renderDomainClient(): string {
  return `import { ApiError } from '../database/DatabaseClient.js';

export type DomainExecuteParams = Record<string, unknown>;

export class DomainClient {
  private readonly baseUrl: string;
  private readonly getIdToken: () => Promise<string | null>;
  private readonly fetchFn: typeof fetch;

  constructor(options: {
    baseUrl?: string;
    getIdToken: () => Promise<string | null>;
    fetchFn?: typeof fetch;
  }) {
    this.baseUrl = (options.baseUrl ?? '/api').replace(/\\/$/, '');
    this.getIdToken = options.getIdToken;
    this.fetchFn = options.fetchFn ?? fetch.bind(globalThis);
  }

  async execute(mutationId: string, params: DomainExecuteParams = {}): Promise<{ ok: true }> {
    const token = await this.getIdToken();

    if (!token) {
      throw new ApiError('Debes iniciar sesión para continuar.', 401);
    }

    const response = await this.fetchFn(this.baseUrl + '/domain/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({ mutationId, params }),
    });

    const payload = await response.json().catch(() => ({
      success: false,
      message: 'Respuesta inválida del servidor.',
    }));

    if (!response.ok || !payload.success) {
      throw new ApiError(
        payload.message ?? 'No se pudo ejecutar la mutación de dominio.',
        response.status,
        payload.code,
      );
    }

    return { ok: true };
  }
}
`;
}
