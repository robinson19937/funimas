export interface OutputWriter {
  writeln(message?: string): void;
}

export class ConsoleOutputWriter implements OutputWriter {
  writeln(message = ''): void {
    console.log(message);
  }
}
