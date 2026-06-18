export function renderNetlifyTypes(): string {
  return `declare module '@netlify/functions' {
  export interface HandlerEvent {
    body?: string | null;
    headers?: Record<string, string | undefined>;
    httpMethod?: string;
    path?: string;
  }

  export interface HandlerResponse {
    statusCode: number;
    body: string;
    headers?: Record<string, string>;
  }

  export type Handler = (
    event: HandlerEvent,
    context?: unknown,
  ) => Promise<HandlerResponse> | HandlerResponse;
}
`;
}
