import type { Handler } from '@netlify/functions';

import { createHandler } from '../../runtime/handler.js';

const runtime = createHandler();

function normalizePath(event: import('@netlify/functions').HandlerEvent): string {
  const rawPath = event.rawUrl ? new URL(event.rawUrl).pathname : event.path;
  const strippedPath = rawPath.replace(/^\/\.netlify\/functions\/funimas/, '') || '/';

  if (strippedPath === '/' || strippedPath === '/api' || strippedPath.startsWith('/api/')) {
    return strippedPath;
  }

  return `/api${strippedPath.startsWith('/') ? strippedPath : `/${strippedPath}`}`;
}

function collectHeaders(event: import('@netlify/functions').HandlerEvent): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(event.headers)) {
    if (value) headers[key.toLowerCase()] = value;
  }
  return headers;
}

export const handler: Handler = async (event, _context) => {
  try {
    const path = normalizePath(event);
    const body = event.body ? JSON.parse(event.body) : undefined;

    const response = await runtime.handle({
      path,
      method: event.httpMethod,
      body,
      headers: collectHeaders(event),
    });

    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response.body),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Error interno del servidor.',
      }),
    };
  }
};
