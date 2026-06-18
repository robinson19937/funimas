import type { SemanticOperationType } from '../semantic/SemanticOperationType.js';

const DATABASE_INSERT_REASON =
  'La operación addDoc() fue reemplazada porque la escritura directa desde el cliente expone la lógica de acceso a la base de datos. La nueva implementación delega la operación al Runtime generado por Funimas.';

/**
 * Explica por qué se realizó una transformación.
 */
export class TransformationReason {
  static forOperation(operation: SemanticOperationType, callee?: string): string {
    if (operation === 'DATABASE_INSERT' && callee === 'addDoc') {
      return DATABASE_INSERT_REASON;
    }

    return `La operación ${operation} fue transformada para delegar la lógica en el runtime generado por Funimas.`;
  }
}

export { DATABASE_INSERT_REASON };
