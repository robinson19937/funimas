import { authenticateRequest } from './middleware/authMiddleware.js';
import { AuthorizationError, createClubsController } from './controllers/clubsController.js';
import { FirestoreRepository } from './repositories/firestoreRepository.js';
import type { AuthenticatedRequest, ApiResponse } from './models/Request.js';
import type { ClubAction } from '../shared/types/club.js';

export interface HttpRequest {
  path: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
}

export interface HttpResponse {
  status: number;
  body: ApiResponse;
}

const clubsController = createClubsController();
const firestoreRepository = new FirestoreRepository();

function parseClubIdFromPath(path: string, suffix: string): string | null {
  const pattern = new RegExp(`^/api/clubs/([^/]+)${suffix}$`);
  const match = path.match(pattern);
  return match?.[1] ?? null;
}

function jsonResponse(status: number, body: ApiResponse): HttpResponse {
  return { status, body };
}

export async function routeHttpRequest(request: HttpRequest): Promise<HttpResponse> {
  const { path, method, headers } = request;

  try {
    if (method === 'POST' && path === '/api/clubs') {
      const authResult = await authenticateRequest({
        path,
        method,
        body: request.body,
        headers,
      });

      if ('error' in authResult) {
        return jsonResponse(authResult.status, { success: false, message: authResult.error });
      }

      const body = request.body as { clubId?: string; settings?: { name: string; pin?: string } };
      if (!body?.clubId || !body?.settings?.name) {
        return jsonResponse(400, {
          success: false,
          message: 'clubId y settings.name son obligatorios.',
        });
      }

      const result = await clubsController.createClub(authResult, {
        clubId: body.clubId,
        settings: body.settings,
      });
      return jsonResponse(result.success ? 201 : 400, result);
    }

    if (method === 'POST' && path.endsWith('/read')) {
      const clubId = parseClubIdFromPath(path, '/read');
      if (!clubId) {
        return jsonResponse(404, { success: false, message: 'Ruta no encontrada.' });
      }

      const authResult = await authenticateRequest({
        path,
        method,
        body: request.body,
        headers,
      });

      if ('error' in authResult) {
        return jsonResponse(authResult.status, { success: false, message: authResult.error });
      }

      const result = await clubsController.readClub(authResult, clubId);
      return jsonResponse(result.success ? 200 : 404, result);
    }

    if (method === 'POST' && path.endsWith('/mutate')) {
      const clubId = parseClubIdFromPath(path, '/mutate');
      if (!clubId) {
        return jsonResponse(404, { success: false, message: 'Ruta no encontrada.' });
      }

      const authResult = await authenticateRequest({
        path,
        method,
        body: request.body,
        headers,
      });

      if ('error' in authResult) {
        return jsonResponse(authResult.status, { success: false, message: authResult.error });
      }

      const body = request.body as { action?: ClubAction };
      if (!body?.action?.type) {
        return jsonResponse(400, {
          success: false,
          message: 'Se requiere una acción tipada en el cuerpo de la petición.',
        });
      }

      const result = await clubsController.mutateClub(authResult, clubId, body.action);
      return jsonResponse(result.success ? 200 : 400, result);
    }

    if (method === 'POST' && path === '/api/insert') {
      const authResult = await authenticateRequest({
        path,
        method,
        body: request.body,
        headers,
      });

      if ('error' in authResult) {
        return jsonResponse(authResult.status, { success: false, message: authResult.error });
      }

      const body = request.body as { collection?: string; data?: Record<string, unknown> };
      if (!body?.collection || !body?.data) {
        return jsonResponse(400, {
          success: false,
          message: 'collection y data son obligatorios.',
        });
      }

      const saved = await firestoreRepository.insert(body.collection, body.data);
      return jsonResponse(201, { success: true, data: saved });
    }

    return jsonResponse(404, { success: false, message: 'Ruta no encontrada.' });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonResponse(403, { success: false, message: error.message });
    }

    const message = error instanceof Error ? error.message : 'Error interno del servidor.';
    return jsonResponse(500, { success: false, message });
  }
}

export function createRouter() {
  return {
    handle: routeHttpRequest,
  };
}

export type { AuthenticatedRequest };
