import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

/**
 * Firebase's web configuration is public by design. Environment values make it
 * possible to use another Firebase project when deploying, while the defaults
 * keep this client aligned with lib/firebase_options.dart.
 */
function readEnv(name, fallback) {
  const value = import.meta.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export const firebaseConfig = Object.freeze({
  apiKey: readEnv('VITE_FIREBASE_API_KEY', 'AIzaSyBcaPoiBrJHz93Slc4cB2GTxPIC6CHGNg4'),
  appId: readEnv('VITE_FIREBASE_APP_ID', '1:137996768190:web:cd1fac57120eb5fe00dfef'),
  messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '137996768190'),
  projectId: readEnv('VITE_FIREBASE_PROJECT_ID', 'pet-care-app-dd27b'),
  authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN', 'pet-care-app-dd27b.firebaseapp.com'),
  storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET', 'pet-care-app-dd27b.firebasestorage.app'),
  measurementId: readEnv('VITE_FIREBASE_MEASUREMENT_ID', 'G-WZYZVB9BG2'),
});

// Vite hot reload may evaluate this module more than once, so reuse the app.
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
