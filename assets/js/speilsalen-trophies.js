import "./staff-backend.js?v=20260820-staffbackend1";

const REFRESH_MS = 5 * 60 * 1000;
const SNAPSHOT_SCHEMA = [
  "videoId",
  "totalViews",
  "deltaSincePoll",
  "currentHourViews",
  "previousHourViews",
  "last48hViews",
  "activityStatus",
  "videoType",
  "publishedAtMs"
];

const state = {
  started: false,
  loading: false,
  videos: [],
  timer: null
};

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatViews(value) {
  const n = numberOrNull(value);
  if (n === null) return "—";
  return new Intl.NumberFormat("en-GB").format(Math.max(0, Math.round(n)));
}

function catalog() {
  return [...document.querySelectorAll("[data-trophy-video]")]
    .map((node) => ({
      videoId: String(node.dataset.videoId || "").trim(),
      format: String(node.dataset.format || "").trim() === "short" ? "short" : "long",
      title: String(node.dataset.title || "YouTube video").trim(),
      pageUrl: String(node.dataset.pageUrl || "").trim(),
      youtubeUrl: String(node.dataset.youtubeUrl || "").trim(),
      thumbnail: String(node.dataset.thumbnail || "").trim()
    }))
    .filter((item) => item.videoId);
}

function decodeSnapshot(payload) {
  const rows = Array.isArray(payload?.videoSnapshotRows) ? payload.videoSnapshotRows : [];
  const schema = Array.isArray(payload?.videoSnapshotSchema) && payload.videoSnapshotSchema.length
    ? payload.videoSnapshotSchema.map(String)
    : SNAPSHOT_SCHEMA;
  const index = new Map(schema.map((name, i) => [name, i]));
  const out = new Map();

  rows.forEach((row) => {
    if (!Array.isArray(row)) return;
    const get = (name) => row[index.has(name) ? index.get(name) : SNAPSHOT_SCHEMA.indexOf(name)];
    const videoId = String(get("videoId") || "").trim();
    if (!videoId) return;
    out.set(videoId, {
      videoId,
      totalViews: numberOrNull(get("totalViews")),
      videoType: String(get("videoType") || "").toLowerCase()
    });
  });

  return out;
}

function mergedVideos(payload) {
  const snapshot = decodeSnapshot(payload);
  return catalog()
    .map((item) => {
      const live = snapshot.get(item.videoId);
      if (!live || live.totalViews === null) return null;
      return {
        ...item,
        totalViews: live.totalViews,
        format: live.videoType === "short" ? "short" : item.format
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.totalViews - a.totalViews || a.title.localeCompare(b.title));
}

function tierFor(views) {
  if (views >= 10000) return "crown";
  if (views >= 5000) return "trophy";
  if (views >= 1000) return "medal";
  return null;
}

function card(item) {
  const link = document.createElement("a");
  link.className = "speilsalen-video-card";
  link.href = item.youtubeUrl || item.pageUrl || "#";
  if (item.youtubeUrl) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  const img = document.createElement("img");
  img.src = item.thumbnail;
  img.alt = "";
  img.loading = "lazy";
  if (item.format === "short") {
    img.addEventListener("error", () => {
      if (img.dataset.fallbackApplied) return;
      img.dataset.fallbackApplied = "1";
      img.src = `https://i.ytimg.com/vi/${encodeURIComponent(item.videoId)}/mqdefault.jpg`;
    });
  }

  const title = document.createElement("strong");
  title.textContent = item.title;
  title.title = item.title;

  const views = document.createElement("span");
  views.textContent = `${formatViews(item.totalViews)} views`;

  link.append(img, title, views);
  return link;
}

function renderTier(format, tier) {
  const items = state.videos.filter((item) => item.format === format && tierFor(item.totalViews) === tier);
  const target = document.querySelector(`[data-tier-items="${format}:${tier}"]`);
  const count = document.querySelector(`[data-tier-count="${format}:${tier}"]`);
  if (!target || !count) return;

  count.textContent = String(items.length);
  target.replaceChildren();

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "speilsalen-tier-empty";
    empty.textContent = "No videos yet";
    target.appendChild(empty);
    return;
  }

  items.forEach((item) => target.appendChild(card(item)));
}

function renderCabinet() {
  ["long", "short"].forEach((format) => {
    ["crown", "trophy", "medal"].forEach((tier) => renderTier(format, tier));
  });
}

function recordHolder(format) {
  return state.videos.find((item) => item.format === format) || null;
}

function renderRecord(format) {
  const target = document.querySelector(`[data-record-content="${format}"]`);
  if (!target) return;
  target.replaceChildren();

  const item = recordHolder(format);
  if (!item) {
    const empty = document.createElement("div");
    empty.className = "speilsalen-record-loading";
    empty.textContent = "Record data unavailable.";
    target.appendChild(empty);
    return;
  }

  const img = document.createElement("img");
  img.className = "speilsalen-record-thumb";
  img.src = item.thumbnail;
  img.alt = "";
  if (format === "short") {
    img.addEventListener("error", () => {
      if (img.dataset.fallbackApplied) return;
      img.dataset.fallbackApplied = "1";
      img.src = `https://i.ytimg.com/vi/${encodeURIComponent(item.videoId)}/mqdefault.jpg`;
    });
  }

  const copy = document.createElement("div");
  copy.className = "speilsalen-record-copy";

  const label = document.createElement("small");
  label.textContent = format === "short" ? "MOST VIEWED SHORT" : "MOST VIEWED LONG FORM";

  const title = document.createElement("h2");
  title.textContent = item.title;

  const views = document.createElement("div");
  views.className = "speilsalen-record-views";
  views.append(document.createTextNode(formatViews(item.totalViews)));
  const suffix = document.createElement("span");
  suffix.textContent = "views";
  views.appendChild(suffix);

  const links = document.createElement("div");
  links.className = "speilsalen-record-links";

  if (item.pageUrl) {
    const pageLink = document.createElement("a");
    pageLink.href = item.pageUrl;
    pageLink.textContent = "SkyrScout";
    links.appendChild(pageLink);
  }

  if (item.youtubeUrl) {
    const youtubeLink = document.createElement("a");
    youtubeLink.href = item.youtubeUrl;
    youtubeLink.target = "_blank";
    youtubeLink.rel = "noopener noreferrer";
    youtubeLink.textContent = "YouTube";
    links.appendChild(youtubeLink);
  }

  copy.append(label, title, views, links);
  target.append(img, copy);
}

function renderAll() {
  renderCabinet();
  renderRecord("long");
  renderRecord("short");
}

function setStatus(text, status = "") {
  const node = document.querySelector("[data-speilsalen-status]");
  if (!node) return;
  node.textContent = text;
  if (status) node.dataset.state = status;
  else delete node.dataset.state;
}

function setFormat(format) {
  document.querySelectorAll("[data-speilsalen-format]").forEach((button) => {
    const active = button.dataset.speilsalenFormat === format;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll("[data-speilsalen-view]").forEach((view) => {
    view.hidden = view.dataset.speilsalenView !== format;
  });
}

function modalFor(kind) {
  if (kind === "cabinet") return document.getElementById("speilsalenCabinetModal");
  if (kind === "long-record") return document.getElementById("speilsalenLongRecordModal");
  if (kind === "short-record") return document.getElementById("speilsalenShortRecordModal");
  return null;
}

function openModal(kind) {
  const modal = modalFor(kind);
  if (!modal) return;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  modal.querySelector(".speilsalen-modal-close")?.focus();
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.hidden = true;
  if (![...document.querySelectorAll(".speilsalen-modal")].some((item) => !item.hidden)) {
    document.body.style.overflow = "";
  }
}

function wireUi() {
  document.querySelectorAll("[data-speilsalen-open]").forEach((button) => {
    button.addEventListener("click", () => openModal(button.dataset.speilsalenOpen));
  });

  document.querySelectorAll("[data-speilsalen-close]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.speilsalenClose));
  });

  document.querySelectorAll("[data-speilsalen-format]").forEach((button) => {
    button.addEventListener("click", () => setFormat(button.dataset.speilsalenFormat));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll(".speilsalen-modal").forEach((modal) => {
      if (!modal.hidden) closeModal(modal.id);
    });
  });
}

async function refresh() {
  if (state.loading) return;
  const backend = window.SkyrScoutStaffBackend;
  if (!backend || typeof backend.fetchHeseFredrik !== "function") {
    setStatus("Staff data bridge unavailable", "error");
    return;
  }

  state.loading = true;
  setStatus("Loading live views…");

  try {
    const payload = await backend.fetchHeseFredrik("debug");
    state.videos = mergedVideos(payload || {});
    renderAll();
    setStatus(`Live public views · ${state.videos.length} videos`, "live");
  } catch (error) {
    console.warn("Speilsalen trophies:", error);
    setStatus("Live view data unavailable", "error");
  } finally {
    state.loading = false;
    window.clearTimeout(state.timer);
    state.timer = window.setTimeout(refresh, REFRESH_MS);
  }
}

function start() {
  if (state.started) return;
  state.started = true;
  wireUi();
  setFormat("long");
  renderRecord("long");
  renderRecord("short");
  refresh();
}

if (window.SkyrScoutStaffAuthorized) {
  start();
} else {
  window.addEventListener("staffroom:authorized", start, { once: true });
}
