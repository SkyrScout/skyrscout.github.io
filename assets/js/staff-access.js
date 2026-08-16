import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  doc,
  getDoc,
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {
  firebaseConfig,
  firebaseIsConfigured,
  staffAccessConfig
} from "./staff-firebase-config.js";

let servicesPromise = null;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function getServices() {
  if (!firebaseIsConfigured()) {
    throw new Error("STAFF_FIREBASE_NOT_CONFIGURED");
  }

  if (!servicesPromise) {
    servicesPromise = (async () => {
      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const db = getFirestore(app);
      await setPersistence(auth, browserLocalPersistence);
      return { app, auth, db };
    })();
  }

  return servicesPromise;
}

function firstAuthState(auth) {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      (error) => {
        unsubscribe();
        reject(error);
      }
    );
  });
}

async function readStaffProfile(db, user) {
  const email = normalizeEmail(user?.email);
  if (!email || user?.emailVerified !== true) {
    return null;
  }

  try {
    const snapshot = await getDoc(
      doc(db, staffAccessConfig.allowlistCollection, email)
    );

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data() || {};
    if (data.active !== true) {
      return null;
    }

    return {
      email,
      scoutName: String(data.scout_name || data.scoutName || "SkyrScout Staff"),
      role: String(data.role || "Staff")
    };
  } catch (error) {
    if (error?.code === "permission-denied") {
      return null;
    }
    throw error;
  }
}

export async function getAuthorizedStaffSession() {
  try {
    const { auth, db } = await getServices();
    const user = await firstAuthState(auth);

    if (!user) {
      return { status: "signed-out", user: null, profile: null };
    }

    const profile = await readStaffProfile(db, user);
    if (!profile) {
      return { status: "denied", user, profile: null };
    }

    return { status: "authorized", user, profile };
  } catch (error) {
    if (error?.message === "STAFF_FIREBASE_NOT_CONFIGURED") {
      return { status: "not-configured", user: null, profile: null, error };
    }
    return { status: "error", user: null, profile: null, error };
  }
}

export async function signInApprovedGoogleAccount() {
  const { auth, db } = await getServices();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  const result = await signInWithPopup(auth, provider);
  const profile = await readStaffProfile(db, result.user);

  if (!profile) {
    await signOut(auth);
    return { status: "denied", user: result.user, profile: null };
  }

  return { status: "authorized", user: result.user, profile };
}

export async function signOutStaff() {
  try {
    const { auth } = await getServices();
    await signOut(auth);
  } catch (error) {
    if (error?.message !== "STAFF_FIREBASE_NOT_CONFIGURED") {
      throw error;
    }
  }
}

export function safeStaffTarget(rawTarget) {
  const fallback = staffAccessConfig.defaultTarget;
  if (!rawTarget) return fallback;

  try {
    const url = new URL(rawTarget, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    if (!url.pathname.startsWith("/control-room/")) return fallback;
    return url.pathname + url.search + url.hash;
  } catch (error) {
    return fallback;
  }
}

export { staffAccessConfig };
