# Auditoria Funimas: escrituras Firestore y alta multiempresa

## Diagnostico

- El repositorio no contiene `js/auth.js`; el flujo concreto de registro de la app productiva no esta presente en esta rama.
- La causa raiz reproducible en Funimas estaba en la reescritura: `setDoc(..., { merge: true })` se convertia en `Funimas.database.update*`.
- En el runtime, `update*` termina en una operacion Firestore `update`, que falla si el documento no existe.
- El SDK no diferenciaba con suficiente claridad entre crear, reemplazar/upsert y actualizar documentos existentes.

## Semantica reforzada

- `insert(collection, data)`: crea un documento con ID automatico.
- `createDocument*`: crea con ID conocido y falla si el documento ya existe.
- `set*`: reemplaza el documento completo y puede crearlo si no existe.
- `upsertDocument*`: crea o mezcla campos con `merge`; es el helper recomendado para datos iniciales reintentables.
- `updateExistingDocument*` y los aliases historicos `update*`: solo actualizan documentos existentes.

Si se intenta actualizar un documento inexistente, el backend responde con:

> No se puede actualizar un documento inexistente. Usa set/upsert para creacion inicial.

## Reglas y pruebas

- `firestore.rules` modela `users/{uid}`, `companies/{companyId}`, `companies/{companyId}/settings/main` y las colecciones `cotizaciones`, `recibos`, `notas`, `varios`.
- Las reglas validan owner, `companyId`, `userId` y bloquean secuestro de empresas existentes.
- `tests/firestore-security-rules.test.ts` se ejecuta contra el emulador cuando `FIRESTORE_EMULATOR_HOST` esta presente.
- `tests/funimas-sdk-client.test.ts` cubre el cliente Funimas con mocks de `fetch`.
- `tests/runtime-write-semantics.test.ts` verifica que las plantillas mantengan endpoints separados para `create`, `set`, `upsert` y `update`.

## Verificacion esperada

```bash
npm run build
npx -y firebase-tools@latest emulators:exec --only firestore,storage "npm test"
```
