export function renderDatabaseClient(): string {
  return `export class DatabaseClient {
  async insert(_collection: string, _data: unknown): Promise<void> {
    // Placeholder for future HTTP implementation
  }
}
`;
}
