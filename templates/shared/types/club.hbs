export interface ClubSettings {
  name: string;
  pin?: string;
  maxPlayers?: number;
}

export interface ClubMember {
  uid: string;
  displayName: string;
  rank: number;
  wins: number;
  losses: number;
  linkedAt: string;
}

export type ChallengeStatus = 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled';

export interface Challenge {
  id: string;
  challengerUid: string;
  challengedUid: string;
  status: ChallengeStatus;
  createdAt: string;
  respondedAt?: string;
  completedAt?: string;
  winnerUid?: string;
  score?: string;
}

export interface ClubDocument {
  version: number;
  adminUids: string[];
  members: Record<string, ClubMember>;
  challenges: Challenge[];
  settings: ClubSettings;
  codes?: {
    pin?: string;
    invite?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type ClubActionType =
  | 'CREATE_CHALLENGE'
  | 'ACCEPT_CHALLENGE'
  | 'DECLINE_CHALLENGE'
  | 'RECORD_MATCH'
  | 'DELETE_PLAYER'
  | 'DELETE_ALL_PLAYERS'
  | 'UPDATE_CLUB_CODES'
  | 'REGISTER_PLAYER';

export interface ClubActionPayload {
  CREATE_CHALLENGE: { challengedUid: string };
  ACCEPT_CHALLENGE: { challengeId: string };
  DECLINE_CHALLENGE: { challengeId: string };
  RECORD_MATCH: { challengeId: string; winnerUid: string; score?: string };
  DELETE_PLAYER: { playerUid: string };
  DELETE_ALL_PLAYERS: Record<string, never>;
  UPDATE_CLUB_CODES: { pin?: string; invite?: string };
  REGISTER_PLAYER: { displayName: string; pin?: string };
}

export type ClubAction<T extends ClubActionType = ClubActionType> = {
  type: T;
  payload: ClubActionPayload[T];
};

export interface CreateClubInput {
  clubId: string;
  settings: ClubSettings;
  creatorUid: string;
}
