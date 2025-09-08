/**
 * Firebase Admin SDK initialization.
 *
 * Uses the service account file directly for reliable authentication.
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let initialized = false;

function initFirebase() {
  if (initialized) return admin;

  try {
    // First try to use the service account file directly
    const serviceAccountPath = path.join(__dirname, '../../../serviceAccount.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      console.log('🔧 Using service account file:', serviceAccountPath);
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
      console.log('✅ Firebase Admin SDK initialized with service account');
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Use full service account JSON provided via env var
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
      console.log('✅ Firebase Admin SDK initialized with env var');
    } else if (
      process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
    ) {
      // Support client email/private key env vars (escaped newlines restored)
      const projectId =
        process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
        projectId,
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Use Application Default Credentials from key file path
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId:
          process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
      });
    } else if (
      process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT
    ) {
      // As a minimum, set projectId and attempt ADC (works with local gcloud auth)
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId:
          process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
      });
    } else {
      // Fallback to ADC; may fail if no project/credentials are configured
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    }
    initialized = true;
  } catch (e) {
    // Last resort attempt default init to avoid crashing startup
    if (!initialized) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      initialized = true;
    }
  }

  return admin;
}

module.exports = initFirebase();
