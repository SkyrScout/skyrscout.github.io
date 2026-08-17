(function(){
  'use strict';

  const REFRESH_MS = 61 * 1000;
  const SNAPSHOT_SCHEMA = [
    'videoId',
    'totalViews',
    'deltaSincePoll',
    'currentHourViews',
    'previousHourViews',
    'last48hViews',
    'activityStatus'
  ];

  const state = {
    byVideoId: new Map(),
    checkedAt: null,
    videosPolled: null,
    selectedVideoId: null,
    timer: null,
    loading: false
  };

  function numberOrNull(value){
    if(value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function fmtNumber(value){
    const n = numberOrNull(value);
    return n === null ? '—' : n.toLocaleString('en-US');
  }

  function fmtDelta(value){
    const n = numberOrNull(value);
    if(n === null) return '—';
    return (n >= 0 ? '+' : '') + n.toLocaleString('en-US');
  }

  function fmtHistory(value){
    const n = numberOrNull(value);
    return n === null ? 'BUILDING' : n.toLocaleString('en-US');
  }

  function fmtStatus(value){
    const raw = String(value || '').trim();
    return raw ? raw.replace(/[_-]+/g, ' ').toUpperCase() : 'STANDBY';
  }

  function fmtCheckedAt(value){
    if(value === null || value === undefined || value === '') return '—';
    let d;
    if(typeof value === 'number' || /^\d+$/.test(String(value))){
      let n = Number(value);
      if(n < 1e12) n *= 1000;
      d = new Date(n);
    } else {
      d = new Date(value);
    }
    if(Number.isNaN(d.getTime())) return '—';
    try{
      return new Intl.DateTimeFormat('nb-NO', {
        hour:'2-digit', minute:'2-digit', second:'2-digit'
      }).format(d);
    }catch(_){
      return d.toLocaleTimeString();
    }
  }

  function decodeSnapshot(payload){
    const rows = Array.isArray(payload && payload.videoSnapshotRows)
      ? payload.videoSnapshotRows : [];
    const schema = Array.isArray(payload && payload.videoSnapshotSchema) && payload.videoSnapshotSchema.length
      ? payload.videoSnapshotSchema : SNAPSHOT_SCHEMA;
    const index = new Map(schema.map((name, i) => [String(name), i]));
    const out = new Map();

    rows.forEach(row => {
      if(!Array.isArray(row)) return;
      const get = name => row[index.has(name) ? index.get(name) : SNAPSHOT_SCHEMA.indexOf(name)];
      const videoId = String(get('videoId') || '').trim();
      if(!videoId) return;
      out.set(videoId, {
        videoId,
        totalViews: numberOrNull(get('totalViews')),
        deltaSincePoll: numberOrNull(get('deltaSincePoll')),
        currentHourViews: numberOrNull(get('currentHourViews')),
        previousHourViews: numberOrNull(get('previousHourViews')),
        last48hViews: numberOrNull(get('last48hViews')),
        activityStatus: String(get('activityStatus') || '')
      });
    });
    return out;
  }

  function populateLibrary(){
    document.querySelectorAll('[data-video-library-row]').forEach(row => {
      const videoId = String(row.dataset.youtubeId || '').trim();
      const item = state.byVideoId.get(videoId);
      const value = row.querySelector('[data-player-live-value], [data-short-live-value]');
      if(value) value.textContent = item ? fmtNumber(item.totalViews) : '—';
    });
  }

  function setMetric(cardKey, label, value){
    const card = document.querySelector('[data-selected-metric-card="' + cardKey + '"]');
    if(!card) return;
    const labelEl = card.querySelector('span');
    const valueEl = card.querySelector('[data-selected-metric]');
    if(labelEl) labelEl.textContent = label;
    if(valueEl) valueEl.textContent = value;
  }

  function renderTraffic(item){
    const panel = document.getElementById('selectedTrafficPanel');
    const body = document.getElementById('selectedTrafficBody');
    if(!panel || !body) return;

    const badge = panel.querySelector('.ph .badge');
    if(badge) badge.textContent = 'LIVE ACTIVITY';

    body.replaceChildren();

    function section(text){
      const el = document.createElement('div');
      el.className = 'sec';
      el.textContent = text;
      body.appendChild(el);
    }

    function kv(label, value){
      const el = document.createElement('div');
      el.className = 'kv';
      const a = document.createElement('span');
      const b = document.createElement('strong');
      a.textContent = label;
      b.textContent = value;
      el.append(a,b);
      body.appendChild(el);
    }

    section('LIVE ACTIVITY');
    kv('Source', 'YouTube Data API v3');
    kv('Last check', fmtCheckedAt(state.checkedAt));
    kv('Total views', fmtNumber(item.totalViews));
    kv('Since last poll', fmtDelta(item.deltaSincePoll));
    kv('This clock hour', fmtNumber(item.currentHourViews));
    kv('Previous clock hour', fmtHistory(item.previousHourViews));
    kv('Last 48 h', fmtHistory(item.last48hViews));
    kv('Status', fmtStatus(item.activityStatus));
  }

  function inferSelectedVideoId(){
    const selectedRow = document.querySelector('[data-video-library-row].selected');
    if(selectedRow && selectedRow.dataset.youtubeId){
      return String(selectedRow.dataset.youtubeId);
    }

    const thumb = document.getElementById('selectedPlayerThumb');
    if(thumb){
      const m = String(thumb.src || '').match(/\/vi\/([^/?]+)/);
      if(m) return m[1];
    }
    return '';
  }

  function renderSelected(videoId){
    const id = String(
      videoId ||
      state.selectedVideoId ||
      inferSelectedVideoId() ||
      ''
    ).trim();

    if(!id) return;

    state.selectedVideoId = id;
    const item = state.byVideoId.get(id);
    if(!item) return;

    setMetric('views', 'Total views', fmtNumber(item.totalViews));
    setMetric('likes', 'Since last poll', fmtDelta(item.deltaSincePoll));
    setMetric('ctr', 'This hour', fmtNumber(item.currentHourViews));
    setMetric('avgViewDuration', 'Last hour', fmtHistory(item.previousHourViews));
    setMetric('watchTime', 'Last 48h', fmtHistory(item.last48hViews));
    setMetric('uniqueViewers', 'Status', fmtStatus(item.activityStatus));

    const charts = document.getElementById('selectedPlayerCharts');
    if(charts){
      charts.innerHTML =
        '<div class="hf-empty">Live view movement is supplied by the VPS collector. Full YouTube Analytics charts are not connected on this panel.</div>';
    }

    renderTraffic(item);
  }

  function updateRealtimeSummary(payload){
    const panel = document.querySelector(
      '[data-screen="overview"] .topgrid .side .sidepanel'
    );

    if(!panel) return;

    const big = panel.querySelector('.big');
    const sub = panel.querySelector('.sub');

    if(big){
      big.textContent = fmtNumber(payload && payload.videosPolled);
    }

    if(sub){
      sub.textContent =
        'videos monitored · official YouTube Data API';
    }

    const badge = document.getElementById('crRealtimeBadge');

    if(
      badge &&
      (!badge.textContent || /connecting|pending/i.test(badge.textContent))
    ){
      badge.textContent = 'VPS LIVE';
    }
  }

  function applyOverviewLayout(){
    const geoBody = document.querySelector(
      '[data-screen="overview"] .geography-panel-body'
    );

    const geoPanel = geoBody
      ? geoBody.closest('.sidepanel')
      : null;

    if(geoPanel){
      geoPanel.style.display = 'none';
    }

    const side = document.querySelector(
      '[data-screen="overview"] .topgrid .side'
    );

    if(side){
      side.style.gridTemplateRows = 'minmax(0,1fr)';
    }

    const mapBadge = document.querySelector(
      '[data-screen="overview"] .map-scope-badge'
    );

    if(mapBadge){
      mapBadge.textContent =
        'MAP READY · GEOGRAPHY NOT LIVE';
    }
  }

  function renderPayload(payload){
    state.byVideoId = decodeSnapshot(payload || {});

    state.checkedAt =
      (
        payload &&
        (
          payload.videoSnapshotCheckedAt ||
          payload.checkedAt ||
          payload.lastPollAt
        )
      ) || null;

    state.videosPolled =
      numberOrNull(payload && payload.videosPolled);

    applyOverviewLayout();
    updateRealtimeSummary(payload || {});
    populateLibrary();
    renderSelected();
  }

  function backend(){
    const b = window.SkyrScoutStaffBackend;

    return b &&
      typeof b.fetchHeseFredrik === 'function'
      ? b
      : null;
  }

  async function refresh(){
    if(state.loading) return;

    const b = backend();

    if(!b){
      state.timer = window.setTimeout(refresh, 1000);
      return;
    }

    state.loading = true;

    try{
      const payload =
        await b.fetchHeseFredrik('debug');

      renderPayload(payload || {});
    }catch(error){
      console.warn(
        'Control Room VPS Overview:',
        error
      );
    }finally{
      state.loading = false;

      window.clearTimeout(state.timer);

      state.timer =
        window.setTimeout(refresh, REFRESH_MS);
    }
  }

  document.addEventListener(
    'controlroom:videoselected',
    event => {
      const id =
        event && event.detail
          ? String(event.detail.videoId || '')
          : '';

      if(!id) return;

      state.selectedVideoId = id;

      window.setTimeout(
        () => renderSelected(id),
        0
      );
    }
  );

  document.addEventListener(
    'click',
    event => {
      const row =
        event.target && event.target.closest
          ? event.target.closest(
              '[data-video-library-row]'
            )
          : null;

      if(!row) return;

      const id =
        String(row.dataset.youtubeId || '');

      if(!id) return;

      state.selectedVideoId = id;

      window.setTimeout(
        () => renderSelected(id),
        0
      );
    }
  );

  applyOverviewLayout();
  refresh();
})();
