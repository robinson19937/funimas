import {
  canCreateClub,
  canPerformAction,
  canReadClub,
} from '../../shared/challengeAuth.js';
import type { ClubAction, ClubDocument } from '../../shared/types/club.js';

export function authorizeClubRead(uid: string): void {
  const result = canReadClub(uid);
  if (!result.allowed) {
    throw new AuthorizationError(result.reason ?? 'No autorizado.');
  }
}

export function authorizeClubCreate(creatorUid: string, adminUids: string[]): void {
  if (!canCreateClub(creatorUid, adminUids)) {
    throw new AuthorizationError('El creador debe ser administrador del club.');
  }
}

export function authorizeClubMutation(
  club: ClubDocument,
  uid: string,
  action: ClubAction,
): void {
  const result = canPerformAction(club, uid, action);
  if (!result.allowed) {
    throw new AuthorizationError(result.reason ?? 'No autorizado para esta acción.');
  }
}

export class AuthorizationError extends Error {
  readonly status = 403;

  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}
