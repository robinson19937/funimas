export const auth = { currentUser: null };
export const db = {};

export function doc() {
  return {};
}

export function getDoc() {
  return Promise.resolve({ exists: () => false, data: () => ({}) });
}

export function setDoc() {
  return Promise.resolve();
}

export function serverTimestamp() {
  return { __funimasFirestoreSentinel: 'serverTimestamp' };
}
