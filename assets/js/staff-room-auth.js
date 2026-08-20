import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  doc,
  getDoc,
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {
  firebaseConfig,
  staffAccessConfig
} from "./staff-firebase-config.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const gate = document.getElementById("staffRoomAuthGate");
const gateText = document.getElementById("staffRoomAuthGateText");
const room = document.getElementById("staffProtectedRoom");
const identityTargets = document.querySelectorAll("[data-staff-identity]");
const roleTargets = document.querySelectorAll("[data-staff-role]");
const signOutTargets = document.querySelectorAll("[data-staff-signout]");

function entranceUrl() {
  const next = window.location.pathname + window.location.search + window.location.hash;
  return `${staffAccessConfig.entrancePath}?next=${encodeURIComponent(next)}`;
}

function redirectToEntrance() {
  window.location.replace(entranceUrl());
}

function setGateError(message) {
  if (gate) gate.dataset.state = "error";
  if (gateText) gateText.textContent = message;
}

function waitForInitialAuthState() {
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve(user || null);
      },
      (error) => {
        unsubscribe();
        reject(error);
      }
    );
  });
}

async function boot() {
  try {
    // Wait for Firebase to restore the persisted Google session before deciding
    // whether the visitor is signed out. This avoids redirect loops on page load.
    const user = await waitForInitialAuthState();

    if (!user) {
      redirectToEntrance();
      return;
    }

    const email = String(user.email || "").trim().toLowerCase();

    if (!email || user.emailVerified !== true) {
      redirectToEntrance();
      return;
    }

    const staffRef = doc(db, staffAccessConfig.allowlistCollection, email);
    const staffSnapshot = await getDoc(staffRef);
    const profile = staffSnapshot.exists() ? (staffSnapshot.data() || {}) : null;

    if (!profile || profile.active !== true) {
      redirectToEntrance();
      return;
    }

    const scoutName =
      profile.scout_name ||
      profile.scoutName ||
      user.displayName ||
      "SkyrScout Staff";
    const role = profile.role || "Staff";

    identityTargets.forEach((target) => {
      target.textContent = scoutName;
    });

    roleTargets.forEach((target) => {
      target.textContent = role;
    });

    if (room) room.hidden = false;
    if (gate) gate.hidden = true;

    window.SkyrScoutStaffAuthorized = true;
    window.dispatchEvent(new CustomEvent("staffroom:authorized"));
  } catch (error) {
    console.error("Scoutland Yard room auth:", error);
    setGateError("Could not verify SkyrScout staff access.");
  }
}

signOutTargets.forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } finally {
      window.location.replace(staffAccessConfig.entrancePath);
    }
  });
});

boot();
