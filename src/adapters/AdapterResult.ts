import type { GeneratedFile } from './GeneratedFile.js';

export interface AdapterDetectionResult {
  detected: boolean;
  marker?: string;
  foundAt?: string;
  searchedPaths?: string[];
  reason?: string;
}

export interface AdapterRuntimeArtifact {
  files: GeneratedFile[];
  metadata: Record<string, unknown>;
}

export interface AdapterFunctionArtifact {
  files: GeneratedFile[];
  functions: string[];
  metadata: Record<string, unknown>;
}

export interface AdapterConfigurationArtifact {
  files: string[];
  metadata: Record<string, unknown>;
}

export interface AdapterEnvironmentArtifact {
  variables: string[];
  metadata: Record<string, unknown>;
}

export interface AdapterValidationArtifact {
  valid: boolean;
  issues: string[];
}

export interface AdapterResult<T> {
  success: boolean;
  data: T;
  metadata?: Record<string, unknown>;
}

export function createEmptyAdapterResult<T>(data: T): AdapterResult<T> {
  return {
    success: true,
    data,
    metadata: {},
  };
}

export function createEmptyRuntimeArtifact(): AdapterRuntimeArtifact {
  return {
    files: [],
    metadata: {},
  };
}

export function createEmptyFunctionArtifact(): AdapterFunctionArtifact {
  return {
    files: [],
    functions: [],
    metadata: {},
  };
}

export function createEmptyConfigurationArtifact(): AdapterConfigurationArtifact {
  return {
    files: [],
    metadata: {},
  };
}

export function createEmptyEnvironmentArtifact(): AdapterEnvironmentArtifact {
  return {
    variables: [],
    metadata: {},
  };
}

export function createEmptyValidationArtifact(): AdapterValidationArtifact {
  return {
    valid: true,
    issues: [],
  };
}
