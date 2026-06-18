export function renderDatabaseClient(): string {
  return `export class DatabaseClient {
  insert(_collection: string, _data: unknown): void {
    // Placeholder for future HTTP implementation
  }
}
`;
}
