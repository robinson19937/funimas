import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';

import type { ClubDocument } from '@funimas/shared';

import { auth } from './lib/firebase.js';
import {
  createClubDocument,
  fetchClubDocument,
  mutateFromAppState,
  subscribeClubDocument,
} from './lib/firestoreClub.js';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [club, setClub] = useState<ClubDocument | null>(null);
  const [clubId, setClubId] = useState('demo-club');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !clubId) return;
    return subscribeClubDocument(clubId, setClub);
  }, [user, clubId]);

  async function handleSignIn() {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, 'demo@example.com', 'password123');
    } catch {
      await createUserWithEmailAndPassword(auth, 'demo@example.com', 'password123');
    }
  }

  async function handleCreateClub() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      await createClubDocument(clubId, { name: 'Club Demo', pin: '1234' }, user.uid);
      setClub(await fetchClubDocument(clubId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear el club.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      await mutateFromAppState(clubId, 'REGISTER_PLAYER', {
        displayName: user.email ?? 'Jugador',
        pin: '1234',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al registrarse.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 720 }}>
      <h1>Escalera de Tenis</h1>
      <p>Datos del club vía Funimas SDK → runtime servidor → Firestore Admin.</p>

      {!user ? (
        <button type="button" onClick={() => void handleSignIn()}>
          Iniciar sesión demo
        </button>
      ) : (
        <>
          <p>Sesión: {user.email}</p>
          <button type="button" onClick={() => void signOut(auth)}>
            Cerrar sesión
          </button>
        </>
      )}

      <section style={{ marginTop: 24 }}>
        <label>
          Club ID{' '}
          <input value={clubId} onChange={(e) => setClubId(e.target.value)} />
        </label>
      </section>

      <section style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button type="button" disabled={!user || loading} onClick={() => void handleCreateClub()}>
          Crear club
        </button>
        <button type="button" disabled={!user || loading} onClick={() => void handleRegister()}>
          Registrarme en el club
        </button>
      </section>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {club && (
        <pre style={{ background: '#f4f4f4', padding: 16, marginTop: 24 }}>
          {JSON.stringify(club, null, 2)}
        </pre>
      )}
    </main>
  );
}
