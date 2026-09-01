import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions/v2";

export const REGION = "asia-east1";

// Global options must be applied before any module defines a callable. Every
// callable module imports this one (directly or through ./callable), so setting
// them here keeps region and limits consistent no matter which file declares a
// function.
setGlobalOptions({
  region: REGION,
  maxInstances: 20,
  timeoutSeconds: 60,
  memory: "256MiB",
});

initializeApp();

export const auth = getAuth();
export const db = getFirestore();

db.settings({ ignoreUndefinedProperties: true });
