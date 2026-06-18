import { addDoc, collection } from 'firebase/firestore';

import { db } from './firebase.js';

export async function createCliente(cliente: { nombre: string }): Promise<void> {
  await addDoc(collection(db, 'clientes'), cliente);
}

export async function createClientesDemo(): Promise<void> {
  await addDoc(collection(db, 'clientes'), { nombre: 'Juan' });
}

export async function createClienteVIP(cliente: { nombre: string }): Promise<void> {
  await addDoc(collection(db, 'clientes'), { ...cliente, vip: true });
}
