export interface OutputWriter {
  writeln(message?: string): void;
}

export class ConsoleOutputWriter implements OutputWriter {
  writeln(message = ''): void {
    console.log(message);
  }
}

export class NullOutputWriter implements OutputWriter {
  writeln(_message = ''): void {
    // Sin salida: útil para ejecutar motores de forma silenciosa.
  }
}
