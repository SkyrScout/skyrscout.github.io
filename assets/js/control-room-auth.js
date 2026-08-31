import {
  getAuthorizedStaffSession,
  signOutStaff,
  staffAccessConfig
} from "./staff-access.js";

const app = document.getElementById("staffProtectedApp");
const gate = document.getElementById("staffAuthGate");
const gateText = document.getElementById("staffAuthGateText");
const identity = document.getElementById("staffIdentity");
const role = document.getElementById("staffRole");
const signOutButton = document.getElementById("staffControlRoomSignOut");

function entranceUrl() {
  const next = window.location.pathname + window.location.search + window.location.hash;
  return `${staffAccessConfig.entrancePath}?next=${encodeURIComponent(next)}`;
}

function loadClassicScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function makeRoomLink(node, href, smallText) {
  if (!node) return null;
  const link = document.createElement("a");
  link.className = node.className;
  link.href = href;
  link.innerHTML = node.innerHTML;
  link.style.color = "inherit";
  link.style.textDecoration = "none";
  if (smallText) {
    const small = link.querySelector("small");
    if (small) small.textContent = smallText;
  }
  node.replaceWith(link);
  return link;
}

function wireScoutlandRoomNavigation() {
  const rooms = [...document.querySelectorAll(".sidebar .room")];
  const byName = (name) => rooms.find((node) => node.querySelector("strong")?.textContent.trim() === name);

  makeRoomLink(byName("Library"), "/library/", "Research & documents");
  const speilsalen = makeRoomLink(byName("Speilsalen"), "/speilsalen/", "Reflection & strategy");

  if (speilsalen && !document.querySelector('.sidebar .room[href="/foyer/"]')) {
    const foyer = document.createElement("a");
    foyer.className = "room";
    foyer.href = "/foyer/";
    foyer.style.color = "inherit";
    foyer.style.textDecoration = "none";
    foyer.innerHTML = "<strong>Foyer</strong><small>Back to Scoutland Yard</small>";
    speilsalen.insertAdjacentElement("afterend", foyer);
  }
}

async function startControlRoom() {
  // Load the authenticated Firebase data bridge before any Control Room
  // script is allowed to request live data. The browser must never call
  // Apps Script directly; the callable function does that server-side.
  await import("/assets/js/staff-backend.js?v=20260830-youtube-analytics-v1");
  await loadClassicScript("/assets/js/control-room.js?v=20260831-geo-state-owner-v1");
  await loadClassicScript("/assets/js/control-room-live.js?v=20260829-vps-realtime-v1");
  await loadClassicScript("/assets/js/control-room-youtube-analytics.js?v=20260831-geo-fixes-v1");
}

async function authorizeControlRoom() {
  gate.hidden = false;
  gateText.textContent = "Checking SkyrScout staff access…";

  const session = await getAuthorizedStaffSession();

  if (session.status !== "authorized") {
    if (session.status === "not-configured") {
      gate.dataset.state = "error";
      gateText.textContent = "Staff Entrance is not connected to Firebase yet.";
      return;
    }

    window.location.replace(entranceUrl());
    return;
  }

  if (identity) identity.textContent = session.profile.scoutName;
  if (role) role.textContent = session.profile.role;

  wireScoutlandRoomNavigation();
  app.hidden = false;
  gate.hidden = true;

  try {
    await startControlRoom();
  } catch (error) {
    gate.hidden = false;
    gate.dataset.state = "error";
    gateText.textContent = "Staff access is valid, but the Control Room scripts could not be loaded.";
  }
}

signOutButton?.addEventListener("click", async () => {
  await signOutStaff();
  window.location.replace(staffAccessConfig.entrancePath);
});

authorizeControlRoom();
