const BET_TRACKER_FIREBASE = {
  apiKey: 'AIzaSyCgezna3RSSGqdBBr1BUWNFXzQOOA6Ba54',
  authDomain: 'bettracker-f5d99.firebaseapp.com',
  projectId: 'bettracker-f5d99',
  storageBucket: 'bettracker-f5d99.firebasestorage.app',
  messagingSenderId: '680779615178',
  appId: '1:680779615178:web:33b02e5794fc3219dadd33',
};

function readFirebaseConfig(env = {}) {
  return {
    apiKey: env.REACT_APP_FIREBASE_API_KEY || BET_TRACKER_FIREBASE.apiKey,
    authDomain: env.REACT_APP_FIREBASE_AUTH_DOMAIN || BET_TRACKER_FIREBASE.authDomain,
    projectId: env.REACT_APP_FIREBASE_PROJECT_ID || BET_TRACKER_FIREBASE.projectId,
    appId: env.REACT_APP_FIREBASE_APP_ID || BET_TRACKER_FIREBASE.appId,
    messagingSenderId: env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || BET_TRACKER_FIREBASE.messagingSenderId,
    storageBucket: env.REACT_APP_FIREBASE_STORAGE_BUCKET || BET_TRACKER_FIREBASE.storageBucket,
  };
}

function firebaseConfigured(config) {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

export { BET_TRACKER_FIREBASE, firebaseConfigured, readFirebaseConfig };
