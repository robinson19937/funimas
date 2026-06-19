# Funimas

Herramienta de línea de comandos que protege proyectos con Firebase/Firestore. Analiza el código, crea una copia de trabajo segura y mueve el acceso a datos al servidor **sin tocar los archivos originales**.

Funciona con **cualquier repositorio** que cumpla los requisitos de abajo (React, Vite, Next, etc.). No está limitado a un solo proyecto.

## ¿Qué necesitas antes de empezar?

1. **Node.js** 20 o superior (`node --version`)
2. **Git**
3. Una **terminal**

## Instalación (solo la primera vez)

```bash
git clone https://github.com/robinson19937/funimas.git
cd funimas
npm install
npm run build
npm link
```

> Si `npm link` da error de permisos:
>
> ```bash
> node dist/cli/index.js protect ./ruta-de-tu-proyecto
> ```

## Uso básico

```bash
funimas protect ./ruta-de-tu-proyecto
```

**Ejemplos incluidos:**

```bash
funimas protect ./examples/react-firebase-crud
funimas protect ./examples/tenis-monorepo/tenis   # si apuntas al subproyecto con netlify.toml
```

### Qué hace Funimas

1. Crea **backup** en `<proyecto>/.funimas/backups/`
2. Genera el workspace **`<proyecto>_funimas/`** (aquí ocurren todos los cambios)
3. Analiza el código y aplica transformaciones automáticas
4. Escribe informes en `<proyecto>/.funimas/reports/`

**El proyecto original no se modifica.**

| Qué buscas | Dónde está |
| ---------- | ---------- |
| Proyecto listo para desplegar | `<proyecto>_funimas/` |
| Backup | `<proyecto>/.funimas/backups/` |
| Informe de cambios | `<proyecto>/.funimas/reports/summary.json` |

---

## Requisitos del proyecto a analizar

| Requisito | Obligatorio |
| --------- | ----------- |
| Código TypeScript o JavaScript | Sí |
| `netlify.toml` en la raíz | Sí (despliegue en Netlify) |
| Uso de Firebase/Firestore en el cliente | Sí |

### Qué transforma hoy (automático)

| Operación detectada | Qué hace Funimas |
| ------------------- | ---------------- |
| `addDoc()` | Reescribe a `Funimas.database.insert()` y enruta al servidor |

### Qué aún requiere migración manual en tu código

Si tu app usa estas APIs de Firestore en el cliente, **debes cambiarlas tú** al SDK (o dejar que Funimas las soporte en una versión futura):

- `getDoc` / `getDocs` → `Funimas.database.fetchClubDocument()` (o equivalente)
- `setDoc` / `updateDoc` / `runTransaction` → `Funimas.database.mutateClubDocument()` con acciones tipadas
- `onSnapshot` → `Funimas.database.pollClubDocument()` (polling en v1)

Ver el ejemplo completo en `examples/tenis-monorepo/tenis/src/lib/firestoreClub.ts`.

---

## Archivos que genera Funimas (nuevos)

En `<proyecto>_funimas/` se crean:

```
shared/                          # Lógica de negocio compartida (autorización, mutaciones)
runtime/
  handler.ts                     # Punto de entrada del servidor
  router.ts                        # Rutas HTTP /api/*
  middleware/authMiddleware.ts     # Verificación de Firebase ID token
  middleware/authorization.ts    # Reglas de negocio
  controllers/clubsController.ts
  repositories/firestoreRepository.ts  # Firebase Admin SDK (Firestore real)
sdk/
  index.ts                         # export const Funimas / configureFunimas
  database/DatabaseClient.ts       # Cliente HTTP con Bearer token
netlify/functions/
  funimas.ts                       # Handler principal (/api/clubs/*, /api/insert)
  database_insert.ts               # Compatibilidad con rewrites addDoc()
src/types/netlify.d.ts             # (o types/netlify.d.ts)
src/types/firebase-admin.d.ts      # Stubs para validación TypeScript
```

También actualiza en el workspace:

- `tsconfig.json` — paths `@funimas/sdk`, `@funimas/shared`
- `package.json` — añade `@netlify/functions`, `firebase-admin`, `@types/node`

## Archivos que modifica Funimas (en el workspace)

Solo los archivos de tu app donde detecta operaciones transformables. Hoy:

- Archivos con `addDoc(...)` → sustituidos por `Funimas.database.insert(...)` + import de `@funimas/sdk`

El resto de tu código **no se toca**. Revisa siempre `.funimas/reports/changes.md` después de `protect`.

---

## Despliegue: qué es automático y qué es manual

**No basta con subir a GitHub.** Después de `funimas protect` hay pasos manuales obligatorios.

### Checklist de despliegue

#### 1. Trabajar en el workspace (manual)

```bash
cd <proyecto>_funimas
npm install
```

#### 2. Variables de entorno (manual — obligatorio)

**En Netlify** (Site settings → Environment variables). **Nunca** en el cliente:

| Variable | Dónde | Descripción |
| -------- | ----- | ----------- |
| `FIREBASE_PROJECT_ID` | Servidor | ID del proyecto Firebase |
| `FIREBASE_CLIENT_EMAIL` | Servidor | Email del service account |
| `FIREBASE_PRIVATE_KEY` | Servidor | Clave privada (con `\n` escapados) |

**En el cliente** (`.env` / variables de build):

| Variable | Descripción |
| -------- | ----------- |
| `VITE_FIREBASE_API_KEY` | Config Firebase Auth (cliente) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Dominio Auth |
| `VITE_FIREBASE_PROJECT_ID` | Mismo project ID |
| `VITE_FUNIMAS_API_URL` | `/api` en producción (por defecto) |

Plantilla: `examples/tenis-monorepo/tenis/.env.example`

#### 3. `netlify.toml` (manual si no existe el redirect)

Funimas genera las functions, pero tu `netlify.toml` debe exponer la API. Añade si falta:

```toml
[build]
  functions = "netlify/functions"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/funimas/:splat"
  status = 200

[functions]
  node_bundler = "esbuild"
  external_node_modules = ["firebase-admin"]
```

#### 4. Reglas de Firestore (manual — obligatorio para seguridad)

Bloquea escrituras directas desde el navegador. Solo el backend (Admin SDK) debe escribir.

Ejemplo en `examples/tenis-monorepo/tenis/firestore.rules`:

```
allow read: if request.auth != null;
allow create, update, delete: if false;   # en colecciones protegidas
```

Despliega las reglas:

```bash
firebase deploy --only firestore:rules
```

#### 5. Migrar código Firestore restante (manual si aplica)

Si tu app aún usa `getDoc`, `setDoc`, `runTransaction` u `onSnapshot` para datos de club, migra a `@funimas/sdk` como en el ejemplo `firestoreClub.ts`.

#### 6. Desplegar (manual)

```bash
cd <proyecto>_funimas
npm run build          # según tu proyecto
netlify deploy --prod
```

O conecta el repo del workspace a Netlify (build + functions automáticos en cada push, **pero las variables de entorno y las reglas Firestore siguen siendo manuales**).

---

## Flujo de datos después de proteger

```
React (cliente)
  → Firebase Auth (signIn, getIdToken)     ← sigue en el cliente
  → @funimas/sdk (Authorization: Bearer)
  → Netlify Function funimas.ts
  → runtime/ + Firebase Admin SDK
  → Firestore
```

---

## Scripts de desarrollo (repo Funimas)

| Script  | Descripción |
| ------- | ----------- |
| `dev`   | CLI en modo desarrollo |
| `build` | Compila TypeScript |
| `test`  | Pruebas (Vitest) |
| `lint`  | ESLint |

## Estructura del repo Funimas (herramienta CLI)

```
src/           Código de la CLI y pipeline
templates/     Plantillas del runtime, SDK y functions
examples/      Proyectos de referencia (react-firebase-crud, tenis-monorepo)
tests/         Pruebas unitarias
```

## Licencia

MIT
