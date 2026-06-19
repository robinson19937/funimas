import { FirestoreRepository } from '../repositories/firestoreRepository.js';
import {
  authorizeClubCreate,
  authorizeClubMutation,
  authorizeClubRead,
  AuthorizationError,
} from '../middleware/authorization.js';
import type { AuthenticatedRequest, ApiResponse } from '../models/Request.js';
import type { ClubAction, ClubSettings } from '../../shared/types/club.js';

export function createClubsController() {
  const repository = new FirestoreRepository();

  return {
    async readClub(
      request: AuthenticatedRequest,
      clubId: string,
    ): Promise<ApiResponse> {
      authorizeClubRead(request.uid);

      const club = await repository.getClub(clubId);
      if (!club) {
        return { success: false, message: 'Club no encontrado.', code: 'NOT_FOUND' };
      }

      return { success: true, data: club };
    },

    async mutateClub(
      request: AuthenticatedRequest,
      clubId: string,
      action: ClubAction,
    ): Promise<ApiResponse> {
      const club = await repository.getClub(clubId);
      if (!club) {
        return { success: false, message: 'Club no encontrado.', code: 'NOT_FOUND' };
      }

      authorizeClubMutation(club, request.uid, action);
      const updated = await repository.mutateClub(clubId, request.uid, action);
      return { success: true, data: updated };
    },

    async createClub(
      request: AuthenticatedRequest,
      body: { clubId: string; settings: ClubSettings },
    ): Promise<ApiResponse> {
      const adminUids = [request.uid];
      authorizeClubCreate(request.uid, adminUids);

      const document = await repository.createClub(body.clubId, body.settings, request.uid);
      return { success: true, data: { clubId: body.clubId, club: document } };
    },
  };
}

export { AuthorizationError };
