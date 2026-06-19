export interface AuthenticatedRequest {
  uid: string;
  path: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
}
