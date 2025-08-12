/**
 * Firebase Admin SDK initialization.
 *
 * Reads credentials using Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS)
 * or environment variables. Falls back to projectId-only if running in a
 * trusted environment (e.g., Cloud Run) with implicit credentials.
 */
const admin = require('firebase-admin');

let initialized = false;

function initFirebase() {
  if (initialized) return admin;

  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // ADC path provided
      admin.initializeApp({});
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else if (process.env.FIREBASE_PROJECT_ID) {
      admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
    } else {
      // Try default initialization; may work in local envs with gcloud auth
      admin.initializeApp();
    }
    initialized = true;
  } catch (e) {
    // Last resort attempt default init to avoid crashing startup
    if (!initialized) {
      admin.initializeApp();
      initialized = true;
    }
  }

  return admin;
}

module.exports = initFirebase();
