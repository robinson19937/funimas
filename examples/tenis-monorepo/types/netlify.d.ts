declare module '@netlify/functions' {
  export interface HandlerEvent {
    body: string | null;
    headers: Record<string, string | undefined>;
    httpMethod: string;
    path: string;
    rawUrl?: string;
  }

  export interface HandlerContext {
    functionName: string;
  }

  export interface HandlerResponse {
    statusCode: number;
    headers?: Record<string, string>;
    body?: string;
  }

  export type Handler = (
    event: HandlerEvent,
    context: HandlerContext,
  ) => Promise<HandlerResponse> | HandlerResponse;
}
