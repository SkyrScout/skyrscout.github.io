/*
 * Scoutland Yard Staff Entrance — Firebase web configuration.
 *
 * Firebase's web config object contains project identifiers, not a server secret.
 * Replace the placeholder values with the exact config shown by Firebase Console
 * for the Scoutland Yard web app. Do not put service-account keys or API secrets here.
 */
export const firebaseConfig = Object.freeze({
  apiKey: "REPLACE_WITH_FIREBASE_API_KEY",
  authDomain: "REPLACE_WITH_PROJECT_ID.firebaseapp.com",
  projectId: "REPLACE_WITH_PROJECT_ID",
  storageBucket: "REPLACE_WITH_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "REPLACE_WITH_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_FIREBASE_APP_ID"
});

export const staffAccessConfig = Object.freeze({
  allowlistCollection: "staff_allowlist",
  entrancePath: "/staff/",
  defaultTarget: "/control-room/"
});

export function firebaseIsConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId &&
    !Object.values(firebaseConfig).some((value) => String(value).startsWith("REPLACE_WITH_"))
  );
}
