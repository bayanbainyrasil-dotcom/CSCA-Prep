import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { Functions } from 'firebase/functions';
import type { FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY;

export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (value) => typeof value === 'string' && value.length > 0,
) && (!import.meta.env.PROD || (typeof appCheckSiteKey === 'string' && appCheckSiteKey.length > 0));

export let firebaseApp: FirebaseApp | undefined;
export let auth: Auth | undefined;
export let firestore: Firestore | undefined;
export let storage: FirebaseStorage | undefined;
export let functions: Functions | undefined;

async function initializeFirebase(): Promise<void> {
  const [appModule, appCheckModule, authModule, firestoreModule, storageModule, functionsModule] = await Promise.all([
    import('firebase/app'),
    import('firebase/app-check'),
    import('firebase/auth'),
    import('firebase/firestore'),
    import('firebase/storage'),
    import('firebase/functions'),
  ]);

  firebaseApp = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(firebaseConfig);
  if (import.meta.env.PROD && appCheckSiteKey) {
    appCheckModule.initializeAppCheck(firebaseApp, {
      provider: new appCheckModule.ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  auth = authModule.getAuth(firebaseApp);
  firestore = firestoreModule.initializeFirestore(firebaseApp, {
    localCache: firestoreModule.persistentLocalCache({ tabManager: firestoreModule.persistentMultipleTabManager() }),
  });
  storage = storageModule.getStorage(firebaseApp);
  functions = functionsModule.getFunctions(firebaseApp, 'asia-east1');

  if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
    authModule.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    firestoreModule.connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
    storageModule.connectStorageEmulator(storage, '127.0.0.1', 9199);
    functionsModule.connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  }
}

/** Heavy Firebase SDK modules are loaded only when production configuration is present. */
export const firebaseReady: Promise<void> = isFirebaseConfigured ? initializeFirebase() : Promise.resolve();
