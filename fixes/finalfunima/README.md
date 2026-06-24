# Corrección para robinson19937/finalfunima

Comparación entre `micrsoft.copia` (original funcional) y `finalfunima` (versión Funimas rota).

## Problemas encontrados

1. **Migración incompleta de Firestore** — `companySettings.js` seguía usando `getDoc`/`setDoc`/`updateDoc` directo para suscripciones, bloqueado por las reglas restrictivas de Funimas.
2. **`dbHelpers.js` sin migrar** — Seguía accediendo a Firestore desde el cliente.
3. **`saveCompanySettings` sobrescribía datos** — Usaba `setAtPath` (reemplazo total) en lugar de `updateAtPath` (merge parcial).
4. **`setDocumentByPath` sin merge** — El backend hacía `.set()` sin `{ merge: true }`, incompatible con el comportamiento original de `setDoc(..., { merge: true })`.
5. **Reglas Firestore demasiado restrictivas** — Bloqueaban todo el acceso cliente (`if false`) sin que todas las operaciones estuvieran migradas al API de Netlify.

## Archivos corregidos

- `js/companySettings.js`
- `js/dbHelpers.js`
- `js/auth.js`
- `firestore.rules` (restauradas desde `micrsoft.copia`)
- `runtime/repositories/firestoreRepository.ts`
- `types/firebase-admin.d.ts`

## Aplicar en finalfunima

```bash
git clone https://github.com/robinson19937/finalfunima.git
cd finalfunima
git apply /ruta/a/patches/finalfunima-fix/0001-fix-completar-migraci-n-Funimas-y-restaurar-reglas-F.patch
```

O copiar los archivos de `fixes/finalfunima/` sobre el repo.

## Requisitos de despliegue

La versión Funimas requiere **Netlify** con las variables de entorno de Firebase Admin:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Y el redirect `/api/*` → `/.netlify/functions/funimas/:splat` definido en `netlify.toml`.
