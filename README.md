# Funimas

**Funimas** es una CLI que protege aplicaciones web con **Firebase/Firestore**. Analiza tu código, genera un workspace listo para producción y mueve el acceso a datos del navegador al servidor — **sin modificar tu proyecto original**.

```text
Cliente (Auth en Firebase)  →  @funimas/sdk  →  Netlify Functions  →  Admin SDK  →  Firestore
```

---

## Tabla de contenidos

1. [¿Qué es Funimas?](#qué-es-funimas)
2. [¿Por qué existe?](#por-qué-existe)
3. [¿Para quién es?](#para-quién-es)
4. [Requisitos](#requisitos)
5. [Instalación](#instalación)
6. [Inicio rápido](#inicio-rápido)
7. [Comandos](#comandos)
8. [Flujo completo: de protect a producción](#flujo-completo-de-protect-a-producción)
9. [Qué genera y qué modifica](#qué-genera-y-qué-modifica)
10. [APIs soportadas](#apis-soportadas)
11. [Variables de entorno](#variables-de-entorno)
12. [Despliegue](#despliegue)
13. [Proyectos PWA / JavaScript plano](#proyectos-pwa--javascript-plano)
14. [Ejemplos incluidos](#ejemplos-incluidos)
15. [Desarrollo del repo Funimas](#desarrollo-del-repo-funimas)
16. [Licencia](#licencia)

---

## ¿Qué es Funimas?

Funimas es una herramienta de línea de comandos que:

1. **Analiza** tu proyecto (TypeScript, JavaScript, scripts inline en HTML).
2. **Detecta** operaciones de Firestore en el cliente.
3. **Reescribe** el código hacia el SDK `@funimas/sdk`.
4. **Genera** backend (Netlify Functions + runtime), reglas de Firestore y configuración de despliegue.
5. **Valida** el workspace resultante (TypeScript, imports, estructura).
6. **Opcionalmente despliega** reglas Firestore y el sitio en Netlify.

Todo el trabajo ocurre en una copia de trabajo:

```text
mi-proyecto/           ← no se modifica (solo backup + reportes)
mi-proyecto_funimas/   ← workspace protegido, listo para desplegar
```

---

## ¿Por qué existe?

En muchas apps Firebase, el cliente lee y escribe Firestore directamente. Eso implica:

| Problema | Consecuencia |
| -------- | ------------ |
| Reglas de seguridad complejas en el cliente | Difíciles de auditar y mantener |
| Lógica de negocio expuesta en el navegador | Cualquiera puede inspeccionar el código |
| Credenciales y permisos amplios en el cliente | Mayor superficie de ataque |
| Migración manual a backend | Lenta, propensa a errores y regresiones |

Funimas automatiza esa migración: el cliente solo usa **Firebase Auth**; el acceso a Firestore pasa por un **backend con Admin SDK** y reglas estrictas.

---

## ¿Para quién es?

### Desarrolladores

- Tienes una app React, Vite, Next.js o una **PWA en JavaScript plano** con Firestore en el cliente.
- Quieres mover datos al servidor sin reescribir el proyecto a mano.
- Despliegas (o planeas desplegar) en **Netlify** con Functions.

### Empresas y equipos

- Necesitan **auditoría y control** sobre quién accede a qué datos.
- Buscan un camino incremental: el repo original sigue intacto; el workspace `_funimas` es el artefacto de producción.
- Quieren reportes antes/después (`changes.html`, `validation.html`) para revisar el impacto.

---

## Requisitos

### Para usar Funimas (CLI)

| Herramienta | Versión | Obligatorio |
| ----------- | ------- | ----------- |
| Node.js | ≥ 20 | Sí |
| Git | cualquiera reciente | Sí |

Firebase CLI y Netlify CLI **no** hace falta instalarlas globalmente: `funimas deploy` usa `npx` automáticamente.

### Para el proyecto que quieres proteger

| Requisito | Obligatorio |
| --------- | ----------- |
| Código TypeScript o JavaScript | Sí |
| Uso de Firebase/Firestore en el cliente | Sí |
| `netlify.toml` en la raíz (o en el paquete del monorepo) | Sí, para despliegue en Netlify |

---

## Instalación

```bash
git clone https://github.com/robinson19937/funimas.git
cd funimas
npm install
npm run build
npm link
```

Verifica que funciona:

```bash
funimas setup
```

> **Sin permisos para `npm link`:** usa la ruta directa al binario:
>
> ```bash
> node dist/cli/index.js protect ./ruta-de-tu-proyecto
> ```

---

## Inicio rápido

```bash
# 1. Revisar qué se puede migrar automáticamente
funimas status ./mi-proyecto

# 2. Generar el workspace protegido
funimas protect ./mi-proyecto

# 3. Preparar credenciales
cd mi-proyecto_funimas
cp .env.example .env
# Edita .env con tu service account de Firebase

npm install

# 4. Verificar antes de desplegar
funimas deploy . --check

# 5. Desplegar (reglas Firestore + sitio Netlify)
funimas deploy . --import-env --prod
```

---

## Comandos

### Resumen

| Comando | Descripción |
| ------- | ----------- |
| `funimas setup` | Verifica Node, Git y CLIs opcionales |
| `funimas status [ruta]` | APIs Firestore listas vs pendientes (sin crear workspace) |
| `funimas protect <ruta>` | Analiza, transforma y genera `<ruta>_funimas/` |
| `funimas deploy [workspace]` | Despliega reglas Firestore y sitio Netlify |

### `funimas status`

Analiza el código **sin crear el workspace**:

```bash
funimas status ./mi-proyecto
```

Muestra:

- Operaciones Firestore con reescritura automática (`getDoc`, `addDoc`, etc.)
- APIs no soportadas (`runTransaction`, `writeBatch`, …)
- Operaciones de Firebase Storage (sin transformación automática hoy)
- Firebase Auth (se mantiene en el cliente)

### `funimas protect`

```bash
funimas protect ./mi-proyecto
funimas protect ./mi-proyecto --force   # sobrescribe mi-proyecto_funimas si ya existe
```

Al finalizar, revisa los reportes:

```text
mi-proyecto/.funimas/reports/changes.html      # diff antes/después
mi-proyecto/.funimas/reports/validation.html   # resultado de validación
mi-proyecto/.funimas/reports/summary.json      # métricas
```

### `funimas deploy`

```bash
funimas deploy ./mi-proyecto_funimas --check
funimas deploy ./mi-proyecto_funimas --import-env --prod
funimas deploy ./mi-proyecto_funimas --dry-run --prod
```

| Opción | Descripción |
| ------ | ----------- |
| `--prod` | Despliegue a producción en Netlify |
| `--import-env` | Importa variables desde `.env` a Netlify (`netlify env:import`) |
| `--check` | Valida workspace y `.env` sin desplegar |
| `--dry-run` | Muestra los comandos sin ejecutarlos |
| `--skip-firestore` | Omite `firebase deploy --only firestore:rules` |
| `--skip-netlify` | Omite `netlify deploy` |

---

## Flujo completo: de protect a producción

```mermaid
flowchart TD
    A[Proyecto original] --> B[funimas status]
    B --> C[funimas protect]
    C --> D[Workspace _funimas]
    D --> E[cp .env.example .env]
    E --> F[npm install]
    F --> G[funimas deploy --check]
    G --> H{¿Listo?}
    H -->|Sí| I[funimas deploy --import-env --prod]
    H -->|No| J[Corregir .env / config]
    J --> G
    I --> K[Firestore rules + Netlify site]
```

### Paso a paso detallado

**1. Proteger el proyecto**

```bash
funimas protect ./mi-proyecto --force
```

**2. Entrar al workspace**

```bash
cd mi-proyecto_funimas
```

**3. Configurar variables de entorno**

```bash
cp .env.example .env
```

Edita `.env` (ver [Variables de entorno](#variables-de-entorno)).

**4. Instalar dependencias del workspace**

```bash
npm install
```

**5. Autenticación CLI (primera vez, en local)**

```bash
npx firebase-tools@latest login
npx netlify-cli@latest login
npx netlify-cli@latest link    # vincular al sitio Netlify existente
```

**6. Verificar**

```bash
funimas deploy . --check
```

**7. Desplegar**

```bash
funimas deploy . --import-env --prod
```

Esto ejecuta internamente:

```bash
npx firebase-tools@latest deploy --only firestore:rules --project <FIREBASE_PROJECT_ID>
npx netlify-cli@latest env:import .env
npx netlify-cli@latest deploy --prod
```

---

## Qué genera y qué modifica

### El proyecto original no se toca

| Artefacto | Ubicación |
| --------- | --------- |
| Backup | `mi-proyecto/.funimas/backups/` |
| Reportes | `mi-proyecto/.funimas/reports/` |
| Workspace de producción | `mi-proyecto_funimas/` |

### Archivos nuevos en el workspace

```text
mi-proyecto_funimas/
├── netlify/
│   └── functions/
│       ├── funimas.ts              # API principal (/api/*)
│       └── database_insert.ts      # Compatibilidad insert
├── runtime/
│   ├── handler.ts
│   ├── router.ts
│   ├── middleware/authMiddleware.ts
│   └── repositories/firestoreRepository.ts
├── sdk/
│   ├── index.ts                    # Funimas / configureFunimas
│   └── database/DatabaseClient.ts
├── shared/                         # Lógica compartida
├── firestore.rules                 # Reglas estrictas por colección
├── firebase.json
├── funimas.config.json             # Colecciones permitidas
├── .env.example
└── netlify.toml                    # Redirect /api/* + functions
```

### Archivos que Funimas puede modificar

Solo los archivos donde detecta operaciones transformables, por ejemplo:

```javascript
// Antes
import { addDoc, collection, db } from './firebase.js';
await addDoc(collection(db, 'clientes'), { nombre: 'Ana' });

// Después
import { Funimas } from '@funimas/sdk';
await Funimas.database.insert('clientes', { nombre: 'Ana' });
```

También procesa **scripts `<script type="module">` inline en HTML**, los reescribe y los fusiona de vuelta en el HTML.

---

## APIs soportadas

### Firestore — reescritura automática

| API cliente | SDK Funimas |
| ----------- | ----------- |
| `addDoc(collection, data)` | `Funimas.database.insert(collection, data)` |
| `setDoc(doc(...), data)` | `Funimas.database.set(collection, id, data)` |
| `updateDoc(doc(...), data)` | `Funimas.database.update(collection, id, data)` |
| `deleteDoc(doc(...))` | `Funimas.database.delete(collection, id)` |
| `getDoc(doc(...))` | `Funimas.database.get(collection, id)` |
| `getDocs(collection(...))` | `Funimas.database.list(collection)` |
| `getDocs(query(..., where(...)))` | `Funimas.database.listWhere(collection, field, op, value)` |
| Paths con subcolecciones | `getAtPath`, `setAtPath`, `updateAtPath`, `deleteAtPath` |
| `deleteDoc(snap.ref)` tras `Funimas.database.get` | `Funimas.database.delete(...)` |
| `onSnapshot(doc(...))` | `Funimas.database.poll(collection, id, callback)` |
| `onSnapshot(collection(...))` | `Funimas.database.pollCollection(collection, callback)` |

### Firebase Auth — sin cambios

Login, registro y `getIdToken()` **siguen en el cliente**. El SDK envía el token como `Authorization: Bearer <token>` al backend.

### Aún sin transformación automática

| API | Recomendación |
| --- | ------------- |
| `runTransaction` | Migrar a mutaciones del SDK o lógica en el servidor |
| `writeBatch` | Reemplazar por operaciones individuales del SDK |
| Firebase Storage (`uploadBytes`, `getDownloadURL`, …) | Migración manual o futura versión de Funimas |
| `setDoc` con `{ merge: true }` vía refs dinámicas | Revisar caso a caso |

Usa `funimas status` para ver el inventario exacto de tu proyecto.

---

## Variables de entorno

Copia la plantilla:

```bash
cd mi-proyecto_funimas
cp .env.example .env
```

### Servidor (obligatorias — Netlify Functions)

```env
FIREBASE_PROJECT_ID=tu-proyecto-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@tu-proyecto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Obtén estas credenciales en **Firebase Console → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada**.

### Cliente (recomendadas — proyectos Vite/React)

```env
VITE_FIREBASE_API_KEY=tu-api-key
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto-id
VITE_FUNIMAS_API_URL=/api
```

En PWAs con config Firebase hardcodeada en `firebase.js`, las variables `VITE_*` pueden no ser necesarias en el cliente.

### CI / GitHub Actions

```bash
export FIREBASE_TOKEN=...
export NETLIFY_AUTH_TOKEN=...
funimas deploy ./mi-proyecto_funimas --import-env --prod
```

---

## Despliegue

### Qué es automático

| Acción | Quién lo hace |
| ------ | ------------- |
| Generar `netlify.toml`, reglas, functions, SDK | `funimas protect` |
| Validar workspace y `.env` | `funimas deploy --check` |
| Desplegar reglas Firestore | `funimas deploy` |
| Importar env a Netlify | `funimas deploy --import-env` |
| Desplegar sitio + functions | `funimas deploy --prod` |

### Qué es manual (una vez)

| Acción | Cómo |
| ------ | ---- |
| Crear proyecto Firebase | Firebase Console |
| Crear sitio Netlify | Netlify Dashboard |
| Service account + `.env` | Firebase Console → clave privada |
| `firebase login` / `netlify login` | Primera vez en local |
| `netlify link` | Vincular workspace al sitio |

### Estrategias de publicación

**Opción A — CLI directa (recomendada para empezar)**

```bash
cd mi-proyecto_funimas
funimas deploy . --import-env --prod
```

**Opción B — Repo dedicado**

Sube solo el contenido de `mi-proyecto_funimas/` a un repositorio y conéctalo en Netlify.

**Opción C — Rama dedicada**

```bash
funimas protect ./mi-proyecto --force
git checkout -b funimas-prod
git add mi-proyecto_funimas/
git commit -m "chore: workspace Funimas"
```

Configura Netlify para publicar esa rama y directorio.

### Reglas de Firestore generadas

Funimas bloquea el acceso directo del cliente por colección detectada:

```javascript
match /cotizaciones/{documentId} {
  allow read, create, update, delete: if false;
}
```

> **Importante:** despliega las reglas estrictas solo cuando el cliente ya use `@funimas/sdk` correctamente. Si despliegas reglas antes de que el SDK funcione en el navegador, la app dejará de acceder a Firestore.

### Orden seguro recomendado

```bash
# 1. Preview primero (sin --prod)
funimas deploy . --import-env

# 2. Probar login + una operación CRUD en la URL de preview

# 3. Producción
funimas deploy . --import-env --prod
```

---

## Proyectos PWA / JavaScript plano

En apps **sin bundler** (imports ES modules directos en el navegador), Funimas reescribe el código pero el navegador **no resuelve** `@funimas/sdk` solo. Necesitas dos pasos adicionales:

### 1. Import map en tu HTML principal

```html
<script type="importmap">
{
  "imports": {
    "@funimas/sdk": "/sdk/index.ts"
  }
}
</script>
```

> En producción puedes apuntar a archivos `.js` compilados si añades un paso de build del SDK.

### 2. Conectar Firebase Auth al SDK

El SDK requiere el token del usuario autenticado. Crea un bootstrap (por ejemplo en `js/funimas.js`):

```javascript
import { configureFunimas } from '@funimas/sdk';
import { auth } from './firebase.js';

export const Funimas = configureFunimas({
  getIdToken: () => auth.currentUser?.getIdToken() ?? Promise.resolve(null),
});
```

Y en el resto de módulos importa desde ahí:

```javascript
import { Funimas } from '../js/funimas.js';
```

En proyectos **Vite / React / Next**, el bundler resuelve `@funimas/sdk` automáticamente vía `tsconfig` paths.

---

## Ejemplos incluidos

```bash
# React + Firebase CRUD
funimas protect ./examples/react-firebase-crud

# Monorepo con lógica de dominio (clubs/ladder)
funimas protect ./examples/tenis-monorepo/tenis
```

---

## Desarrollo del repo Funimas

```bash
npm run dev      # CLI en modo desarrollo
npm run build    # Compilar TypeScript
npm test         # Vitest (143+ tests)
npm run lint     # ESLint
```

### Estructura del repositorio

```text
src/
  cli/           setup, status, protect, deploy
  pipeline/      Orquestación de protect
  rewriter/      Reglas de transformación AST
  generator/     Runtime, SDK, reglas, .env
  deploy/        Firebase + Netlify CLI
templates/       Plantillas Handlebars
examples/        Proyectos de referencia
tests/           Pruebas unitarias e integración
```

---

## Licencia

MIT
