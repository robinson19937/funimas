import type { SemanticOperationType } from '../semantic/SemanticOperationType.js';

const DATABASE_INSERT_BENEFITS = [
  'Menor exposición del backend.',
  'Centralización de la lógica.',
  'Mayor facilidad para aplicar validaciones.',
  'Mejor mantenibilidad.',
  'Preparado para auditoría y monitoreo.',
] as const;

/**
 * Describe las mejoras aportadas por una transformación.
 */
export class TransformationBenefit {
  static forOperation(operation: SemanticOperationType, callee?: string): string {
    if (operation === 'DATABASE_INSERT' && callee === 'addDoc') {
      return DATABASE_INSERT_BENEFITS.join(' ');
    }

    return 'Centralización de la lógica y mejor mantenibilidad del proyecto protegido.';
  }

  static listForOperation(operation: SemanticOperationType, callee?: string): string[] {
    if (operation === 'DATABASE_INSERT' && callee === 'addDoc') {
      return [...DATABASE_INSERT_BENEFITS];
    }

    return ['Centralización de la lógica.', 'Mejor mantenibilidad.'];
  }
}

export { DATABASE_INSERT_BENEFITS };
