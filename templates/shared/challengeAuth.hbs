import type { ClubDocument, ClubAction, ClubActionPayload, ClubActionType } from './types/club.js';

export function isClubAdmin(club: ClubDocument, uid: string): boolean {
  return club.adminUids.includes(uid);
}

export function isClubMember(club: ClubDocument, uid: string): boolean {
  return Boolean(club.members[uid]);
}

export function isLinkedMember(club: ClubDocument, uid: string): boolean {
  const member = club.members[uid];
  return Boolean(member && member.uid === uid);
}

const ADMIN_ONLY_ACTIONS: ClubActionType[] = [
  'DELETE_PLAYER',
  'DELETE_ALL_PLAYERS',
  'UPDATE_CLUB_CODES',
];

const MEMBER_OR_ADMIN_ACTIONS: ClubActionType[] = [
  'CREATE_CHALLENGE',
  'ACCEPT_CHALLENGE',
  'DECLINE_CHALLENGE',
  'RECORD_MATCH',
];

export function canPerformAction(
  club: ClubDocument,
  uid: string,
  action: ClubAction,
): { allowed: boolean; reason?: string } {
  if (ADMIN_ONLY_ACTIONS.includes(action.type)) {
    if (!isClubAdmin(club, uid)) {
      return { allowed: false, reason: 'Solo los administradores pueden realizar esta acción.' };
    }
    return { allowed: true };
  }

  if (MEMBER_OR_ADMIN_ACTIONS.includes(action.type)) {
    if (!isClubAdmin(club, uid) && !isLinkedMember(club, uid)) {
      return {
        allowed: false,
        reason: 'Debes ser miembro vinculado del club para realizar esta acción.',
      };
    }
    return { allowed: true };
  }

  if (action.type === 'REGISTER_PLAYER') {
    if (isClubMember(club, uid)) {
      return { allowed: false, reason: 'Ya estás registrado en este club.' };
    }
    const requiredPin = club.codes?.pin ?? club.settings.pin;
    const providedPin = (action.payload as ClubActionPayload['REGISTER_PLAYER']).pin;
    if (requiredPin && requiredPin !== providedPin) {
      return { allowed: false, reason: 'PIN del club incorrecto.' };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'Acción no reconocida.' };
}

export function canReadClub(uid: string | null): { allowed: boolean; reason?: string } {
  if (!uid) {
    return { allowed: false, reason: 'Debes iniciar sesión para ver el club.' };
  }
  return { allowed: true };
}

export function canCreateClub(creatorUid: string, adminUids: string[]): boolean {
  return adminUids.includes(creatorUid);
}
