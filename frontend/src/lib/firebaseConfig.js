function readFirebaseConfig(env = {}) {
  return {
    apiKey: env.REACT_APP_FIREBASE_API_KEY || '',
    authDomain: env.REACT_APP_FIREBASE_AUTH_DOMAIN || '',
    projectId: env.REACT_APP_FIREBASE_PROJECT_ID || '',
    appId: env.REACT_APP_FIREBASE_APP_ID || '',
    messagingSenderId: env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '',
    storageBucket: env.REACT_APP_FIREBASE_STORAGE_BUCKET || '',
  };
}

function firebaseConfigured(config) {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

export { firebaseConfigured, readFirebaseConfig };
