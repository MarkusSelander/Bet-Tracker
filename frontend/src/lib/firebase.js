import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { firebaseConfigured, readFirebaseConfig } from './firebaseConfig';

let authInstance = null;

function firebaseEnv() {
  // CRA bytter ut hvert process.env.REACT_APP_*-uttrykk i bygget. Et samlet
  // process.env-objekt blir stående tomt i nettleseren.
  return readFirebaseConfig({
    REACT_APP_FIREBASE_API_KEY: process.env.REACT_APP_FIREBASE_API_KEY,
    REACT_APP_FIREBASE_AUTH_DOMAIN: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    REACT_APP_FIREBASE_PROJECT_ID: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    REACT_APP_FIREBASE_APP_ID: process.env.REACT_APP_FIREBASE_APP_ID,
    REACT_APP_FIREBASE_MESSAGING_SENDER_ID: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    REACT_APP_FIREBASE_STORAGE_BUCKET: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  });
}

function isFirebaseReady() {
  return firebaseConfigured(firebaseEnv());
}

function getFirebaseAuth() {
  const config = firebaseEnv();
  if (!firebaseConfigured(config)) return null;
  if (!authInstance) {
    const app = getApps()[0] || initializeApp(config);
    authInstance = getAuth(app);
  }
  return authInstance;
}

export { getFirebaseAuth, isFirebaseReady };
