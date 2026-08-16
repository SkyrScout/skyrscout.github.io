import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-functions.js";
import {
  firebaseConfig,
  staffBackendConfig
} from "./staff-firebase-config.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const functions = getFunctions(app, staffBackendConfig.functionsRegion);
const controlRoomFeed = httpsCallable(
  functions,
  staffBackendConfig.controlRoomFunction,
  { timeout: 20000 }
);

async function fetchHeseFredrik(mode = "debug") {
  const response = await controlRoomFeed({
    feed: "hese-fredrik",
    mode: mode === "public" ? "public" : "debug"
  });

  const data = response?.data || {};
  if (!data.payload || data.payload.ok === false) {
    throw new Error("INVALID_HESE_FREDRIK_PAYLOAD");
  }

  return data.payload;
}

window.SkyrScoutStaffBackend = Object.freeze({
  fetchHeseFredrik
});
