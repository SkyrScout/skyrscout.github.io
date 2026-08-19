import {
  getAuthorizedStaffSession,
  signOutStaff,
  staffAccessConfig
} from "./staff-access.js?v=20260819-rooms3";

const room = document.getElementById("staffProtectedRoom");
const gate = document.getElementById("staffRoomAuthGate");
const gateText = document.getElementById("staffRoomAuthGateText");
const identityEls = Array.from(document.querySelectorAll("[data-staff-identity]"));
const roleEls = Array.from(document.querySelectorAll("[data-staff-role]"));
const signOutButtons = Array.from(document.querySelectorAll("[data-staff-signout]"));

function entranceUrl() {
  const next = window.location.pathname + window.location.search + window.location.hash;
  return `${staffAccessConfig.entrancePath}?next=${encodeURIComponent(next)}`;
}

async function authorizeRoom() {
  if (gate) { gate.hidden = false; gate.dataset.state = "checking"; }
  if (gateText) gateText.textContent = "Checking SkyrScout staff access…";
  const session = await getAuthorizedStaffSession();
  if (session.status !== "authorized") {
    if (session.status === "not-configured") {
      if (gate) gate.dataset.state = "error";
      if (gateText) gateText.textContent = "Staff Entrance is not connected to Firebase.";
      return;
    }
    window.location.replace(entranceUrl());
    return;
  }
  identityEls.forEach((el) => { el.textContent = session.profile.scoutName; });
  roleEls.forEach((el) => { el.textContent = session.profile.role; });
  if (room) room.hidden = false;
  if (gate) gate.hidden = true;
}

signOutButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    button.disabled = true;
    await signOutStaff();
    window.location.replace(staffAccessConfig.entrancePath);
  });
});

authorizeRoom();
