import "./staff-backend.js?v=20260820-library1";

const breadcrumbsEl = document.getElementById("libraryDriveBreadcrumbs");
const contentEl = document.getElementById("libraryDriveContent");
const countEl = document.getElementById("libraryDriveCount");
const searchEl = document.getElementById("libraryDriveSearch");
const refreshEl = document.getElementById("libraryDriveRefresh");
const openDriveEl = document.getElementById("libraryDriveOpenDrive");
const connectionEl = document.getElementById("libraryDriveConnection");
const connectionTextEl = document.getElementById("libraryDriveConnectionText");

const state = {
  started: false,
  loading: false,
  payload: null,
  filter: ""
};

function backend() {
  const api = window.SkyrScoutStaffBackend;

  if (!api || typeof api.fetchLibraryFolder !== "function") {
    throw new Error("LIBRARY_BACKEND_NOT_AVAILABLE");
  }

  return api;
}

function setConnection(status, text) {
  if (connectionEl) connectionEl.dataset.state = status;
  if (connectionTextEl) connectionTextEl.textContent = text;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = String(text);
  return element;
}

function normaliseFilter(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

function matchesFilter(item) {
  if (!state.filter) return true;
  return String(item?.name || "").toLocaleLowerCase().includes(state.filter);
}

function fileKind(mimeType) {
  const mime = String(mimeType || "").toLowerCase();

  if (mime.includes("google-apps.document")) return "Google Doc";
  if (mime.includes("google-apps.spreadsheet")) return "Google Sheet";
  if (mime.includes("google-apps.presentation")) return "Google Slides";
  if (mime.includes("pdf")) return "PDF";
  if (mime.startsWith("image/")) return "Image";
  if (mime.startsWith("video/")) return "Video";
  if (mime.startsWith("audio/")) return "Audio";
  if (mime.includes("word")) return "Document";
  if (mime.includes("sheet") || mime.includes("excel")) return "Spreadsheet";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "Presentation";
  return "File";
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function renderBreadcrumbs(payload) {
  if (!breadcrumbsEl) return;
  breadcrumbsEl.replaceChildren();

  const crumbs = Array.isArray(payload?.breadcrumbs) ? payload.breadcrumbs : [];

  crumbs.forEach((crumb, index) => {
    if (index > 0) {
      const separator = createElement("span", "library-drive-breadcrumb-separator", "/");
      separator.setAttribute("aria-hidden", "true");
      breadcrumbsEl.appendChild(separator);
    }

    const isCurrent = index === crumbs.length - 1;

    if (isCurrent) {
      const current = createElement("span", "library-drive-breadcrumb-current", crumb.name);
      current.setAttribute("aria-current", "page");
      breadcrumbsEl.appendChild(current);
      return;
    }

    const button = createElement("button", "library-drive-breadcrumb", crumb.name);
    button.type = "button";
    button.addEventListener("click", () => loadFolder(crumb.id));
    breadcrumbsEl.appendChild(button);
  });
}

function renderFolder(folder) {
  const button = createElement("button", "library-drive-item library-drive-folder");
  button.type = "button";
  button.dataset.libraryName = folder.name || "";

  const icon = createElement("span", "library-drive-item-icon", "▰");
  icon.setAttribute("aria-hidden", "true");

  const copy = createElement("span", "library-drive-item-copy");
  copy.appendChild(createElement("strong", "", folder.name || "Untitled folder"));

  const metaText = folder.lastUpdated
    ? `Folder · Updated ${formatDate(folder.lastUpdated)}`
    : "Folder";
  copy.appendChild(createElement("span", "", metaText));

  const arrow = createElement("span", "library-drive-item-arrow", "→");
  arrow.setAttribute("aria-hidden", "true");

  button.append(icon, copy, arrow);
  button.addEventListener("click", () => loadFolder(folder.id));

  return button;
}

function renderFile(file) {
  const link = createElement("a", "library-drive-item library-drive-file");
  link.href = file.url || "#";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.dataset.libraryName = file.name || "";

  const icon = createElement("span", "library-drive-item-icon", "▤");
  icon.setAttribute("aria-hidden", "true");

  const copy = createElement("span", "library-drive-item-copy");
  copy.appendChild(createElement("strong", "", file.name || "Untitled file"));

  const pieces = [fileKind(file.mimeType)];
  const updated = formatDate(file.lastUpdated);
  if (updated) pieces.push(`Updated ${updated}`);
  copy.appendChild(createElement("span", "", pieces.join(" · ")));

  const arrow = createElement("span", "library-drive-item-arrow", "↗");
  arrow.setAttribute("aria-hidden", "true");

  link.append(icon, copy, arrow);
  return link;
}

function renderCurrentFolder() {
  if (!contentEl || !state.payload) return;

  const folders = (Array.isArray(state.payload.folders) ? state.payload.folders : []).filter(matchesFilter);
  const files = (Array.isArray(state.payload.files) ? state.payload.files : []).filter(matchesFilter);
  const totalUnfiltered =
    (Array.isArray(state.payload.folders) ? state.payload.folders.length : 0) +
    (Array.isArray(state.payload.files) ? state.payload.files.length : 0);

  contentEl.replaceChildren();

  if (countEl) {
    if (state.filter) {
      countEl.textContent = `${folders.length + files.length} of ${totalUnfiltered} items`;
    } else {
      const folderCount = Array.isArray(state.payload.folders) ? state.payload.folders.length : 0;
      const fileCount = Array.isArray(state.payload.files) ? state.payload.files.length : 0;
      countEl.textContent = `${folderCount} folder${folderCount === 1 ? "" : "s"} · ${fileCount} file${fileCount === 1 ? "" : "s"}`;
    }
  }

  if (!folders.length && !files.length) {
    const empty = createElement("div", "library-drive-empty");
    empty.appendChild(createElement("strong", "", state.filter ? "No matching items" : "This folder is empty"));
    empty.appendChild(createElement(
      "span",
      "",
      state.filter ? "Change or clear the filter to see the folder contents." : "Files and folders added in Google Drive will appear here automatically."
    ));
    contentEl.appendChild(empty);
    return;
  }

  if (folders.length) {
    const section = createElement("section", "library-drive-group");
    section.appendChild(createElement("h2", "library-drive-group-title", "Folders"));
    const grid = createElement("div", "library-drive-grid");
    folders.forEach((folder) => grid.appendChild(renderFolder(folder)));
    section.appendChild(grid);
    contentEl.appendChild(section);
  }

  if (files.length) {
    const section = createElement("section", "library-drive-group");
    section.appendChild(createElement("h2", "library-drive-group-title", "Files"));
    const grid = createElement("div", "library-drive-grid");
    files.forEach((file) => grid.appendChild(renderFile(file)));
    section.appendChild(grid);
    contentEl.appendChild(section);
  }
}

function renderPayload(payload) {
  state.payload = payload;
  state.filter = normaliseFilter(searchEl?.value);

  renderBreadcrumbs(payload);

  if (openDriveEl) {
    const driveUrl = payload?.current?.url;
    if (driveUrl) {
      openDriveEl.href = driveUrl;
      openDriveEl.hidden = false;
    } else {
      openDriveEl.hidden = true;
    }
  }

  renderCurrentFolder();
}

function renderLoading() {
  if (!contentEl) return;
  contentEl.replaceChildren();
  const loading = createElement("div", "library-drive-loading");
  const spinner = createElement("span", "library-drive-spinner");
  spinner.setAttribute("aria-hidden", "true");
  loading.append(spinner, createElement("strong", "", "Opening folder…"));
  contentEl.appendChild(loading);
  if (countEl) countEl.textContent = "Loading…";
}

function renderError(error) {
  console.error("Scoutland Library:", error);
  setConnection("error", "Library unavailable");

  if (!contentEl) return;
  contentEl.replaceChildren();
  const box = createElement("div", "library-drive-error");
  box.appendChild(createElement("strong", "", "Could not load SkyrScout Library"));
  box.appendChild(createElement("span", "", "The Staff session is valid, but the Drive bridge did not answer correctly."));
  const retry = createElement("button", "library-drive-action", "Try again");
  retry.type = "button";
  retry.addEventListener("click", () => loadFolder(state.payload?.current?.id || null));
  box.appendChild(retry);
  contentEl.appendChild(box);
  if (countEl) countEl.textContent = "Connection error";
}

async function loadFolder(folderId = null) {
  if (state.loading) return;
  state.loading = true;
  renderLoading();
  setConnection("loading", "Reading Google Drive…");

  try {
    const payload = await backend().fetchLibraryFolder(folderId);
    renderPayload(payload);
    setConnection("ok", "Google Drive connected");
  } catch (error) {
    renderError(error);
  } finally {
    state.loading = false;
  }
}

function start() {
  if (state.started) return;
  state.started = true;
  loadFolder(null);
}

searchEl?.addEventListener("input", () => {
  state.filter = normaliseFilter(searchEl.value);
  renderCurrentFolder();
});

refreshEl?.addEventListener("click", () => {
  loadFolder(state.payload?.current?.id || null);
});

window.addEventListener("staffroom:authorized", start, { once: true });

if (window.SkyrScoutStaffAuthorized === true) {
  start();
}
