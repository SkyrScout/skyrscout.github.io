"use strict";

const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2/options");

initializeApp();

setGlobalOptions({
  region: "europe-west1",
  maxInstances: 3
});

const db = getFirestore();
const HESE_FREDRIK_URL =
  "https://script.google.com/macros/s/AKfycbw5hZ4rk0e4OwClAtrH3-K9g4Z_XBu00a61Lx-aqdlv_KRXxZhJhR3WGFynE9W2WY5Z/exec";

function normalizedEmail(auth) {
  const email = String(auth?.token?.email || "").trim().toLowerCase();
  const verified = auth?.token?.email_verified === true;
  return verified ? email : "";
}

async function assertApprovedStaff(auth) {
  if (!auth) {
    throw new HttpsError("unauthenticated", "SkyrScout staff sign-in is required.");
  }

  const email = normalizedEmail(auth);
  if (!email) {
    throw new HttpsError("permission-denied", "A verified Google account is required.");
  }

  const snapshot = await db.collection("staff_allowlist").doc(email).get();
  if (!snapshot.exists || snapshot.data()?.active !== true) {
    throw new HttpsError("permission-denied", "This Google account is not approved for Scoutland Yard.");
  }

  return {
    email,
    scoutName: String(snapshot.data()?.scout_name || snapshot.data()?.scoutName || "SkyrScout Staff")
  };
}

async function fetchAppsScript(mode) {
  const url = new URL(HESE_FREDRIK_URL);
  if (mode === "debug") {
    url.searchParams.set("mode", "debug");
  }
  url.searchParams.set("_", String(Date.now()));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    // This request is made by Google Cloud, not by the user's browser.
    // It therefore carries none of the user's Google multi-login cookies and
    // cannot be rewritten to /macros/u/1/, /u/2/, etc.
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/json,text/plain;q=0.9,*/*;q=0.1"
      }
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Apps Script returned HTTP ${response.status}: ${text.slice(0, 160)}`);
    }

    let payload;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new Error(`Apps Script did not return JSON: ${text.slice(0, 160)}`);
    }

    if (!payload || payload.ok === false) {
      throw new Error("Apps Script returned an invalid Hese-Fredrik payload.");
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}


function parseStoredJson(value, fallback = null) {
  try {
    return JSON.parse(String(value || ""));
  } catch (error) {
    return fallback;
  }
}

async function fetchYouTubeAnalyticsVideo(videoId) {
  const cleanVideoId = String(videoId || "").trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(cleanVideoId)) {
    throw new HttpsError("invalid-argument", "A valid YouTube video ID is required.");
  }

  const metaSnapshot = await db.collection("control_room_analytics").doc("meta").get();
  if (!metaSnapshot.exists) {
    throw new HttpsError(
      "unavailable",
      "YouTube Analytics has not been published to Scoutland Yard yet."
    );
  }

  const meta = metaSnapshot.data() || {};
  const activeSlot = String(meta.activeSlot || "");
  const generation = String(meta.generation || "");

  if ((activeSlot !== "A" && activeSlot !== "B") || !generation) {
    throw new HttpsError(
      "unavailable",
      "The active YouTube Analytics generation is invalid."
    );
  }

  const activeVideoIds = parseStoredJson(meta.videoIdsJson, []);
  if (!Array.isArray(activeVideoIds) || !activeVideoIds.includes(cleanVideoId)) {
    throw new HttpsError(
      "not-found",
      "No current YouTube Analytics package exists for this video."
    );
  }

  const videoSnapshot = await db
    .collection("control_room_analytics_slots")
    .doc(activeSlot)
    .collection("videos")
    .doc(cleanVideoId)
    .get();

  if (!videoSnapshot.exists) {
    throw new HttpsError(
      "unavailable",
      "The current YouTube Analytics package is incomplete."
    );
  }

  const stored = videoSnapshot.data() || {};
  if (String(stored.generation || "") !== generation) {
    throw new HttpsError(
      "unavailable",
      "The selected YouTube Analytics package is from the wrong generation."
    );
  }

  const payload = parseStoredJson(stored.payloadJson, null);
  if (
    !payload ||
    typeof payload !== "object" ||
    String(payload.videoId || "") !== cleanVideoId
  ) {
    throw new HttpsError(
      "unavailable",
      "The selected YouTube Analytics package is invalid."
    );
  }

  return {
    payload,
    meta: {
      generation,
      activeSlot,
      generatedAt: meta.generatedAt || null,
      analyticsDataThrough: meta.analyticsDataThrough || null,
      reportingDataThrough: meta.reportingDataThrough || null,
      collectorVersion: meta.collectorVersion || null,
      videoCount: Number(meta.videoCount || 0) || 0,
      publishedAt: meta.publishedAt || null,
      committedAtMs: Number(meta.committedAtMs || 0) || null,
      likesCoverage: parseStoredJson(meta.likesCoverageJson, {}),
      health: parseStoredJson(meta.healthJson, {})
    }
  };
}

exports.controlRoomFeed = onCall(
  {
    timeoutSeconds: 20,
    memory: "256MiB"
  },
  async (request) => {
    await assertApprovedStaff(request.auth);

    const feed = String(request.data?.feed || "");

    if (feed === "youtube-analytics") {
      try {
        const result = await fetchYouTubeAnalyticsVideo(request.data?.videoId);
        return {
          ok: true,
          feed,
          payload: result.payload,
          meta: result.meta
        };
      } catch (error) {
        if (error instanceof HttpsError) {
          throw error;
        }
        console.error("controlRoomFeed YouTube Analytics fetch failed", error);
        throw new HttpsError(
          "unavailable",
          "YouTube Analytics could not be reached by the Staff backend."
        );
      }
    }

    if (feed !== "hese-fredrik") {
      throw new HttpsError("invalid-argument", "Unknown Control Room feed.");
    }

    const mode = request.data?.mode === "public" ? "public" : "debug";

    try {
      const payload = await fetchAppsScript(mode);
      return {
        ok: true,
        feed,
        mode,
        payload
      };
    } catch (error) {
      console.error("controlRoomFeed Hese-Fredrik fetch failed", error);
      throw new HttpsError(
        "unavailable",
        "Hese-Fredrik could not be reached by the Staff backend."
      );
    }
  }
);
