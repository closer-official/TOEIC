/**
 * Firebase Admin（サーバー専用）。Firestore の users/{accountId} で紹介者コードを検証する。
 * 環境変数: FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON（JSON文字列）または FIREBASE_SERVICE_ACCOUNT_JSON_BASE64
 */

import type { Firestore } from 'firebase-admin/firestore';

let firestoreInstance: Firestore | null = null;

function getServiceAccount(): object | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      return JSON.parse(raw) as object;
    } catch {
      return null;
    }
  }
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
  if (base64) {
    try {
      const decoded = Buffer.from(base64, 'base64').toString('utf8');
      return JSON.parse(decoded) as object;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Firestore インスタンスを返す。未設定時は null。
 */
export function getFirestore(): Firestore | null {
  if (firestoreInstance !== null) return firestoreInstance;
  const projectId = process.env.FIREBASE_PROJECT_ID ?? 'Closer-official';
  const cred = getServiceAccount();
  if (!cred) return null;
  try {
    const { getApps, initializeApp, cert } = require('firebase-admin/app');
    const { getFirestore: getFs } = require('firebase-admin/firestore');
    if (getApps().length === 0) {
      initializeApp({
        projectId,
        credential: cert(cred as { project_id?: string; client_email?: string; private_key?: string }),
      });
    }
    firestoreInstance = getFs() as Firestore;
    return firestoreInstance;
  } catch {
    return null;
  }
}

/** Firestore の users コレクション内に documentId === code のドキュメントが存在するか */
export async function isValidReferrerCode(code: string): Promise<boolean> {
  const trimmed = (code ?? '').trim();
  if (!trimmed) return false;
  const db = getFirestore();
  if (!db) return false;
  try {
    const ref = db.collection('users').doc(trimmed);
    const snap = await ref.get();
    return snap.exists;
  } catch {
    return false;
  }
}
