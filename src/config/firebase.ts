import admin from "firebase-admin";
import environment from "./environment";
import logger from "../utils/logger.util";

interface FirebaseServiceAccountConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

const getFirebaseServiceAccountConfig = (): FirebaseServiceAccountConfig => {
  const projectId = environment.FIREBASE_PROJECT_ID.trim();
  const clientEmail = environment.FIREBASE_CLIENT_EMAIL.trim();
  const privateKey = (process.env["FIREBASE_PRIVATE_KEY"] ?? environment.FIREBASE_PRIVATE_KEY)
    .replace(/\\n/g, "\n")
    .trim();

  const missingVariables: string[] = [];

  if (!projectId) {
    missingVariables.push("FIREBASE_PROJECT_ID");
  }

  if (!clientEmail) {
    missingVariables.push("FIREBASE_CLIENT_EMAIL");
  }

  if (!privateKey) {
    missingVariables.push("FIREBASE_PRIVATE_KEY");
  }

  if (missingVariables.length > 0) {
    logger.error("Firebase startup configuration validation failed.", {
      missingVariables
    });

    throw new Error(`Missing Firebase configuration: ${missingVariables.join(", ")}`);
  }

  return {
    projectId,
    clientEmail,
    privateKey
  };
};

const initializeFirebase = (): admin.app.App => {
  if (admin.apps.length > 0) {
    logger.info("Firebase Admin already initialized. Reusing existing app.");
    return admin.app();
  }

  try {
    const serviceAccountConfig = getFirebaseServiceAccountConfig();
    const firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: serviceAccountConfig.projectId,
        clientEmail: serviceAccountConfig.clientEmail,
        privateKey: serviceAccountConfig.privateKey
      })
    });

    logger.info("Firebase Admin initialized successfully.", {
      endpoint: "startup",
      firebaseAppName: firebaseApp.name
    });

    return firebaseApp;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown firebase error";

    logger.error("Firebase initialization failed.", {
      error: errorMessage
    });

    throw new Error(`Firebase startup failed: ${errorMessage}`);
  }
};

const firebaseApp = initializeFirebase();

export { firebaseApp };
export default admin;
