import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';

import { isExcludedEntry } from '../utils/project-fs.js';

const INLINE_SCRIPT_PATTERN = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const INLINE_SCRIPT_SUFFIX = '.funimas-inline';
const MANIFEST_FILE = 'html-script-manifest.json';

export function isFunimasInlineScriptPath(filePath: string): boolean {
  return basename(filePath).includes(`${INLINE_SCRIPT_SUFFIX}.`);
}

export function buildFunimasInlineScriptPath(htmlRelativePath: string, scriptIndex: number): string {
  const htmlDir = dirname(htmlRelativePath);
  const htmlBase = basename(htmlRelativePath, '.html');
  const extractedFileName = `${htmlBase}${INLINE_SCRIPT_SUFFIX}.${scriptIndex}.js`;

  return htmlDir === '.' ? extractedFileName : join(htmlDir, extractedFileName);
}

export interface HtmlScriptEntry {
  htmlPath: string;
  scriptIndex: number;
  extractedPath: string;
  startOffset: number;
  endOffset: number;
  openTagLength: number;
}

export interface HtmlScriptManifest {
  entries: HtmlScriptEntry[];
}

function isInlineModuleScript(attributes: string): boolean {
  if (/\bsrc\s*=/.test(attributes)) {
    return false;
  }

  if (/\btype\s*=\s*["'](?!module)[^"']+["']/i.test(attributes)) {
    return false;
  }

  return true;
}

export class HtmlScriptExtractor {
  async extract(projectPath: string): Promise<HtmlScriptManifest> {
    const manifest: HtmlScriptManifest = { entries: [] };

    await mkdir(join(projectPath, '.funimas'), { recursive: true });
    await this.walkHtmlFiles(projectPath, projectPath, manifest);
    await writeFile(
      join(projectPath, '.funimas', MANIFEST_FILE),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );

    return manifest;
  }

  async merge(projectPath: string): Promise<number> {
    const manifestPath = join(projectPath, '.funimas', MANIFEST_FILE);

    let manifest: HtmlScriptManifest;

    try {
      manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as HtmlScriptManifest;
    } catch {
      return 0;
    }

    const grouped = new Map<string, HtmlScriptEntry[]>();

    for (const entry of manifest.entries) {
      const entries = grouped.get(entry.htmlPath) ?? [];
      entries.push(entry);
      grouped.set(entry.htmlPath, entries);
    }

    let mergedCount = 0;

    for (const [htmlPath, entries] of grouped) {
      const absoluteHtmlPath = join(projectPath, htmlPath);
      const html = await readFile(absoluteHtmlPath, 'utf8');
      const sorted = [...entries].sort((left, right) => right.startOffset - left.startOffset);
      let updated = html;

      for (const entry of sorted) {
        const scriptContent = await readFile(join(projectPath, entry.extractedPath), 'utf8');
        const before = updated.slice(0, entry.startOffset);
        const after = updated.slice(entry.endOffset);
        const openTag = updated.slice(entry.startOffset, entry.startOffset + entry.openTagLength);
        updated = `${before}${openTag}${scriptContent}</script>${after}`;
        mergedCount += 1;
      }

      await writeFile(absoluteHtmlPath, updated, 'utf8');
    }

    return mergedCount;
  }

  async cleanup(projectPath: string): Promise<number> {
    let removed = 0;

    const removeInlineScripts = async (currentDir: string): Promise<void> => {
      const entries = await readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (isExcludedEntry(entry.name)) {
          continue;
        }

        const entryPath = join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await removeInlineScripts(entryPath);
          continue;
        }

        if (entry.isFile() && isFunimasInlineScriptPath(entry.name)) {
          await unlink(entryPath);
          removed += 1;
        }
      }
    };

    await removeInlineScripts(projectPath);

    try {
      await unlink(join(projectPath, '.funimas', MANIFEST_FILE));
    } catch {
      // Sin manifiesto pendiente.
    }

    return removed;
  }

  private async walkHtmlFiles(
    rootDir: string,
    currentDir: string,
    manifest: HtmlScriptManifest,
  ): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (isExcludedEntry(entry.name)) {
        continue;
      }

      const entryPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await this.walkHtmlFiles(rootDir, entryPath, manifest);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith('.html')) {
        continue;
      }

      await this.extractFromHtml(rootDir, entryPath, manifest);
    }
  }

  private async extractFromHtml(
    rootDir: string,
    htmlPath: string,
    manifest: HtmlScriptManifest,
  ): Promise<void> {
    const html = await readFile(htmlPath, 'utf8');
    let scriptIndex = 0;

    for (const match of html.matchAll(INLINE_SCRIPT_PATTERN)) {
      const fullMatch = match[0];
      const attributes = match[1] ?? '';
      const scriptBody = match[2] ?? '';

      if (!isInlineModuleScript(attributes) || scriptBody.trim().length === 0) {
        continue;
      }

      const startOffset = match.index ?? 0;
      const openTagLength = fullMatch.indexOf('>') + 1;
      const endOffset = startOffset + fullMatch.length;
      const relativeHtmlPath = relative(rootDir, htmlPath);
      const extractedRelativePath = buildFunimasInlineScriptPath(relativeHtmlPath, scriptIndex);
      const extractedAbsolutePath = join(rootDir, extractedRelativePath);

      await mkdir(dirname(extractedAbsolutePath), { recursive: true });
      await writeFile(extractedAbsolutePath, scriptBody, 'utf8');

      manifest.entries.push({
        htmlPath: relativeHtmlPath,
        scriptIndex,
        extractedPath: extractedRelativePath,
        startOffset,
        endOffset,
        openTagLength,
      });

      scriptIndex += 1;
    }
  }
}

export function getExtractedScriptPaths(manifest: HtmlScriptManifest): string[] {
  return manifest.entries.map((entry) => entry.extractedPath);
}
