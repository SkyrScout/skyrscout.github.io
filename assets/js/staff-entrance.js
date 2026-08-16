import {
  getAuthorizedStaffSession,
  safeStaffTarget,
  signInApprovedGoogleAccount,
  signOutStaff
} from "./staff-access.js";

const signInButton = document.getElementById("staffGoogleSignIn");
const enterButton = document.getElementById("staffEnterYard");
const signOutButton = document.getElementById("staffSignOut");
const statusBox = document.getElementById("staffAuthStatus");
const statusText = document.getElementById("staffAuthStatusText");
const errorBox = document.getElementById("staffAuthError");

const params = new URLSearchParams(window.location.search);
const target = safeStaffTarget(params.get("next"));

function setState(state, text) {
  statusBox.dataset.state = state;
  statusText.textContent = text;
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

function showAuthorized(profile) {
  clearError();
  setState("authorized", `Access granted: ${profile.scoutName}`);
  signInButton.hidden = true;
  signInButton.disabled = true;
  enterButton.hidden = false;
  signOutButton.hidden = false;
}

function showSignedOut() {
  clearError();
  setState("ready", "Staff authentication ready.");
  signInButton.hidden = false;
  signInButton.disabled = false;
  enterButton.hidden = true;
  signOutButton.hidden = true;
}

function showDenied() {
  setState("denied", "Access denied.");
  showError("This Google account is not on the SkyrScout staff allowlist.");
  signInButton.hidden = false;
  signInButton.disabled = false;
  enterButton.hidden = true;
  signOutButton.hidden = true;
}

function humanizeAuthError(error) {
  const code = error?.code || "";
  if (code === "auth/popup-closed-by-user") return "Google sign-in was closed before completion.";
  if (code === "auth/popup-blocked") return "The browser blocked the Google sign-in popup. Allow popups for this page and try again.";
  if (code === "auth/unauthorized-domain") return "This site has not yet been added to Firebase Authentication's authorized domains.";
  return "Staff sign-in could not be completed. Check the Firebase setup and try again.";
}

async function initializeEntrance() {
  setState("checking", "Checking staff session…");
  signInButton.disabled = true;

  const session = await getAuthorizedStaffSession();

  if (session.status === "authorized") {
    showAuthorized(session.profile);
    return;
  }

  if (session.status === "not-configured") {
    setState("error", "Staff Entrance is not connected to Firebase yet.");
    showError("The page is built, but the Firebase web configuration still has to be connected before staff can sign in.");
    return;
  }

  if (session.status === "denied") {
    await signOutStaff();
    showDenied();
    return;
  }

  if (session.status === "error") {
    setState("error", "Could not verify the staff session.");
    showError("Firebase returned an error while checking access.");
    return;
  }

  showSignedOut();
}

signInButton.addEventListener("click", async () => {
  clearError();
  signInButton.disabled = true;
  setState("checking", "Waiting for Google sign-in…");

  try {
    const session = await signInApprovedGoogleAccount();
    if (session.status === "authorized") {
      showAuthorized(session.profile);
      window.location.assign(target);
      return;
    }
    showDenied();
  } catch (error) {
    setState("error", "Sign-in failed.");
    showError(humanizeAuthError(error));
    signInButton.disabled = false;
  }
});

enterButton.addEventListener("click", () => {
  window.location.assign(target);
});

signOutButton.addEventListener("click", async () => {
  await signOutStaff();
  showSignedOut();
});

initializeEntrance();
