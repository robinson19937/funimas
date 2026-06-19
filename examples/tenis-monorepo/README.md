# Tenis Monorepo — Integración Funimas

Referencia de la arquitectura objetivo:

```
React (tenis/) → @funimas/sdk → Netlify Function (funimas.ts) → runtime/ → Firebase Admin → Firestore
```

## Estructura

| Carpeta | Rol |
| ------- | --- |
| `tenis/` | App React + Vite. Usa Firebase Auth en cliente; datos de club vía SDK |
| `sdk/` | `DatabaseClient` HTTP con token Bearer |
| `runtime/` | Router HTTP, auth middleware, autorización, Firestore Admin |
| `shared/` | Tipos, `ladderMutations`, `challengeAuth` compartidos |
| `netlify/functions/funimas.ts` | Handler Netlify que expone `/api/*` |

## API (v1)

- `POST /api/clubs` — crear club
- `POST /api/clubs/:clubId/read` — leer documento
- `POST /api/clubs/:clubId/mutate` — mutación tipada (`CREATE_CHALLENGE`, etc.)
- `POST /api/insert` — compatibilidad con rewrites `addDoc()`

Suscripción en v1: polling vía `pollClubDocument()` (no `onSnapshot`).

## Variables de entorno

Ver `tenis/.env.example`. El service account (`FIREBASE_*`) solo en servidor.

## Desarrollo local

```bash
npm install
npm run dev
# En otra terminal: netlify dev (con functions)
```

## Reglas Firestore

`tenis/firestore.rules` bloquea escrituras directas desde el cliente; solo el backend escribe.
