import {
  getAuthorizedStaffSession,
  signOutStaff,
  staffAccessConfig
} from "./staff-access.js?v=20260819-rooms3";

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

function setGateError(message) {
  if (gate) gate.dataset.state = "error";
  if (gateText) gateText.textContent = message;
}

async function boot() {
  try {
    const session = await getAuthorizedStaffSession();

    if (!session?.authorized) {
      if (session?.reason === "not-configured") {
        setGateError("Scoutland Yard authentication is not configured.");
        return;
      }

      window.location.replace(entranceUrl());
      return;
    }

    const profile = session.profile || {};
    const scoutName = profile.scout_name || profile.scoutName || session.user?.displayName || "SkyrScout Staff";
    const role = profile.role || "Staff";

    identityTargets.forEach((target) => {
      target.textContent = scoutName;
    });

    roleTargets.forEach((target) => {
      target.textContent = role;
    });

    if (room) room.hidden = false;
    if (gate) gate.hidden = true;

    // Shared signal for private Scoutland Yard rooms. It contains no token or secret.
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
      await signOutStaff();
    } finally {
      window.location.replace(staffAccessConfig.entrancePath);
    }
  });
});

boot();
