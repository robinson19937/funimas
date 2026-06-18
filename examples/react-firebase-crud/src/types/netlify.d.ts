declare module '@netlify/functions' {
  export interface HandlerEvent {
    body?: string | null;
  }

  export interface HandlerResponse {
    statusCode: number;
    body: string;
  }

  export type Handler = (event: HandlerEvent) => Promise<HandlerResponse>;
}
