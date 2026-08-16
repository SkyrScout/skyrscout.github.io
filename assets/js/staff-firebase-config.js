/*
 * Scoutland Yard Staff Entrance — Firebase web configuration.
 *
 * Firebase's web config object contains project identifiers, not a server secret.
 * Do not put service-account keys or API secrets here.
 */
export const firebaseConfig = Object.freeze({
  apiKey: "AIzaSyB7wUJ43HlV3q4ZhxdOKRU3KkQVVNB9JNM",
  authDomain: "scoutland-yard.firebaseapp.com",
  projectId: "scoutland-yard",
  storageBucket: "scoutland-yard.firebasestorage.app",
  messagingSenderId: "2416126710",
  appId: "1:2416126710:web:3775c10f0c1523c1675ad7"
});

export const staffAccessConfig = Object.freeze({
  allowlistCollection: "staff_allowlist",
  entrancePath: "/staff/",
  defaultTarget: "/control-room/"
});

export const staffBackendConfig = Object.freeze({
  functionsRegion: "europe-west1",
  controlRoomFunction: "controlRoomFeed"
});

export function firebaseIsConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId &&
    !Object.values(firebaseConfig).some((value) => String(value).startsWith("REPLACE_WITH_"))
  );
}
