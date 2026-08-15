/**
 * SkyrScout / Scoutland Yard
 * Hese-Fredrik MVP backend
 *
 * What it does:
 * - polls every public upload on the SkyrScout YouTube channel
 * - stores a short rolling view-count history
 * - detects unusually large view increases using configurable rules
 * - exposes the current public Hese-Fredrik state as JSON or JSONP
 *
 * IMPORTANT:
 * Put the existing SkyrScout YouTube API key in:
 * Apps Script -> Project Settings -> Script Properties
 * Name: YOUTUBE_API_KEY
 *
 * Do not put the API key in this file.
 */

const HF = Object.freeze({
  // A known SkyrScout upload. Used only to discover the channel + uploads playlist.
  SEED_VIDEO_ID: "3uh3vSUhl60",

  POLL_MINUTES: 5,
  CATALOG_REFRESH_HOURS: 6,
  HISTORY_MINUTES: 180,
  CLOCK_TIME_ZONE: "Europe/Oslo",

  // Thresholds for the PUBLIC siren. Keep this deliberately strict.
  ALERT_RULES: [
    { minutes: 15, minViews: 50 },
    { minutes: 60, minViews: 100 }
  ],

  // PRIVATE Control Room uses a hybrid model:
  // 1) 15-minute rules are rolling and act as an early spike detector
  // 2) 60-minute rules are CLOCK HOURS, aligned to Europe/Oslo
  // 3) absolute spikes always trigger; relative spikes catch quiet videos moving
  // Example: 10 views in the current/previous clock hour after a 2-view hour = alert.
  INTERNAL_ABSOLUTE_RULES: [
    { minutes: 15, minViews: 12 },
    { minutes: 60, minViews: 30 }
  ],
  INTERNAL_RELATIVE_RULES: [
    { minutes: 15, minViews: 5, multiplier: 3.0 },
    { minutes: 60, minViews: 10, multiplier: 2.5 }
  ],

  // Prevent the public widget from flickering off immediately after a trigger.
  HOLD_MINUTES: 45,

  MAX_PUBLIC_ALERTS: 1,
  MAX_DEBUG_MOVERS: 10
});

const PROP = Object.freeze({
  API_KEY: "YOUTUBE_API_KEY",
  CHANNEL_ID: "HF_CHANNEL_ID",
  UPLOADS_PLAYLIST_ID: "HF_UPLOADS_PLAYLIST_ID",
  CATALOG_IDS: "HF_CATALOG_IDS",
  CATALOG_REFRESHED_AT: "HF_CATALOG_REFRESHED_AT",
  PUBLIC_STATE: "HF_PUBLIC_STATE",
  DEBUG_STATE: "HF_DEBUG_STATE",
  LAST_POLL_AT: "HF_LAST_POLL_AT"
});


/**
 * Run ONCE after adding YOUTUBE_API_KEY to Script Properties.
 * It discovers the channel, loads the upload catalogue, takes the first snapshot,
 * and installs a 5-minute polling trigger.
 */
function installHeseFredrik() {
  deletePollTriggers_();
  discoverChannel_();
  refreshCatalog_(true);
  pollYouTube();

  ScriptApp.newTrigger("pollYouTube")
    .timeBased()
    .everyMinutes(HF.POLL_MINUTES)
    .create();

  Logger.log("Hese-Fredrik installed. Polling every " + HF.POLL_MINUTES + " minutes.");
}


/**
 * Main scheduled job.
 */
function pollYouTube() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) {
    return;
  }

  try {
    const now = Date.now();
    ensureCatalogFresh_(now);

    const store = PropertiesService.getScriptProperties();

    // One bulk read instead of hundreds of individual property reads.
    const props = store.getProperties();
    const ids = parseCatalogIds_(props[PROP.CATALOG_IDS]);

    if (!ids.length) {
      throw new Error("The YouTube catalogue is empty.");
    }

    const videos = fetchVideoStats_(ids);
    const movers = [];
    const propertyUpdates = {};

    videos.forEach(function(video) {
      const views = Number(video.statistics && video.statistics.viewCount);

      if (!Number.isFinite(views)) {
        return;
      }

      const key = historyKey_(video.id);
      const history = loadHistoryFromRaw_(props[key]);
      const previous = history.length ? history[history.length - 1] : null;

      history.push([now, views]);

      const cutoff = now - HF.HISTORY_MINUTES * 60 * 1000;
      const trimmed = history.filter(function(sample) {
        return sample[0] >= cutoff;
      });

      propertyUpdates[key] = JSON.stringify(trimmed);

      const deltas = {};
      const previousDeltas = {};
      const clockHours = clockHourMetrics_(trimmed, now);

      // 15m stays rolling. 60m is handled as aligned clock hours.
      deltas["15"] = deltaForWindow_(trimmed, now, 15);
      previousDeltas["15"] = previousWindowDelta_(trimmed, now, 15);

      movers.push({
        videoId: video.id,
        title: video.snippet ? video.snippet.title : video.id,
        thumbnail: thumbnailFor_(video),
        videoUrl: "https://www.youtube.com/watch?v=" + encodeURIComponent(video.id),
        totalViews: views,
        previousPollViews: previous ? previous[1] : null,
        deltaSincePoll: previous ? Math.max(0, views - previous[1]) : null,
        deltas: deltas,
        previousDeltas: previousDeltas,
        clockHours: clockHours
      });
    });

    const alerts = evaluateAlerts_(movers, now, HF.ALERT_RULES, HF.MAX_PUBLIC_ALERTS);
    const internalAlerts = evaluateInternalAlerts_(movers, now, HF.MAX_DEBUG_MOVERS);
    const debugState = buildDebugState_(movers, alerts, internalAlerts, now);
    const publicState = buildPublicState_(
      alerts,
      now,
      safeJsonParse_(props[PROP.PUBLIC_STATE], null)
    );

    propertyUpdates[PROP.DEBUG_STATE] = JSON.stringify(debugState);
    propertyUpdates[PROP.PUBLIC_STATE] = JSON.stringify(publicState);
    propertyUpdates[PROP.LAST_POLL_AT] = String(now);

    // One bulk write for the full poll.
    store.setProperties(propertyUpdates);

  } finally {
    lock.releaseLock();
  }
}


/**
 * Refresh the channel upload catalogue manually.
 */
function refreshCatalog() {
  refreshCatalog_(true);
}


/**
 * Public web endpoint.
 *
 * Default:
 *   /exec
 *   /exec?callback=SkyrScoutHeseFredrik
 *
 * Debug (still only public YouTube-derived data; no secret is exposed):
 *   /exec?mode=debug
 */
function doGet(e) {
  const mode = e && e.parameter && e.parameter.mode === "debug"
    ? "debug"
    : "public";

  const props = PropertiesService.getScriptProperties();
  let payload;

  if (mode === "debug") {
    payload = safeJsonParse_(props.getProperty(PROP.DEBUG_STATE), {
      ok: true,
      mode: "debug",
      message: "No poll has completed yet."
    });
  } else {
    payload = safeJsonParse_(props.getProperty(PROP.PUBLIC_STATE), {
      ok: true,
      active: false,
      checkedAt: null,
      message: "No poll has completed yet."
    });
  }

  payload.ok = true;
  payload.mode = mode;

  const callbackRaw = e && e.parameter ? e.parameter.callback : "";
  const callback = sanitizeCallback_(callbackRaw);

  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + JSON.stringify(payload) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(JSON.stringify(payload, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * Handy manual health check in the Apps Script editor.
 */
function logStatus() {
  const props = PropertiesService.getScriptProperties();
  Logger.log(props.getProperty(PROP.DEBUG_STATE) || "No debug state yet.");
}


/* -------------------------- YouTube -------------------------- */

function discoverChannel_() {
  const props = PropertiesService.getScriptProperties();

  if (
    props.getProperty(PROP.CHANNEL_ID) &&
    props.getProperty(PROP.UPLOADS_PLAYLIST_ID)
  ) {
    return;
  }

  const key = getApiKey_();

  const videoData = youtubeGet_("videos", {
    part: "snippet",
    id: HF.SEED_VIDEO_ID,
    key: key
  });

  if (!videoData.items || !videoData.items.length) {
    throw new Error("Could not resolve the SkyrScout channel from the seed video.");
  }

  const channelId = videoData.items[0].snippet.channelId;

  const channelData = youtubeGet_("channels", {
    part: "contentDetails",
    id: channelId,
    key: key
  });

  if (!channelData.items || !channelData.items.length) {
    throw new Error("Could not load the SkyrScout channel.");
  }

  const uploadsPlaylistId =
    channelData.items[0].contentDetails &&
    channelData.items[0].contentDetails.relatedPlaylists &&
    channelData.items[0].contentDetails.relatedPlaylists.uploads;

  if (!uploadsPlaylistId) {
    throw new Error("Could not resolve the channel uploads playlist.");
  }

  props.setProperties({
    [PROP.CHANNEL_ID]: channelId,
    [PROP.UPLOADS_PLAYLIST_ID]: uploadsPlaylistId
  });
}


function ensureCatalogFresh_(now) {
  const props = PropertiesService.getScriptProperties();
  const last = Number(props.getProperty(PROP.CATALOG_REFRESHED_AT) || 0);
  const staleAfter = HF.CATALOG_REFRESH_HOURS * 60 * 60 * 1000;

  if (!props.getProperty(PROP.CATALOG_IDS) || now - last >= staleAfter) {
    refreshCatalog_(false);
  }
}


function refreshCatalog_(forceDiscover) {
  const props = PropertiesService.getScriptProperties();

  if (forceDiscover) {
    discoverChannel_();
  }

  const playlistId = props.getProperty(PROP.UPLOADS_PLAYLIST_ID);
  if (!playlistId) {
    discoverChannel_();
  }

  const key = getApiKey_();
  const ids = [];
  let pageToken = "";

  do {
    const data = youtubeGet_("playlistItems", {
      part: "contentDetails",
      playlistId: props.getProperty(PROP.UPLOADS_PLAYLIST_ID),
      maxResults: 50,
      pageToken: pageToken || undefined,
      key: key
    });

    (data.items || []).forEach(function(item) {
      const id = item.contentDetails && item.contentDetails.videoId;
      if (id) {
        ids.push(id);
      }
    });

    pageToken = data.nextPageToken || "";
  } while (pageToken);

  if (!ids.length) {
    throw new Error("No public uploads were returned.");
  }

  // Video IDs are compact enough that the current SkyrScout catalogue fits safely
  // inside one Script Property. If it ever grows beyond that, split it into chunks.
  props.setProperty(PROP.CATALOG_IDS, ids.join(","));
  props.setProperty(PROP.CATALOG_REFRESHED_AT, String(Date.now()));

  Logger.log("Catalogue refreshed: " + ids.length + " uploads.");
}


function fetchVideoStats_(ids) {
  const key = getApiKey_();
  const output = [];

  chunk_(ids, 50).forEach(function(batch) {
    const data = youtubeGet_("videos", {
      part: "snippet,statistics",
      id: batch.join(","),
      key: key
    });

    (data.items || []).forEach(function(item) {
      output.push(item);
    });
  });

  return output;
}


function youtubeGet_(resource, params) {
  const query = Object.keys(params)
    .filter(function(key) {
      return params[key] !== undefined && params[key] !== null && params[key] !== "";
    })
    .map(function(key) {
      return encodeURIComponent(key) + "=" + encodeURIComponent(String(params[key]));
    })
    .join("&");

  const url = "https://www.googleapis.com/youtube/v3/" + resource + "?" + query;

  const response = UrlFetchApp.fetch(url, {
    method: "get",
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const text = response.getContentText();
  const data = safeJsonParse_(text, null);

  if (status < 200 || status >= 300) {
    const message =
      data && data.error && data.error.message
        ? data.error.message
        : "HTTP " + status;

    throw new Error("YouTube API error: " + message);
  }

  return data;
}


function getApiKey_() {
  const key = PropertiesService
    .getScriptProperties()
    .getProperty(PROP.API_KEY);

  if (!key) {
    throw new Error(
      "Missing Script Property YOUTUBE_API_KEY. Add the existing SkyrScout YouTube API key first."
    );
  }

  return key;
}


/* -------------------------- History -------------------------- */

function historyKey_(videoId) {
  return "HF_H_" + videoId;
}


function loadHistoryFromRaw_(raw) {
  const parsed = safeJsonParse_(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}


function deltaForWindow_(history, now, minutes) {
  if (!history.length) {
    return null;
  }

  const target = now - minutes * 60 * 1000;
  let baseline = null;

  for (let i = 0; i < history.length; i += 1) {
    if (history[i][0] <= target) {
      baseline = history[i];
    } else {
      break;
    }
  }

  if (!baseline) {
    return null;
  }

  const current = history[history.length - 1];
  return Math.max(0, current[1] - baseline[1]);
}


function previousWindowDelta_(history, now, minutes) {
  if (!history.length) {
    return null;
  }

  const windowMs = minutes * 60 * 1000;
  const startTarget = now - 2 * windowMs;
  const endTarget = now - windowMs;
  let startSample = null;
  let endSample = null;

  for (let i = 0; i < history.length; i += 1) {
    const sample = history[i];
    if (sample[0] <= startTarget) {
      startSample = sample;
    }
    if (sample[0] <= endTarget) {
      endSample = sample;
    } else {
      break;
    }
  }

  if (!startSample || !endSample || endSample[0] <= startSample[0]) {
    return null;
  }

  return Math.max(0, endSample[1] - startSample[1]);
}


function clockHourStart_(now) {
  const localHour = Utilities.formatDate(
    new Date(now),
    HF.CLOCK_TIME_ZONE,
    "yyyy-MM-dd'T'HH':00:00'XXX"
  );

  const parsed = new Date(localHour).getTime();
  if (!Number.isFinite(parsed)) {
    throw new Error("Could not resolve clock-hour boundary for " + HF.CLOCK_TIME_ZONE);
  }

  return parsed;
}


function nearestSample_(history, target) {
  if (!history.length) {
    return null;
  }

  let best = null;
  let bestDistance = Infinity;

  for (let i = 0; i < history.length; i += 1) {
    const sample = history[i];
    const distance = Math.abs(sample[0] - target);

    if (distance < bestDistance) {
      best = sample;
      bestDistance = distance;
    }

    if (sample[0] > target && distance > bestDistance) {
      break;
    }
  }

  const maxDistance = Math.max(8, HF.POLL_MINUTES * 2) * 60 * 1000;
  return best && bestDistance <= maxDistance ? best : null;
}


function clockHourMetrics_(history, now) {
  if (!history.length) {
    return {
      timeZone: HF.CLOCK_TIME_ZONE,
      currentHourStart: null,
      previousHourStart: null,
      currentHourMinutesElapsed: null,
      currentHourViews: null,
      previousHourViews: null,
      hourBeforeViews: null
    };
  }

  const hourMs = 60 * 60 * 1000;
  const currentHourStart = clockHourStart_(now);
  const previousHourStart = currentHourStart - hourMs;
  const hourBeforeStart = previousHourStart - hourMs;

  const startCurrent = nearestSample_(history, currentHourStart);
  const startPrevious = nearestSample_(history, previousHourStart);
  const startHourBefore = nearestSample_(history, hourBeforeStart);
  const latest = history[history.length - 1];

  return {
    timeZone: HF.CLOCK_TIME_ZONE,
    currentHourStart: currentHourStart,
    previousHourStart: previousHourStart,
    currentHourMinutesElapsed: Math.max(
      0,
      Math.floor((now - currentHourStart) / (60 * 1000))
    ),
    currentHourViews:
      startCurrent && latest && latest[0] >= startCurrent[0]
        ? Math.max(0, latest[1] - startCurrent[1])
        : null,
    previousHourViews:
      startPrevious && startCurrent && startCurrent[0] > startPrevious[0]
        ? Math.max(0, startCurrent[1] - startPrevious[1])
        : null,
    hourBeforeViews:
      startHourBefore && startPrevious && startPrevious[0] > startHourBefore[0]
        ? Math.max(0, startPrevious[1] - startHourBefore[1])
        : null
  };
}


/* -------------------------- Detection -------------------------- */

function clockHourCandidates_(mover) {
  const hours = mover && mover.clockHours ? mover.clockHours : {};
  return [
    {
      value: hours.currentHourViews,
      kind: "current",
      label: "Current clock hour",
      baseline: hours.previousHourViews,
      baselineLabel: "Previous clock hour"
    },
    {
      value: hours.previousHourViews,
      kind: "previous",
      label: "Previous clock hour",
      baseline: hours.hourBeforeViews,
      baselineLabel: "Hour before previous"
    }
  ];
}


function evaluateAlerts_(movers, now, rules, maxAlerts) {
  const alerts = [];

  movers.forEach(function(mover) {
    (rules || []).forEach(function(rule) {
      if (rule.minutes === 60) {
        clockHourCandidates_(mover).forEach(function(hour) {
          const delta = hour.value;
          if (delta !== null && delta >= rule.minViews) {
            alerts.push({
              videoId: mover.videoId,
              title: mover.title,
              thumbnail: mover.thumbnail,
              videoUrl: mover.videoUrl,
              totalViews: mover.totalViews,
              deltaViews: delta,
              windowMinutes: 60,
              windowType: "clockHour",
              hourKind: hour.kind,
              windowLabel: hour.label,
              thresholdViews: rule.minViews,
              score: delta / rule.minViews,
              detectedAt: now
            });
          }
        });
        return;
      }

      const delta = mover.deltas[String(rule.minutes)];
      if (delta !== null && delta >= rule.minViews) {
        alerts.push({
          videoId: mover.videoId,
          title: mover.title,
          thumbnail: mover.thumbnail,
          videoUrl: mover.videoUrl,
          totalViews: mover.totalViews,
          deltaViews: delta,
          windowMinutes: rule.minutes,
          windowType: "rolling",
          windowLabel: rule.minutes + " minute rolling window",
          thresholdViews: rule.minViews,
          score: delta / rule.minViews,
          detectedAt: now
        });
      }
    });
  });

  const bestByVideo = {};
  alerts.forEach(function(alert) {
    const existing = bestByVideo[alert.videoId];
    if (!existing || alert.score > existing.score) {
      bestByVideo[alert.videoId] = alert;
    }
  });

  return Object.keys(bestByVideo)
    .map(function(id) { return bestByVideo[id]; })
    .sort(function(a, b) {
      return b.score - a.score || b.deltaViews - a.deltaViews;
    })
    .slice(0, Number(maxAlerts || HF.MAX_PUBLIC_ALERTS));
}


function evaluateInternalAlerts_(movers, now, maxAlerts) {
  const candidates = [];

  movers.forEach(function(mover) {
    HF.INTERNAL_ABSOLUTE_RULES.forEach(function(rule) {
      if (rule.minutes === 60) {
        clockHourCandidates_(mover).forEach(function(hour) {
          const delta = hour.value;
          if (delta !== null && delta >= rule.minViews) {
            candidates.push({
              videoId: mover.videoId,
              title: mover.title,
              thumbnail: mover.thumbnail,
              videoUrl: mover.videoUrl,
              totalViews: mover.totalViews,
              deltaViews: delta,
              windowMinutes: 60,
              windowType: "clockHour",
              hourKind: hour.kind,
              windowLabel: hour.label,
              thresholdViews: rule.minViews,
              reason: "absolute",
              baselineViews: hour.baseline,
              baselineLabel: hour.baselineLabel,
              multiple: null,
              score: 2 + delta / rule.minViews,
              detectedAt: now
            });
          }
        });
        return;
      }

      const delta = mover.deltas[String(rule.minutes)];
      if (delta !== null && delta >= rule.minViews) {
        candidates.push({
          videoId: mover.videoId,
          title: mover.title,
          thumbnail: mover.thumbnail,
          videoUrl: mover.videoUrl,
          totalViews: mover.totalViews,
          deltaViews: delta,
          windowMinutes: rule.minutes,
          windowType: "rolling",
          windowLabel: rule.minutes + " minute rolling window",
          thresholdViews: rule.minViews,
          reason: "absolute",
          baselineViews: mover.previousDeltas[String(rule.minutes)],
          baselineLabel: "Previous comparable " + rule.minutes + " minute window",
          multiple: null,
          score: 2 + delta / rule.minViews,
          detectedAt: now
        });
      }
    });

    HF.INTERNAL_RELATIVE_RULES.forEach(function(rule) {
      if (rule.minutes === 60) {
        clockHourCandidates_(mover).forEach(function(hour) {
          const delta = hour.value;
          const baseline = hour.baseline;

          if (delta === null || baseline === null || delta < rule.minViews) {
            return;
          }

          const multiple = baseline === 0 ? Infinity : delta / baseline;
          if (baseline === 0 || multiple >= rule.multiplier) {
            const relativeStrength = baseline === 0
              ? delta / rule.minViews + 1
              : multiple / rule.multiplier;

            candidates.push({
              videoId: mover.videoId,
              title: mover.title,
              thumbnail: mover.thumbnail,
              videoUrl: mover.videoUrl,
              totalViews: mover.totalViews,
              deltaViews: delta,
              windowMinutes: 60,
              windowType: "clockHour",
              hourKind: hour.kind,
              windowLabel: hour.label,
              thresholdViews: rule.minViews,
              reason: "relative",
              baselineViews: baseline,
              baselineLabel: hour.baselineLabel,
              multiple: Number.isFinite(multiple) ? multiple : null,
              score: 3 + relativeStrength,
              detectedAt: now
            });
          }
        });
        return;
      }

      const key = String(rule.minutes);
      const delta = mover.deltas[key];
      const baseline = mover.previousDeltas[key];

      if (delta === null || baseline === null || delta < rule.minViews) {
        return;
      }

      const multiple = baseline === 0 ? Infinity : delta / baseline;
      if (baseline === 0 || multiple >= rule.multiplier) {
        const relativeStrength = baseline === 0
          ? delta / rule.minViews + 1
          : multiple / rule.multiplier;

        candidates.push({
          videoId: mover.videoId,
          title: mover.title,
          thumbnail: mover.thumbnail,
          videoUrl: mover.videoUrl,
          totalViews: mover.totalViews,
          deltaViews: delta,
          windowMinutes: rule.minutes,
          windowType: "rolling",
          windowLabel: rule.minutes + " minute rolling window",
          thresholdViews: rule.minViews,
          reason: "relative",
          baselineViews: baseline,
          baselineLabel: "Previous comparable " + rule.minutes + " minute window",
          multiple: Number.isFinite(multiple) ? multiple : null,
          score: 3 + relativeStrength,
          detectedAt: now
        });
      }
    });
  });

  const bestByVideo = {};
  candidates.forEach(function(alert) {
    const existing = bestByVideo[alert.videoId];
    if (!existing || alert.score > existing.score) {
      bestByVideo[alert.videoId] = alert;
    }
  });

  return Object.keys(bestByVideo)
    .map(function(id) { return bestByVideo[id]; })
    .sort(function(a, b) {
      return b.score - a.score || b.deltaViews - a.deltaViews;
    })
    .slice(0, Number(maxAlerts || HF.MAX_DEBUG_MOVERS));
}


function buildPublicState_(alerts, now, previous) {
  if (alerts.length) {
    return {
      active: true,
      checkedAt: now,
      lastQualifiedAt: now,
      activeUntil: now + HF.HOLD_MINUTES * 60 * 1000,
      alert: alerts[0],
      rules: HF.ALERT_RULES
    };
  }

  if (
    previous &&
    previous.active &&
    Number(previous.activeUntil || 0) > now
  ) {
    previous.checkedAt = now;
    return previous;
  }

  return {
    active: false,
    checkedAt: now,
    alert: null,
    rules: HF.ALERT_RULES
  };
}


function buildDebugState_(movers, alerts, internalAlerts, now) {
  const ranked = movers
    .map(function(mover) {
      const fifteen = mover.deltas["15"];
      const hours = mover.clockHours || {};
      const currentHour = hours.currentHourViews;
      const previousHour = hours.previousHourViews;

      return {
        videoId: mover.videoId,
        title: mover.title,
        thumbnail: mover.thumbnail,
        videoUrl: mover.videoUrl,
        totalViews: mover.totalViews,
        deltaSincePoll: mover.deltaSincePoll,
        delta15m: fifteen,
        previous15m: mover.previousDeltas ? mover.previousDeltas["15"] : null,
        currentHourViews: currentHour,
        previousHourViews: previousHour,
        hourBeforeViews: hours.hourBeforeViews,
        currentHourStart: hours.currentHourStart,
        previousHourStart: hours.previousHourStart,
        currentHourMinutesElapsed: hours.currentHourMinutesElapsed,
        rankValue:
          Math.max(
            fifteen === null ? -1 : fifteen * 4,
            currentHour === null ? -1 : currentHour,
            previousHour === null ? -1 : previousHour,
            mover.deltaSincePoll === null ? -1 : mover.deltaSincePoll * 12
          )
      };
    })
    .sort(function(a, b) {
      return b.rankValue - a.rankValue;
    })
    .slice(0, HF.MAX_DEBUG_MOVERS)
    .map(function(item) {
      delete item.rankValue;
      return item;
    });

  return {
    checkedAt: now,
    videosPolled: movers.length,
    clockTimeZone: HF.CLOCK_TIME_ZONE,
    rules: HF.ALERT_RULES,
    internalRules: {
      note: "15m = rolling; 60m = aligned clock hours",
      absolute: HF.INTERNAL_ABSOLUTE_RULES,
      relative: HF.INTERNAL_RELATIVE_RULES
    },
    activeAlerts: alerts,
    internalAlerts: internalAlerts || [],
    topMovers: ranked
  };
}


/* -------------------------- Helpers -------------------------- */

function parseCatalogIds_(raw) {
  return (raw || "")
    .split(",")
    .map(function(id) {
      return id.trim();
    })
    .filter(Boolean);
}


function thumbnailFor_(video) {
  const thumbs = video.snippet && video.snippet.thumbnails;
  if (!thumbs) {
    return "https://img.youtube.com/vi/" + video.id + "/hqdefault.jpg";
  }

  const selected =
    thumbs.maxres ||
    thumbs.standard ||
    thumbs.high ||
    thumbs.medium ||
    thumbs.default;

  return selected && selected.url
    ? selected.url
    : "https://img.youtube.com/vi/" + video.id + "/hqdefault.jpg";
}


function chunk_(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}


function sanitizeCallback_(value) {
  const callback = String(value || "");
  return /^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(callback)
    ? callback
    : "";
}


function safeJsonParse_(text, fallback) {
  if (!text) {
    return fallback;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return fallback;
  }
}


function deletePollTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "pollYouTube") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}
