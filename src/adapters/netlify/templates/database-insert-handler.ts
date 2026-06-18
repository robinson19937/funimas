export function renderNetlifyDatabaseInsertHandler(): string {
  return `export async function handler(event: any) {
  return {
    statusCode: 200,
    body: 'Funimas Runtime',
  };
}
`;
}
