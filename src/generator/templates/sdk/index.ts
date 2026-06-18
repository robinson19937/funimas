export function renderSdkIndex(): string {
  return `import { DatabaseClient } from './database/DatabaseClient.js';

const database = new DatabaseClient();

export const Funimas = {
  database,
};

export { DatabaseClient } from './database/DatabaseClient.js';
`;
}
