const API_REDIRECT_FROM = '/api/*';
const API_REDIRECT_TO = '/.netlify/functions/funimas/:splat';
const FUNCTIONS_DIR = 'netlify/functions';

export interface NetlifyConfigPatchResult {
  content: string;
  patched: boolean;
  changes: string[];
}

/**
 * Asegura que netlify.toml exponga las Functions de Funimas y el bundler de firebase-admin.
 */
export function patchNetlifyToml(content: string): NetlifyConfigPatchResult {
  const changes: string[] = [];
  let result = content.trimEnd();

  if (!hasFunctionsDir(result)) {
    result = ensureBuildFunctionsDir(result);
    changes.push(`[build] functions = "${FUNCTIONS_DIR}"`);
  }

  if (!hasApiRedirect(result)) {
    result = appendApiRedirect(result);
    changes.push(`redirect /api/* → /.netlify/functions/funimas/:splat`);
  }

  if (!hasFunctionsBundlerConfig(result)) {
    result = appendFunctionsConfig(result);
    changes.push('[functions] node_bundler = "esbuild"');
    changes.push('[functions] external_node_modules = ["firebase-admin"]');
  }

  if (result !== content.trimEnd()) {
    result = `${result}\n`;
  }

  return {
    content: result,
    patched: changes.length > 0,
    changes,
  };
}

export function hasFunctionsDir(content: string): boolean {
  return /functions\s*=\s*["']netlify\/functions["']/m.test(content);
}

export function hasApiRedirect(content: string): boolean {
  return (
    content.includes(API_REDIRECT_FROM) &&
    content.includes('/.netlify/functions/funimas')
  );
}

export function hasFunctionsBundlerConfig(content: string): boolean {
  return (
    /\[functions\]/m.test(content) &&
    /node_bundler\s*=\s*["']esbuild["']/m.test(content) &&
    /external_node_modules\s*=\s*\[[^\]]*firebase-admin/m.test(content)
  );
}

function ensureBuildFunctionsDir(content: string): string {
  if (/\[build\]/m.test(content)) {
    if (/^\s*functions\s*=/m.test(content)) {
      return content;
    }

    return content.replace(
      /\[build\]\s*\n/,
      `[build]\n  functions = "${FUNCTIONS_DIR}"\n`,
    );
  }

  return `[build]\n  functions = "${FUNCTIONS_DIR}"\n  publish = "."\n\n${content}`;
}

function appendApiRedirect(content: string): string {
  const redirectBlock = [
    '[[redirects]]',
    `  from = "${API_REDIRECT_FROM}"`,
    `  to = "${API_REDIRECT_TO}"`,
    '  status = 200',
  ].join('\n');

  return content.length > 0 ? `${content}\n\n${redirectBlock}` : redirectBlock;
}

function appendFunctionsConfig(content: string): string {
  const functionsBlock = [
    '[functions]',
    '  node_bundler = "esbuild"',
    '  external_node_modules = ["firebase-admin"]',
  ].join('\n');

  return content.length > 0 ? `${content}\n\n${functionsBlock}` : functionsBlock;
}
