import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { isExcludedEntry } from '../utils/project-fs.js';

const SCRIPT_SRC_PATTERN = /<script\b([^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*)>\s*<\/script>/gi;

function isModuleScript(attributes: string): boolean {
  return /\btype\s*=\s*["']module["']/i.test(attributes);
}

function hasNonModuleType(attributes: string): boolean {
  return /\btype\s*=\s*["'](?!module)[^"']+["']/i.test(attributes);
}

function usesTopLevelEsm(content: string): boolean {
  return /^\s*(?:import\s|export\s)/m.test(content);
}

function addModuleType(attributes: string): string {
  const trimmed = attributes.trim();

  if (isModuleScript(trimmed)) {
    return trimmed;
  }

  if (hasNonModuleType(trimmed)) {
    return trimmed;
  }

  return trimmed.length > 0 ? `${trimmed} type="module"` : 'type="module"';
}

function scriptExtension(src: string): string {
  const pathWithoutQuery = src.split('?')[0] ?? src;
  const dotIndex = pathWithoutQuery.lastIndexOf('.');

  return dotIndex >= 0 ? pathWithoutQuery.slice(dotIndex) : '';
}

/**
 * Promotes external script tags to `type="module"` when the referenced file uses ESM syntax.
 */
export class HtmlModuleScriptUpgrader {
  async upgrade(workspacePath: string): Promise<string[]> {
    const modified: string[] = [];
    await this.walk(workspacePath, workspacePath, modified);
    return modified;
  }

  private async walk(rootDir: string, currentDir: string, modified: string[]): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (isExcludedEntry(entry.name)) {
        continue;
      }

      const entryPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await this.walk(rootDir, entryPath, modified);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith('.html')) {
        continue;
      }

      if (await this.upgradeHtmlFile(rootDir, entryPath)) {
        modified.push(entryPath);
      }
    }
  }

  private async upgradeHtmlFile(_rootDir: string, htmlPath: string): Promise<boolean> {
    const html = await readFile(htmlPath, 'utf8');
    const htmlDir = dirname(htmlPath);
    let changed = false;

    const replacements: Array<{ fullMatch: string; attributes: string; src: string }> = [];

    for (const match of html.matchAll(SCRIPT_SRC_PATTERN)) {
      const fullMatch = match[0];
      const attributes = match[1] ?? '';
      const src = match[2] ?? '';

      if (isModuleScript(attributes) || hasNonModuleType(attributes)) {
        continue;
      }

      if (!['.js', '.mjs'].includes(scriptExtension(src))) {
        continue;
      }

      replacements.push({ fullMatch, attributes, src });
    }

    let result = html;

    for (const replacement of replacements) {
      const scriptPath = resolve(htmlDir, replacement.src.split('?')[0] ?? replacement.src);

      let scriptContent = '';

      try {
        scriptContent = await readFile(scriptPath, 'utf8');
      } catch {
        continue;
      }

      if (!usesTopLevelEsm(scriptContent)) {
        continue;
      }

      const nextAttributes = addModuleType(replacement.attributes);
      const nextTag = `<script ${nextAttributes}></script>`;
      result = result.replace(replacement.fullMatch, nextTag);
      changed = true;
    }

    if (changed) {
      await writeFile(htmlPath, result, 'utf8');
    }

    return changed;
  }
}
