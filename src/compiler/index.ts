/**
 * Motor del compilador Funimas.
 * Expone el pipeline oficial reutilizable por CLI y futuras interfaces gráficas.
 */
export {
  ProtectPipeline,
  ProjectValidator,
  ProjectFsError,
  type ProtectPipelineOptions,
  type ProtectPipelineResult,
  type ProjectValidationResult,
} from '../pipeline/index.js';
