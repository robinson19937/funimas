import type { ClubDocument } from '../../shared/types/club.js';
import type { ApiResponse } from './Request.js';

export type ClubReadResponse = ApiResponse<ClubDocument>;
export type ClubMutateResponse = ApiResponse<ClubDocument>;
export type ClubCreateResponse = ApiResponse<{ clubId: string }>;
