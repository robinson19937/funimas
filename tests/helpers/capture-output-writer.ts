import type { OutputWriter } from '../src/utils/output.js';

export class CaptureOutputWriter implements OutputWriter {
  readonly lines: string[] = [];

  writeln(message = ''): void {
    this.lines.push(message);
  }
}
