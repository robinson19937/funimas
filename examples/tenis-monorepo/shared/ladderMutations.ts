import type {
  ClubAction,
  ClubActionPayload,
  ClubDocument,
  ClubMember,
  Challenge,
} from './types/club.js';

function nowIso(): string {
  return new Date().toISOString();
}

function nextRank(club: ClubDocument): number {
  const ranks = Object.values(club.members).map((m) => m.rank);
  return ranks.length === 0 ? 1 : Math.max(...ranks) + 1;
}

function findChallenge(club: ClubDocument, challengeId: string): Challenge | undefined {
  return club.challenges.find((c) => c.id === challengeId);
}

export function applyClubAction(club: ClubDocument, uid: string, action: ClubAction): ClubDocument {
  const updated: ClubDocument = {
    ...club,
    members: { ...club.members },
    challenges: [...club.challenges],
    settings: { ...club.settings },
    codes: club.codes ? { ...club.codes } : undefined,
    version: club.version + 1,
    updatedAt: nowIso(),
  };

  switch (action.type) {
    case 'CREATE_CHALLENGE': {
      const { challengedUid } = action.payload as ClubActionPayload['CREATE_CHALLENGE'];
      if (!updated.members[uid] || !updated.members[challengedUid]) {
        throw new Error('Ambos jugadores deben estar registrados en el club.');
      }
      const challenge: Challenge = {
        id: `ch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        challengerUid: uid,
        challengedUid,
        status: 'pending',
        createdAt: nowIso(),
      };
      updated.challenges.push(challenge);
      break;
    }

    case 'ACCEPT_CHALLENGE': {
      const { challengeId } = action.payload as ClubActionPayload['ACCEPT_CHALLENGE'];
      const challenge = findChallenge(updated, challengeId);
      if (!challenge) throw new Error('Reto no encontrado.');
      if (challenge.challengedUid !== uid && !updated.adminUids.includes(uid)) {
        throw new Error('Solo el retado puede aceptar este reto.');
      }
      if (challenge.status !== 'pending') throw new Error('El reto ya fue respondido.');
      challenge.status = 'accepted';
      challenge.respondedAt = nowIso();
      break;
    }

    case 'DECLINE_CHALLENGE': {
      const { challengeId } = action.payload as ClubActionPayload['DECLINE_CHALLENGE'];
      const challenge = findChallenge(updated, challengeId);
      if (!challenge) throw new Error('Reto no encontrado.');
      if (challenge.challengedUid !== uid && !updated.adminUids.includes(uid)) {
        throw new Error('Solo el retado puede rechazar este reto.');
      }
      if (challenge.status !== 'pending') throw new Error('El reto ya fue respondido.');
      challenge.status = 'declined';
      challenge.respondedAt = nowIso();
      break;
    }

    case 'RECORD_MATCH': {
      const { challengeId, winnerUid, score } =
        action.payload as ClubActionPayload['RECORD_MATCH'];
      const challenge = findChallenge(updated, challengeId);
      if (!challenge) throw new Error('Reto no encontrado.');
      if (challenge.status !== 'accepted') {
        throw new Error('El reto debe estar aceptado para registrar el partido.');
      }
      if (winnerUid !== challenge.challengerUid && winnerUid !== challenge.challengedUid) {
        throw new Error('El ganador debe ser uno de los jugadores del reto.');
      }
      const loserUid =
        winnerUid === challenge.challengerUid ? challenge.challengedUid : challenge.challengerUid;
      const winner = updated.members[winnerUid];
      const loser = updated.members[loserUid];
      if (!winner || !loser) throw new Error('Jugadores no encontrados.');

      winner.wins += 1;
      loser.losses += 1;

      if (winner.rank > loser.rank) {
        const winnerRank = winner.rank;
        winner.rank = loser.rank;
        loser.rank = winnerRank;
      }

      challenge.status = 'completed';
      challenge.completedAt = nowIso();
      challenge.winnerUid = winnerUid;
      challenge.score = score;
      break;
    }

    case 'DELETE_PLAYER': {
      const { playerUid } = action.payload as ClubActionPayload['DELETE_PLAYER'];
      if (!updated.members[playerUid]) throw new Error('Jugador no encontrado.');
      delete updated.members[playerUid];
      updated.challenges = updated.challenges.filter(
        (c) => c.challengerUid !== playerUid && c.challengedUid !== playerUid,
      );
      break;
    }

    case 'DELETE_ALL_PLAYERS': {
      updated.members = {};
      updated.challenges = [];
      break;
    }

    case 'UPDATE_CLUB_CODES': {
      const payload = action.payload as ClubActionPayload['UPDATE_CLUB_CODES'];
      updated.codes = {
        ...updated.codes,
        ...payload,
      };
      if (payload.pin !== undefined) {
        updated.settings.pin = payload.pin;
      }
      break;
    }

    case 'REGISTER_PLAYER': {
      const { displayName } = action.payload as ClubActionPayload['REGISTER_PLAYER'];
      if (updated.members[uid]) throw new Error('Ya estás registrado en este club.');
      const member: ClubMember = {
        uid,
        displayName,
        rank: nextRank(updated),
        wins: 0,
        losses: 0,
        linkedAt: nowIso(),
      };
      updated.members[uid] = member;
      break;
    }

    default:
      throw new Error('Acción no soportada.');
  }

  return updated;
}

export function createInitialClubDocument(
  settings: ClubDocument['settings'],
  creatorUid: string,
): ClubDocument {
  const now = nowIso();
  return {
    version: 1,
    adminUids: [creatorUid],
    members: {},
    challenges: [],
    settings,
    codes: settings.pin ? { pin: settings.pin } : undefined,
    createdAt: now,
    updatedAt: now,
  };
}
