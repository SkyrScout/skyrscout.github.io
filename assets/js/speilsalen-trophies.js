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
  "publishedAtMs",
  "title"
];

const state = {
  started: false,
  loading: false,
  videos: [],
  unclassified: [],
  timer: null
};

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatViews(value) {
  const n = numberOrNull(value);
  if (n === null) return "—";
  return new Intl.NumberFormat("en-GB").format(Math.max(0, Math.round(n)));
}


function looksLikeRawVideoId(text) {
  const value = String(text || '').trim();
  if (!value) return true;
  if (/^-?[A-Za-z0-9_-]{8,}$/.test(value)) return true;
  if (!/\s/.test(value) && /^[A-Za-z0-9_-]{6,}$/.test(value)) return true;
  return false;
}

function preferredTitle(siteTitle, liveTitle, videoId) {
  const site = String(siteTitle || '').trim();
  const live = String(liveTitle || '').trim();
  if (site && !looksLikeRawVideoId(site)) return site;
  if (live && !looksLikeRawVideoId(live)) return live;
  if (site) return site;
  if (live) return live;
  return String(videoId || '').trim();
}

function thumbnailFor(videoId, format, siteThumb) {
  const site = String(siteThumb || '').trim();
  if (site) return site;
  return defaultThumbnail(videoId, format);
}

const titleResolveCache = new Map();
let titleResolveTimer = null;

async function fetchYoutubeOembedTitle(item) {
  const url = item?.youtubeUrl || youtubeUrl(item.videoId, item.format);
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const response = await fetch(endpoint, { mode: 'cors' });
  if (!response.ok) throw new Error(`oembed ${response.status}`);
  const data = await response.json();
  return String(data?.title || '').trim();
}

function scheduleTitleResolution() {
  if (titleResolveTimer) return;
  titleResolveTimer = window.setTimeout(async () => {
    titleResolveTimer = null;
    const pending = state.videos.filter((item) => item.needsTitleResolve && !titleResolveCache.has(item.videoId));
    if (!pending.length) return;
    const chunk = pending.slice(0, 8);
    await Promise.all(chunk.map(async (item) => {
      try {
        const title = await fetchYoutubeOembedTitle(item);
        if (title) titleResolveCache.set(item.videoId, title);
      } catch (error) {
        console.warn('Speilsalen title resolve failed:', item.videoId, error);
        titleResolveCache.set(item.videoId, item.title || item.videoId);
      }
    }));
    let changed = false;
    state.videos = state.videos.map((item) => {
      const resolved = titleResolveCache.get(item.videoId);
      if (resolved && resolved !== item.title) {
        changed = true;
        return { ...item, title: resolved, needsTitleResolve: false };
      }
      return resolved ? { ...item, needsTitleResolve: false } : item;
    });
    if (changed) renderAll();
    if (state.videos.some((item) => item.needsTitleResolve && !titleResolveCache.has(item.videoId))) {
      scheduleTitleResolution();
    }
  }, 40);
}

function siteCatalog() {
  const out = new Map();
  document.querySelectorAll("[data-trophy-video]").forEach((node) => {
    const videoId = String(node.dataset.videoId || "").trim();
    if (!videoId) return;
    out.set(videoId, {
      videoId,
      format: String(node.dataset.format || "").trim() === "short" ? "short" : "long",
      title: String(node.dataset.title || "").trim(),
      pageUrl: String(node.dataset.pageUrl || "").trim(),
      youtubeUrl: String(node.dataset.youtubeUrl || "").trim(),
      thumbnail: String(node.dataset.thumbnail || "").trim()
    });
  });
  return out;
}

function decodeSnapshot(payload) {
  const rows = Array.isArray(payload?.videoSnapshotRows) ? payload.videoSnapshotRows : [];
  const schema = Array.isArray(payload?.videoSnapshotSchema) && payload.videoSnapshotSchema.length
    ? payload.videoSnapshotSchema.map(String)
    : SNAPSHOT_SCHEMA;
  const index = new Map(schema.map((name, i) => [name, i]));
  const out = [];

  rows.forEach((row) => {
    if (!Array.isArray(row)) return;
    const get = (name) => {
      if (index.has(name)) return row[index.get(name)];
      const fallbackIndex = SNAPSHOT_SCHEMA.indexOf(name);
      return fallbackIndex >= 0 ? row[fallbackIndex] : undefined;
    };
    const videoId = String(get("videoId") || "").trim();
    if (!videoId) return;
    out.push({
      videoId,
      totalViews: numberOrNull(get("totalViews")),
      videoType: String(get("videoType") || "").trim().toLowerCase(),
      title: String(get("title") || "").trim()
    });
  });

  return out;
}

function youtubeUrl(videoId, format) {
  const id = encodeURIComponent(videoId);
  return format === "short"
    ? `https://www.youtube.com/shorts/${id}`
    : `https://www.youtube.com/watch?v=${id}`;
}

function defaultThumbnail(videoId, format) {
  const id = encodeURIComponent(videoId);
  return format === "short"
    ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`
    : `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}

function mergedVideos(payload) {
  const catalog = siteCatalog();
  const rows = decodeSnapshot(payload);
  const merged = [];
  const unclassified = [];

  rows.forEach((live) => {
    if (live.totalViews === null) return;
    const site = catalog.get(live.videoId) || null;

    let format = null;
    if (live.videoType === "short") format = "short";
    else if (live.videoType === "long") format = "long";
    else if (site?.format) format = site.format;

    if (!format) {
      unclassified.push({ ...live, site });
      return;
    }

    const cachedTitle = titleResolveCache.get(live.videoId) || "";
    const title = preferredTitle(site?.title || cachedTitle, live.title || cachedTitle, live.videoId);
    const needsTitleResolve = looksLikeRawVideoId(title);
    merged.push({
      videoId: live.videoId,
      totalViews: live.totalViews,
      format,
      title,
      needsTitleResolve,
      pageUrl: site?.pageUrl || "",
      youtubeUrl: site?.youtubeUrl || youtubeUrl(live.videoId, format),
      thumbnail: thumbnailFor(live.videoId, format, site?.thumbnail)
    });
  });

  state.unclassified = unclassified;
  return merged.sort((a, b) => b.totalViews - a.totalViews || a.title.localeCompare(b.title));
}

/*
  Trophy exchange system.
  Every whole 1,000 views creates one medal-unit.
  5 medal-units = 1 trophy.
  2 trophies = 1 crown.
  The remainder is always normalized upward, so a video can never show
  5 medals or 2 trophies at the same time.
*/
function trophyWallet(views) {
  const totalViews = Math.max(0, Math.floor(Number(views) || 0));
  const thousandUnits = Math.floor(totalViews / 1000);
  const crowns = Math.floor(thousandUnits / 10);
  const afterCrowns = thousandUnits % 10;
  const trophies = Math.floor(afterCrowns / 5);
  const medals = afterCrowns % 5;
  return { crowns, trophies, medals, thousandUnits };
}

function highestTier(wallet) {
  if (wallet.crowns > 0) return "crown";
  if (wallet.trophies > 0) return "trophy";
  if (wallet.medals > 0) return "medal";
  return null;
}

function awardSvg(kind) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", kind === "crown" ? "0 0 64 50" : "0 0 64 64");
  svg.setAttribute("aria-hidden", "true");

  function path(d) {
    const node = document.createElementNS(ns, "path");
    node.setAttribute("d", d);
    svg.appendChild(node);
  }

  if (kind === "crown") {
    path("M8 38L4 13l15 12L31 6l13 19 16-12-5 25z");
    path("M10 42h44");
  } else if (kind === "trophy") {
    path("M20 10h24v12c0 11-5 18-12 18s-12-7-12-18z");
    path("M20 15H9c0 12 5 18 15 18M44 15h11c0 12-5 18-15 18");
    path("M32 40v9M22 54h20");
  } else {
    path("M20 6l12 18L44 6");
    const outer = document.createElementNS(ns, "circle");
    outer.setAttribute("cx", "32");
    outer.setAttribute("cy", "39");
    outer.setAttribute("r", "14");
    svg.appendChild(outer);
    const inner = document.createElementNS(ns, "circle");
    inner.setAttribute("cx", "32");
    inner.setAttribute("cy", "39");
    inner.setAttribute("r", "6");
    svg.appendChild(inner);
  }
  return svg;
}

function inventoryItem(kind, count) {
  if (!count) return null;
  const item = document.createElement("span");
  item.className = `speilsalen-inventory-item speilsalen-inventory-${kind}`;
  item.appendChild(awardSvg(kind));
  const value = document.createElement("b");
  value.textContent = String(count);
  item.appendChild(value);
  return item;
}

function card(item) {
  const wallet = trophyWallet(item.totalViews);
  const tier = highestTier(wallet);

  const link = document.createElement("a");
  link.className = `speilsalen-video-card speilsalen-video-card-${tier} speilsalen-video-card-${item.format}`;
  link.href = item.youtubeUrl || item.pageUrl || "#";
  link.dataset.tier = tier || "";
  link.dataset.format = item.format;
  if (item.youtubeUrl) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  const portrait = document.createElement("div");
  portrait.className = "speilsalen-card-portrait";

  const img = document.createElement("img");
  img.src = item.thumbnail || defaultThumbnail(item.videoId, item.format);
  img.alt = "";
  img.loading = "lazy";
  img.addEventListener("error", () => {
    if (img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = "1";
    img.src = `https://i.ytimg.com/vi/${encodeURIComponent(item.videoId)}/mqdefault.jpg`;
  });
  portrait.appendChild(img);

  const plaque = document.createElement("div");
  plaque.className = "speilsalen-card-plaque";

  const title = document.createElement("strong");
  title.textContent = item.title;
  title.title = item.title;

  const views = document.createElement("span");
  views.className = "speilsalen-card-views";
  views.textContent = `${formatViews(item.totalViews)} views`;

  const inventory = document.createElement("div");
  inventory.className = "speilsalen-trophy-inventory";
  [
    inventoryItem("crown", wallet.crowns),
    inventoryItem("trophy", wallet.trophies),
    inventoryItem("medal", wallet.medals)
  ].filter(Boolean).forEach((node) => inventory.appendChild(node));

  plaque.append(title, views, inventory);
  link.append(portrait, plaque);
  return link;
}

function renderTier(format, tier) {
  const items = state.videos.filter((item) => {
    if (item.format !== format) return false;
    return highestTier(trophyWallet(item.totalViews)) === tier;
  }).sort((a, b) => b.totalViews - a.totalViews || a.title.localeCompare(b.title));
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
  return state.videos
    .filter((item) => item.format === format)
    .sort((a, b) => b.totalViews - a.totalViews || a.title.localeCompare(b.title))[0] || null;
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
  img.src = item.thumbnail || defaultThumbnail(item.videoId, item.format);
  img.alt = "";
  img.addEventListener("error", () => {
    if (img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = "1";
    img.src = `https://i.ytimg.com/vi/${encodeURIComponent(item.videoId)}/mqdefault.jpg`;
  });

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

  const wallet = trophyWallet(item.totalViews);
  const inventory = document.createElement("div");
  inventory.className = "speilsalen-record-inventory";
  [
    inventoryItem("crown", wallet.crowns),
    inventoryItem("trophy", wallet.trophies),
    inventoryItem("medal", wallet.medals)
  ].filter(Boolean).forEach((node) => inventory.appendChild(node));

  const links = document.createElement("div");
  links.className = "speilsalen-record-links";

  if (item.pageUrl) {
    const pageLink = document.createElement("a");
    pageLink.href = item.pageUrl;
    pageLink.textContent = "SkyrScout";
    links.appendChild(pageLink);
  }

  const youtubeLink = document.createElement("a");
  youtubeLink.href = item.youtubeUrl || youtubeUrl(item.videoId, item.format);
  youtubeLink.target = "_blank";
  youtubeLink.rel = "noopener noreferrer";
  youtubeLink.textContent = "YouTube";
  links.appendChild(youtubeLink);

  copy.append(label, title, views, inventory, links);
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
    scheduleTitleResolution();

    const totalRows = decodeSnapshot(payload || {}).length;
    const unclassified = state.unclassified.length;
    const statusText = unclassified
      ? `Live public views · ${totalRows} videos · ${unclassified} unclassified`
      : `Live public views · ${totalRows} videos`;
    setStatus(statusText, unclassified ? "warning" : "live");
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
  refresh();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}

/* Exported only for browser-console diagnostics and regression checks. */
window.SkyrScoutTrophyMath = Object.freeze({ trophyWallet, highestTier });
