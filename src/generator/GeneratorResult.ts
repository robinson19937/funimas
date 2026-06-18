import type { WrittenFile } from './GeneratorFileWriter.js';

export interface GeneratorResultData {
  files: WrittenFile[];
  runtimeGenerated: boolean;
  sdkGenerated: boolean;
  functionFileNames: string[];
  startedAt: Date;
  finishedAt: Date;
}

export class GeneratorResult {
  readonly files: WrittenFile[];
  readonly runtimeGenerated: boolean;
  readonly sdkGenerated: boolean;
  readonly functionFileNames: string[];
  readonly startedAt: Date;
  readonly finishedAt: Date;

  constructor(data: GeneratorResultData) {
    this.files = data.files;
    this.runtimeGenerated = data.runtimeGenerated;
    this.sdkGenerated = data.sdkGenerated;
    this.functionFileNames = data.functionFileNames;
    this.startedAt = data.startedAt;
    this.finishedAt = data.finishedAt;
  }

  get totalFiles(): number {
    return this.files.length;
  }

  static empty(now: () => Date = () => new Date()): GeneratorResult {
    const timestamp = now();

    return new GeneratorResult({
      files: [],
      runtimeGenerated: false,
      sdkGenerated: false,
      functionFileNames: [],
      startedAt: timestamp,
      finishedAt: timestamp,
    });
  }

  static merge(results: GeneratorResult[]): GeneratorResult {
    if (results.length === 0) {
      return GeneratorResult.empty();
    }

    const startedAt = results.reduce(
      (earliest, result) => (result.startedAt < earliest ? result.startedAt : earliest),
      results[0]!.startedAt,
    );
    const finishedAt = results.reduce(
      (latest, result) => (result.finishedAt > latest ? result.finishedAt : latest),
      results[0]!.finishedAt,
    );

    return new GeneratorResult({
      files: results.flatMap((result) => result.files),
      runtimeGenerated: results.some((result) => result.runtimeGenerated),
      sdkGenerated: results.some((result) => result.sdkGenerated),
      functionFileNames: results.flatMap((result) => result.functionFileNames),
      startedAt,
      finishedAt,
    });
  }
}
