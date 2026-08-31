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

const libraryFeed = httpsCallable(
  functions,
  "libraryFeed",
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

async function fetchYouTubeCatalog() {
  const response = await controlRoomFeed({
    feed: "youtube-catalog"
  });

  const data = response?.data || {};
  if (data.ok !== true || !Array.isArray(data.catalog)) {
    throw new Error("INVALID_YOUTUBE_CATALOG_PAYLOAD");
  }

  return {
    catalog: data.catalog,
    meta: data.meta || {}
  };
}

async function fetchYouTubeAnalytics(videoId) {
  const cleanVideoId = String(videoId || "").trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(cleanVideoId)) {
    throw new Error("INVALID_YOUTUBE_VIDEO_ID");
  }

  const response = await controlRoomFeed({
    feed: "youtube-analytics",
    videoId: cleanVideoId
  });

  const data = response?.data || {};

  if (data.ok !== true || !data.payload || data.payload.videoId !== cleanVideoId) {
    throw new Error("INVALID_YOUTUBE_ANALYTICS_PAYLOAD");
  }

  return {
    payload: data.payload,
    meta: data.meta || {}
  };
}

async function fetchLibraryFolder(folderId = null) {
  const response = await libraryFeed({
    action: "list-folder",
    folderId: folderId || null
  });

  const data = response?.data || {};

  if (!data.payload || data.payload.ok !== true) {
    throw new Error(data?.payload?.error || "INVALID_LIBRARY_PAYLOAD");
  }

  return data.payload;
}

window.SkyrScoutStaffBackend = Object.freeze({
  fetchHeseFredrik,
  fetchYouTubeCatalog,
  fetchYouTubeAnalytics,
  fetchLibraryFolder
});
