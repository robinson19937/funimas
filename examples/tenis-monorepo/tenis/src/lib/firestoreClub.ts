import { configureFunimas } from '@funimas/sdk';
import type { ClubAction, ClubActionType, ClubDocument, ClubSettings } from '@funimas/shared';

import { auth } from './firebase.js';

const funimas = configureFunimas(
  {
    getIdToken: async () => {
      const user = auth.currentUser;
      if (!user) return null;
      return user.getIdToken();
    },
  },
  import.meta.env.VITE_FUNIMAS_API_URL ?? '/api',
);

/**
 * Capa de acceso a datos del club vía Funimas SDK.
 * El cliente NO usa firebase/firestore directamente.
 */
export async function fetchClubDocument(clubId: string): Promise<ClubDocument> {
  return funimas.database.fetchClubDocument(clubId);
}

export async function createClubDocument(
  clubId: string,
  settings: ClubSettings,
  creatorUid: string,
): Promise<{ clubId: string; club: ClubDocument }> {
  return funimas.database.createClubDocument(clubId, settings, creatorUid);
}

export async function mutateClubDocument(
  clubId: string,
  action: ClubAction,
): Promise<ClubDocument> {
  return funimas.database.mutateClubDocument(clubId, action);
}

export async function mutateFromAppState<T>(
  clubId: string,
  actionType: ClubActionType,
  payload: ClubAction['payload'],
  patch?: (state: T) => T,
): Promise<ClubDocument> {
  return funimas.database.mutateFromAppState(clubId, actionType, payload, patch);
}

export function subscribeClubDocument(
  clubId: string,
  onUpdate: (club: ClubDocument) => void,
  intervalMs = 5000,
): () => void {
  const controller = new AbortController();
  let stop: (() => void) | undefined;

  void funimas.database
    .pollClubDocument(clubId, intervalMs, onUpdate, controller.signal)
    .then((cancel) => {
      stop = cancel;
    });

  return () => {
    controller.abort();
    stop?.();
  };
}

export { funimas };
