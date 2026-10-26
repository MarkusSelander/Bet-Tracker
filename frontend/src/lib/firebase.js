import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { firebaseConfigured, readFirebaseConfig } from './firebaseConfig';

let authInstance = null;

function isFirebaseReady() {
  return firebaseConfigured(readFirebaseConfig(process.env));
}

function getFirebaseAuth() {
  const config = readFirebaseConfig(process.env);
  if (!firebaseConfigured(config)) return null;
  if (!authInstance) {
    const app = getApps()[0] || initializeApp(config);
    authInstance = getAuth(app);
  }
  return authInstance;
}

export { getFirebaseAuth, isFirebaseReady };
