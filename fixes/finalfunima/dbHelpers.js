import { Funimas } from "../sdk/index.js";

export async function deleteCompanyDoc(collectionName, id, companyId) {
  const snap = await Funimas.database.get(collectionName, id);
  if (!snap.exists() || snap.data()?.companyId !== companyId) {
    return { ok: false };
  }

  await Funimas.database.delete(collectionName, id);
  return { ok: true };
}
