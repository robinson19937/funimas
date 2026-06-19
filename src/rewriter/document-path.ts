export interface DocumentPathParts {
  rootCollection: string;
  segmentArgs: string[];
}

export function formatDocumentPathCall(
  method: string,
  parts: DocumentPathParts,
  trailingArgs: string[] = [],
): string {
  const args = [...parts.segmentArgs, ...trailingArgs].join(', ');

  if (parts.segmentArgs.length === 2 && trailingArgs.length === 0) {
    return `Funimas.database.${method}(${args})`;
  }

  if (parts.segmentArgs.length === 2 && trailingArgs.length > 0) {
    return `Funimas.database.${method}(${args})`;
  }

  return `Funimas.database.${method}AtPath(${args})`;
}

export function rootCollectionFromParts(parts: DocumentPathParts): string {
  return parts.rootCollection;
}
