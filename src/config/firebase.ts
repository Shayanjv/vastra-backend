import admin from "firebase-admin";
import environment from "./environment";
import logger from "../utils/logger.util";

interface FirebaseServiceAccountConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

const getFirebaseServiceAccountConfig = (): FirebaseServiceAccountConfig => {
  // Detailed startup logging for debugging
  console.log("=== Firebase Configuration Startup ===");
  console.log(
    "FIREBASE_PROJECT_ID:",
    process.env["FIREBASE_PROJECT_ID"] ? "SET ✓" : "MISSING ✗"
  );
  console.log(
    "FIREBASE_CLIENT_EMAIL:",
    process.env["FIREBASE_CLIENT_EMAIL"] ? "SET ✓" : "MISSING ✗"
  );
  console.log(
    "FIREBASE_PRIVATE_KEY:",
    process.env["FIREBASE_PRIVATE_KEY"] ? "SET ✓" : "MISSING ✗"
  );
  console.log("=====================================");

  const projectId = environment.FIREBASE_PROJECT_ID.trim();
  const clientEmail = environment.FIREBASE_CLIENT_EMAIL.trim();

  // Parse private key: handle escaped newlines and quote characters
  let privateKey = process.env["FIREBASE_PRIVATE_KEY"] ?? environment.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    // Remove surrounding quotes if present
    privateKey = privateKey
      .replace(/^"|"$/g, "")
      .replace(/^'|'$/g, "")
      // Replace escaped newlines with actual newlines
      .replace(/\\n/g, "\n")
      // Trim whitespace
      .trim();
  }

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
    console.log("✓ Firebase Admin already initialized. Reusing existing app.");
    logger.info("Firebase Admin already initialized. Reusing existing app.");
    return admin.app();
  }

  try {
    console.log("🔧 Attempting Firebase Admin initialization...");
    const serviceAccountConfig = getFirebaseServiceAccountConfig();

    console.log("✓ Firebase config loaded:");
    console.log(
      `  projectId: ${serviceAccountConfig.projectId}`
    );
    console.log(
      `  clientEmail: ${serviceAccountConfig.clientEmail}`
    );
    console.log(
      `  privateKey length: ${serviceAccountConfig.privateKey.length} bytes`
    );

    const firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: serviceAccountConfig.projectId,
        clientEmail: serviceAccountConfig.clientEmail,
        privateKey: serviceAccountConfig.privateKey
      })
    });

    console.log("✅ Firebase Admin initialized successfully!");
    logger.info("Firebase Admin initialized successfully.", {
      endpoint: "startup",
      firebaseAppName: firebaseApp.name
    });

    return firebaseApp;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown firebase error";
    const errorStack = error instanceof Error ? error.stack : "";

    console.error("❌ Firebase initialization failed!");
    console.error("Error:", errorMessage);
    console.error("Stack:", errorStack);

    logger.error("Firebase initialization failed.", {
      error: errorMessage,
      stack: errorStack
    });

    throw new Error(`Firebase startup failed: ${errorMessage}`);
  }
};

const firebaseApp = initializeFirebase();

export { firebaseApp };
export default admin;
