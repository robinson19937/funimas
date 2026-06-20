#!/usr/bin/env node
/**
 * Smoke test del workspace protegido (_funimas):
 * assets estáticos, emuladores Firebase y API /api/* vía runtime.
 *
 * Uso:
 *   node scripts/smoke-test-protected-workspace.mjs ./mi-proyecto_funimas
 */
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const execFileAsync = promisify(execFile);
const workspace = process.argv[2];

if (!workspace) {
  console.error('Uso: node scripts/smoke-test-protected-workspace.mjs <workspace_funimas>');
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-funimas-smoke';
const firestorePort = Number(process.env.FUNIMAS_FIRESTORE_EMULATOR_PORT ?? 18280);
const authPort = Number(process.env.FUNIMAS_AUTH_EMULATOR_PORT ?? 19099);
const staticPort = Number(process.env.FUNIMAS_STATIC_PORT ?? 18765);

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✔ ${name}${detail ? `: ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? `: ${detail}` : ''}`);
}

async function waitForEmulatorReady(getLog, timeoutMs = 120000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (getLog().includes('All emulators ready')) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}

function startFirebaseEmulators(workspacePath) {
  return spawn(
    'npx',
    ['-y', 'firebase-tools@latest', 'emulators:start', '--only', 'firestore,auth', '--project', projectId],
    {
      cwd: workspacePath,
      env: {
        ...process.env,
        FIRESTORE_EMULATOR_HOST: `127.0.0.1:${firestorePort}`,
        FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${authPort}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

async function patchFirebaseJson(workspacePath) {
  const configPath = join(workspacePath, 'firebase.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.emulators = {
    ...(config.emulators ?? {}),
    auth: { port: authPort },
    firestore: { port: firestorePort },
    ui: { enabled: false },
  };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

async function signUpTestUser() {
  const response = await fetch(
    `http://127.0.0.1:${authPort}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `funimas-smoke-${Date.now()}@test.local`,
        password: 'testpass123456',
        returnSecureToken: true,
      }),
    },
  );
  const payload = await response.json();

  if (!response.ok || !payload.idToken) {
    throw new Error(`Auth emulator signUp failed: ${JSON.stringify(payload)}`);
  }

  return {
    uid: payload.localId,
    idToken: payload.idToken,
    email: payload.email,
  };
}

async function invokeHandler(body, headers = {}) {
  const script = `
    import { createHandler } from '../runtime/handler.ts';

    async function main() {
      const handler = createHandler();
      const response = await handler.handle({
        path: ${JSON.stringify(body.path)},
        method: ${JSON.stringify(body.method)},
        body: ${JSON.stringify(body.payload)},
        headers: ${JSON.stringify(headers)},
      });
      console.log(JSON.stringify(response));
    }

    main().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  `.trim();

  const tmpPath = join(workspace, '.funimas', 'smoke-invoke.ts');
  await mkdir(dirname(tmpPath), { recursive: true });
  await writeFile(tmpPath, script, 'utf8');

  const { stdout, stderr } = await execFileAsync('npx', ['-y', 'tsx', tmpPath], {
    cwd: workspace,
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (stderr && !stdout.trim()) {
    throw new Error(stderr);
  }

  return JSON.parse(stdout.trim());
}

async function testStaticAssets() {
  const files = [
    'login.html',
    'index.html',
    'js/firebase.js',
    'sdk/index.js',
    'runtime/router.ts',
    'runtime/domain/mutations.ts',
  ];

  for (const file of files) {
    await access(join(workspace, file));
    pass(`Archivo presente: ${file}`);
  }

  const firebaseJs = await readFile(join(workspace, 'js/firebase.js'), 'utf8');
  if (!firebaseJs.includes('configureFunimas')) {
    fail('firebase.js integra SDK Funimas');
  } else {
    pass('firebase.js integra SDK Funimas');
  }

  const router = await readFile(join(workspace, 'runtime/router.ts'), 'utf8');
  if (!router.includes("path.startsWith('/api/clubs/') && path.endsWith('/read')")) {
    fail('runtime/router.ts evita colisión de /api/read con clubs');
  } else {
    pass('runtime/router.ts enruta /api/read sin colisión con clubs');
  }
}

async function testStaticServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${staticPort}`);
      const filePath = join(workspace, decodeURIComponent(url.pathname));
      const content = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });

  await new Promise((resolvePromise) => server.listen(staticPort, resolvePromise));

  try {
    const response = await fetch(`http://127.0.0.1:${staticPort}/login.html`);
    if (response.ok) {
      pass('Servidor estático sirve login.html');
    } else {
      fail('Servidor estático sirve login.html', `status ${response.status}`);
    }
  } finally {
    server.close();
  }
}

async function testApiWithoutAuth() {
  const response = await invokeHandler({
    path: '/api/read',
    method: 'POST',
    payload: { collection: 'cotizaciones', id: 'x' },
  });

  if (response.status === 401) {
    pass('API rechaza peticiones sin token', '401');
  } else {
    fail('API rechaza peticiones sin token', `status ${response.status}`);
  }
}

async function testApiWithAuth(idToken, uid) {
  const headers = { authorization: `Bearer ${idToken}` };

  const readEmpty = await invokeHandler(
    {
      path: '/api/read',
      method: 'POST',
      payload: { collection: 'cotizaciones', id: 'no-existe' },
    },
    headers,
  );

  if (readEmpty.status !== 200 || !readEmpty.body?.success) {
    fail('API /read autenticada', JSON.stringify(readEmpty.body));
    return;
  }

  pass('API /read autenticada responde 200');

  const insert = await invokeHandler(
    {
      path: '/api/insert',
      method: 'POST',
      payload: {
        collection: 'cotizaciones',
        data: { userId: uid, titulo: 'Smoke test', total: 100 },
      },
    },
    headers,
  );

  if (insert.status !== 200 || !insert.body?.data?.id) {
    fail('API /insert', JSON.stringify(insert.body));
    return;
  }

  const docId = insert.body.data.id;
  pass('API /insert crea documento', docId);

  const list = await invokeHandler(
    {
      path: '/api/list',
      method: 'POST',
      payload: {
        collection: 'cotizaciones',
        filters: [{ field: 'userId', operator: '==', value: uid }],
      },
    },
    headers,
  );

  const docs = list.body?.data ?? [];
  if (list.status === 200 && Array.isArray(docs) && docs.some((doc) => doc.id === docId)) {
    pass('API /list devuelve documento insertado');
  } else {
    fail('API /list', JSON.stringify(list.body));
  }
}

async function main() {
  console.log(`\nFunimas smoke test — ${workspace}\n`);

  process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${firestorePort}`;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${authPort}`;
  process.env.FIREBASE_PROJECT_ID = projectId;
  process.env.GCLOUD_PROJECT = projectId;

  const credsPath = join(workspace, '.funimas', 'smoke-sa.json');
  await mkdir(join(workspace, '.funimas'), { recursive: true });
  await writeFile(
    credsPath,
    JSON.stringify({ project_id: projectId, type: 'service_account' }),
    'utf8',
  );
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credsPath;
  delete process.env.FIREBASE_CLIENT_EMAIL;
  delete process.env.FIREBASE_PRIVATE_KEY;

  await patchFirebaseJson(workspace);
  await testStaticAssets();
  await testStaticServer();

  const logChunks = [];
  const logPath = join(workspace, '.funimas', 'smoke-emulators.log');
  const emulator = startFirebaseEmulators(workspace);

  emulator.stdout?.on('data', (chunk) => {
    logChunks.push(chunk.toString());
  });
  emulator.stderr?.on('data', (chunk) => {
    logChunks.push(chunk.toString());
  });

  const emulatorReady = await waitForEmulatorReady(() => logChunks.join(''), 120000);
  await writeFile(logPath, logChunks.join(''), 'utf8').catch(() => undefined);

  if (!emulatorReady) {
    emulator.kill('SIGTERM');
    fail('Emuladores Firebase arrancaron', logChunks.join('').slice(-400));
    printSummary();
    process.exit(1);
  }

  pass('Emuladores Firebase activos');

  try {
    await testApiWithoutAuth();
    const user = await signUpTestUser();
    pass('Auth emulator: usuario de prueba creado', user.email);
    await testApiWithAuth(user.idToken, user.uid);
  } catch (error) {
    fail('Pruebas API', error instanceof Error ? error.message : String(error));
  } finally {
    emulator.kill('SIGTERM');
  }

  printSummary();
  process.exit(results.some((result) => !result.ok) ? 1 : 0);
}

function printSummary() {
  const ok = results.filter((result) => result.ok).length;
  const total = results.length;
  console.log('\n═══════════════════════════════════════');
  console.log(`Resultado: ${ok}/${total} pruebas pasaron`);
  console.log('═══════════════════════════════════════\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
