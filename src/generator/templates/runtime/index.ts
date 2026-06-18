export const RUNTIME_VERSION = '0.1.0';

export function renderRuntimeIndex(): string {
  return `export const RUNTIME_VERSION = '${RUNTIME_VERSION}';

export function createRuntime() {
  return {
    name: 'funimas-runtime',
    version: RUNTIME_VERSION,
  };
}
`;
}
