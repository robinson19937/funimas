import { describe, expect, it } from 'vitest';

import { ProtectCommand } from '../src/cli/commands/protect-command.js';
import type { OutputWriter } from '../src/utils/output.js';

class MockOutputWriter implements OutputWriter {
  readonly lines: string[] = [];

  writeln(message = ''): void {
    this.lines.push(message);
  }
}

describe('ProtectCommand', () => {
  it('muestra la versión, la ruta del proyecto y el mensaje de inicialización', async () => {
    const output = new MockOutputWriter();
    const command = new ProtectCommand({
      projectPath: './mi-proyecto',
      output,
    });

    await command.execute();

    expect(output.lines).toEqual([
      'Funimas v0.1.0',
      '',
      'Proyecto:',
      expect.stringContaining('mi-proyecto'),
      '',
      'Inicializando...',
    ]);
  });
});
