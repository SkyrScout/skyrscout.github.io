(function(){
  'use strict';

  const REFRESH_MS = 60 * 1000;
  const ACK_KEY = 'skyrscout-cr-hf-internal-ack-v4';
  const ACK_TTL_MS = 45 * 60 * 1000;

  const badge = document.getElementById('hfConnectionBadge');
  const statusBox = document.getElementById('controlRoomDataStatus');
  const statusDot = document.getElementById('controlRoomDataDot');
  const moversList = document.getElementById('hfMoversList');
  const moverCount = document.getElementById('hfMoverCount');
  const rulesBody = document.getElementById('hfRulesBody');
  const activeAlertList = document.getElementById('hfActiveAlertList');
  const alertBadge = document.getElementById('hfAlertBadge');
  const detailBody = document.getElementById('hfDetailBody');
  const detailPanel = document.getElementById('hfDetailPanel');
  const detailTypeBadge = document.getElementById('hfSelectedTypeBadge');
  const liveSummary = document.getElementById('hfLiveSummary');
  const overviewList = document.getElementById('crRealtimeList');
  const overviewTitle = document.getElementById('crRealtimeListTitle');
  const overviewBadge = document.getElementById('crRealtimeBadge');
  const filterButtons = Array.from(document.querySelectorAll('[data-hf-filter]'));

  const typeCatalog = new Map();
  document.querySelectorAll('#hfVideoTypeCatalog [data-hf-video-id]').forEach(node => {
    const id = String(node.dataset.hfVideoId || '').trim();
    const type = String(node.dataset.hfVideoType || '').trim();
    if(id && (type === 'video' || type === 'short')) typeCatalog.set(id, type);
  });

  const state = {
    movers: [],
    alerts: [],
    rules: {},
    checkedAt: null,
    videosPolled: null,
    selectedVideoId: null,
    filter: 'all'
  };

  function parseLibraryDate(value){
    const raw = String(value || '').trim();
    if(!raw) return 0;

    const dmy = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
    if(dmy){
      return Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    }

    const iso = Date.parse(raw);
    return Number.isFinite(iso) ? iso : 0;
  }

  function sortVideoLibraryPane(pane){
    if(!pane) return;
    const scroll = pane.querySelector('.player-scroll');
    if(!scroll) return;

    const rows = Array.from(scroll.querySelectorAll('[data-video-library-row]'));
    rows.sort((a,b) => {
      const byDate = parseLibraryDate(b.dataset.siteAdded) - parseLibraryDate(a.dataset.siteAdded);
      if(byDate) return byDate;
      const aTitle = String(a.dataset.playerDisplay || a.dataset.videoTitle || '');
      const bTitle = String(b.dataset.playerDisplay || b.dataset.videoTitle || '');
      return aTitle.localeCompare(bTitle, 'en');
    });
    rows.forEach(row => scroll.appendChild(row));
  }

  function dispatchVideoLibrarySelection(row){
    if(!row) return;
    const format = String(row.dataset.videoFormat || 'long');
    const selectedThumb = document.getElementById('selectedPlayerThumb');
    const selectedThumbFrame = selectedThumb ? selectedThumb.closest('.selthumb') : null;
    if(selectedThumbFrame){
      selectedThumbFrame.classList.toggle('short-format', format === 'short');
    }

    document.dispatchEvent(new CustomEvent('controlroom:videoselected',{
      detail:{
        videoId:String(row.dataset.youtubeId || ''),
        format:format,
        title:String(row.dataset.playerDisplay || row.dataset.videoTitle || ''),
        siteAdded:String(row.dataset.siteAdded || ''),
        url:String(row.dataset.playerUrl || row.dataset.videoUrl || '')
      }
    }));
  }

  function selectShortInOverview(row){
    if(!row) return;

    document.querySelectorAll('[data-video-library-row].selected').forEach(item => item.classList.remove('selected'));
    row.classList.add('selected');

    const title = String(row.dataset.videoTitle || 'SkyrScout Short');
    const videoId = String(row.dataset.youtubeId || '');
    const siteAdded = String(row.dataset.siteAdded || '');
    const badgeEl = document.getElementById('selectedPlayerBadge');
    const thumbEl = document.getElementById('selectedPlayerThumb');
    const nameEl = document.getElementById('selectedPlayerName');
    const metaEl = document.getElementById('selectedPlayerMeta');
    const trafficTitle = document.getElementById('selectedTrafficTitle');

    if(badgeEl) badgeEl.textContent = 'SHORT';
    if(thumbEl){
      const encodedId = encodeURIComponent(videoId);
      thumbEl.onerror = function(){
        this.onerror = null;
        this.src = 'https://i.ytimg.com/vi/' + encodedId + '/mqdefault.jpg';
      };
      thumbEl.src = 'https://i.ytimg.com/vi/' + encodedId + '/maxresdefault.jpg';
      thumbEl.alt = title + ' thumbnail';
    }
    if(nameEl) nameEl.textContent = title;
    if(metaEl) metaEl.innerHTML = 'YouTube Short' + (siteAdded ? '<br/>Added ' + siteAdded : '');
    if(trafficTitle) trafficTitle.textContent = title + ' // Traffic / Audience';

    document.querySelectorAll('[data-selected-metric]').forEach(el => { el.textContent = '—'; });
  }

  function activateVideoLibraryPanel(panel, format){
    if(!panel) return;
    const next = format === 'short' ? 'short' : 'long';
    panel.querySelectorAll('[data-video-library-tab]').forEach(button => {
      const active = button.dataset.videoLibraryTab === next;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    panel.querySelectorAll('[data-video-library-pane]').forEach(pane => {
      pane.hidden = pane.dataset.videoLibraryPane !== next;
    });
  }

  function chooseVideoLibraryRow(row){
    if(!row) return;
    dispatchVideoLibrarySelection(row);
    if(row.dataset.videoFormat === 'short') selectShortInOverview(row);
  }

  function initVideoLibrary(){
    document.querySelectorAll('.video-library-panel [data-video-library-pane]').forEach(sortVideoLibraryPane);
    document.querySelectorAll('.video-library-panel [data-video-library-row]').forEach(row => {
      row.setAttribute('tabindex','0');
      row.setAttribute('role','button');
    });

    // Focus Mode clones panels with cloneNode(true), which does not copy element-level
    // event listeners. Delegate from document so tabs and rows keep working in clones.
    document.addEventListener('click', event => {
      const tab = event.target.closest('[data-video-library-tab]');
      if(tab){
        const panel = tab.closest('.video-library-panel');
        if(panel){
          event.preventDefault();
          event.stopPropagation();
          activateVideoLibraryPanel(panel, tab.dataset.videoLibraryTab);
          return;
        }
      }

      const row = event.target.closest('[data-video-library-row]');
      if(row && row.closest('.video-library-panel')){
        chooseVideoLibraryRow(row);
      }
    });

    document.addEventListener('keydown', event => {
      const row = event.target.closest && event.target.closest('[data-video-library-row]');
      if(!row || !row.closest('.video-library-panel')) return;
      if(event.key === 'Enter' || event.key === ' '){
        event.preventDefault();
        chooseVideoLibraryRow(row);
      }
    });

    document.querySelectorAll('.video-library-panel').forEach(panel => {
      activateVideoLibraryPanel(panel, 'long');
    });
  }

  let activeRequestToken = 0;

  function numericOrNull(value){
    if(value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function fmtNumber(value){
    const n = numericOrNull(value);
    return n === null ? '—' : n.toLocaleString('en-US');
  }

  function fmtDelta(value){
    const n = numericOrNull(value);
    if(n === null) return '—';
    return (n >= 0 ? '+' : '') + n.toLocaleString('en-US');
  }

  function fmtTime(ms){
    const n = Number(ms);
    if(!Number.isFinite(n)) return '—';
    try{
      return new Intl.DateTimeFormat('nb-NO',{hour:'2-digit',minute:'2-digit'}).format(new Date(n));
    }catch(_){
      return '—';
    }
  }

  function setStatus(kind, text){
    if(badge) badge.textContent = text;
    if(statusBox){
      while(statusBox.childNodes.length > 1) statusBox.removeChild(statusBox.lastChild);
      statusBox.appendChild(document.createTextNode(text));
    }
    if(statusDot){
      statusDot.classList.remove('warn','error');
      if(kind === 'warn') statusDot.classList.add('warn');
      if(kind === 'error') statusDot.classList.add('error');
    }
  }

  function clear(el){
    while(el && el.firstChild) el.removeChild(el.firstChild);
  }

  function videoType(item){
    const id = String(item && item.videoId || '');
    if(typeCatalog.has(id)) return typeCatalog.get(id);
    if(/\/shorts\//i.test(String(item && item.videoUrl || ''))) return 'short';
    return 'video';
  }

  function typeLabel(item){
    return videoType(item) === 'short' ? 'SHORT' : 'VIDEO';
  }

  function mergedVideo(videoId){
    const mover = state.movers.find(item => item && item.videoId === videoId) || null;
    const alert = state.alerts.find(item => item && item.videoId === videoId) || null;
    if(!mover && !alert) return null;
    return Object.assign({}, mover || {}, alert || {}, {
      videoId,
      _mover: mover,
      _alert: alert
    });
  }

  function isActiveAlert(videoId){
    return state.alerts.some(alert => alert && alert.videoId === videoId);
  }

  function bestOverviewDelta(mover){
    const currentHour = numericOrNull(mover && mover.currentHourViews);
    const previousHour = numericOrNull(mover && mover.previousHourViews);
    const d15 = numericOrNull(mover && mover.delta15m);
    const poll = numericOrNull(mover && mover.deltaSincePoll);
    const candidates = [];

    if(currentHour !== null) candidates.push({value:currentHour,label:'CURRENT HOUR',weight:currentHour});
    if(previousHour !== null) candidates.push({value:previousHour,label:'PREVIOUS HOUR',weight:previousHour});
    if(d15 !== null) candidates.push({value:d15,label:'15 M',weight:d15 * 4});
    if(candidates.length){
      candidates.sort((a,b) => b.weight - a.weight);
      return candidates[0];
    }
    if(poll !== null) return {value:poll,label:'LAST POLL',weight:poll};
    return {value:null,label:'LIVE',weight:0};
  }

  function alertSignature(alert){
    if(!alert) return '';
    return [
      alert.videoId || '',
      alert.windowType || '',
      alert.hourKind || '',
      alert.windowMinutes || '',
      alert.reason || '',
      alert.deltaViews || ''
    ].join(':');
  }

  function getAcks(){
    try{
      const parsed = JSON.parse(localStorage.getItem(ACK_KEY) || '[]');
      const list = Array.isArray(parsed) ? parsed : [];
      const fresh = list.filter(item =>
        item && item.sig && item.at && Date.now() - Number(item.at) <= ACK_TTL_MS
      ).slice(-30);
      if(fresh.length !== list.length){
        localStorage.setItem(ACK_KEY, JSON.stringify(fresh));
      }
      return fresh;
    }catch(_){
      return [];
    }
  }

  function isAcked(alert){
    const sig = alertSignature(alert);
    return Boolean(sig && getAcks().some(item => item.sig === sig));
  }

  function setAck(alert){
    const sig = alertSignature(alert);
    if(!sig) return;
    try{
      const list = getAcks().filter(item => item.sig !== sig);
      list.push({sig,at:Date.now()});
      localStorage.setItem(ACK_KEY, JSON.stringify(list.slice(-30)));
    }catch(_){ }
  }

  function windowLabel(alert){
    if(alert && alert.windowType === 'clockHour'){
      return alert.hourKind === 'previous' ? 'previous clock hour' : 'current clock hour';
    }
    return String(Number(alert && alert.windowMinutes) || 15) + ' min';
  }

  function shortWindowLabel(alert){
    if(alert && alert.windowType === 'clockHour'){
      return alert.hourKind === 'previous' ? 'PREV HR' : 'CURR HR';
    }
    return String(Number(alert && alert.windowMinutes) || 15) + ' M';
  }

  function baselineText(alert){
    const baseline = alert && alert.baselineViews !== null && alert.baselineViews !== undefined
      ? Number(alert.baselineViews)
      : null;
    const multiple = alert && alert.multiple !== null && alert.multiple !== undefined
      ? Number(alert.multiple)
      : null;
    const label = (alert && alert.baselineLabel) ||
      (alert && alert.windowType === 'clockHour' ? 'Hour before previous' : 'Previous comparable window');

    if(Number.isFinite(baseline)){
      if(alert && alert.reason === 'relative' && Number.isFinite(multiple)){
        return label + ': ' + baseline.toLocaleString('en-US') + ' · ' + multiple.toFixed(1) + '× pace';
      }
      return label + ': ' + baseline.toLocaleString('en-US');
    }
    return alert && alert.reason === 'absolute' ? 'Absolute spike rule' : 'Relative activity spike';
  }

  function openHeseVideo(videoId){
    const tab = document.querySelector('[data-screen-target="hese-fredrik"]');
    if(tab && typeof tab.click === 'function') tab.click();

    window.setTimeout(() => {
      selectVideo(videoId, {scroll:true});
    }, 60);
  }

  function ensureOverlay(){
    let overlay = document.getElementById('hfInternalOverlay');
    if(overlay) return overlay;

    overlay = document.createElement('aside');
    overlay.id = 'hfInternalOverlay';
    overlay.className = 'hf-internal-overlay';
    overlay.setAttribute('aria-live','assertive');
    overlay.setAttribute('aria-atomic','true');
    overlay.innerHTML = [
      '<div class="hf-internal-top">',
        '<div><span class="hf-internal-beacon"></span><span class="hf-internal-kicker">HESE-FREDRIK // INTERNAL ALERT</span></div>',
        '<button type="button" class="hf-internal-close" aria-label="Acknowledge Hese-Fredrik alert">×</button>',
      '</div>',
      '<div class="hf-internal-body">',
        '<img class="hf-internal-thumb" alt="">',
        '<div class="hf-internal-copy">',
          '<strong class="hf-internal-title">YouTube video</strong>',
          '<div class="hf-internal-movement"></div>',
          '<div class="hf-internal-baseline"></div>',
          '<div class="hf-internal-more" hidden></div>',
          '<div class="hf-internal-actions">',
            '<button type="button" class="hf-internal-ack">ACK</button>',
            '<button type="button" class="hf-internal-open">OPEN HESE-FREDRIK</button>',
          '</div>',
        '</div>',
      '</div>'
    ].join('');

    document.body.appendChild(overlay);

    function acknowledge(){
      if(overlay._currentAlert) setAck(overlay._currentAlert);
      overlay.classList.remove('is-open');
    }

    overlay.querySelector('.hf-internal-close').addEventListener('click', acknowledge);
    overlay.querySelector('.hf-internal-ack').addEventListener('click', acknowledge);
    overlay.querySelector('.hf-internal-open').addEventListener('click', () => {
      const alert = overlay._currentAlert;
      if(!alert) return;
      setAck(alert);
      overlay.classList.remove('is-open');
      openHeseVideo(alert.videoId);
    });
    return overlay;
  }

  function showInternalOverlay(alerts){
    const list = Array.isArray(alerts) ? alerts : [];
    if(!list.length) return;

    const alert = list.find(item => !isAcked(item));
    if(!alert) return;

    const overlay = ensureOverlay();
    const sig = alertSignature(alert);
    const sameOpen = overlay.classList.contains('is-open') && overlay.dataset.alertSig === sig;
    overlay._currentAlert = alert;
    overlay.dataset.alertSig = sig;

    overlay.querySelector('.hf-internal-title').textContent = alert.title || 'YouTube video';
    overlay.querySelector('.hf-internal-movement').textContent =
      fmtDelta(alert.deltaViews) + ' views · ' + windowLabel(alert);
    overlay.querySelector('.hf-internal-baseline').textContent = baselineText(alert);

    const moreCount = Math.max(0, list.length - 1);
    const more = overlay.querySelector('.hf-internal-more');
    more.hidden = moreCount === 0;
    more.textContent = moreCount
      ? '+' + moreCount + ' more active alert' + (moreCount === 1 ? '' : 's') + ' in Hese-Fredrik'
      : '';

    const thumb = overlay.querySelector('.hf-internal-thumb');
    thumb.src = alert.thumbnail || ('https://img.youtube.com/vi/' + encodeURIComponent(alert.videoId || '') + '/hqdefault.jpg');
    thumb.alt = alert.title || 'Hese-Fredrik alert thumbnail';

    overlay.classList.add('is-open');
    if(!sameOpen){
      document.body.classList.remove('hf-alert-flash');
      void document.body.getBoundingClientRect();
      document.body.classList.add('hf-alert-flash');
      window.setTimeout(() => document.body.classList.remove('hf-alert-flash'), 1900);
    }
  }

  function hideOverlayIfClear(alerts){
    if(Array.isArray(alerts) && alerts.length) return;
    const overlay = document.getElementById('hfInternalOverlay');
    if(overlay) overlay.classList.remove('is-open');
    try{ localStorage.removeItem(ACK_KEY); }catch(_){ }
  }

  function renderOverviewMovers(items, internalAlerts){
    if(!overviewList) return;
    const movers = Array.isArray(items) ? items : [];
    const activeIds = new Set((internalAlerts || []).map(a => a.videoId));

    clear(overviewList);

    if(!movers.length){
      if(overviewTitle) overviewTitle.textContent = 'MOVING NOW';
      if(overviewBadge) overviewBadge.textContent = internalAlerts.length ? 'ALERT' : 'LIVE';
      const empty = document.createElement('div');
      empty.className = 'hf-empty';
      empty.textContent = 'No mover data returned yet.';
      overviewList.appendChild(empty);
      return;
    }

    const first = bestOverviewDelta(movers[0]);
    if(overviewTitle) overviewTitle.textContent = internalAlerts.length ? 'HESE-FREDRIK · MOVING NOW' : 'MOVING NOW · ' + first.label;
    if(overviewBadge) overviewBadge.textContent = internalAlerts.length ? 'ALERT' : 'LIVE';

    movers.forEach(item => {
      const d = bestOverviewDelta(item);
      const row = document.createElement('div');
      row.className = 'rtrow live-mover' + (activeIds.has(item.videoId) ? ' live-alert' : '');
      const name = document.createElement('span');
      name.textContent = item.title || item.videoId || 'YouTube video';
      name.title = name.textContent;
      const value = document.createElement('b');
      value.textContent = d.value === null ? '—' : '+' + d.value.toLocaleString('en-US');
      row.append(name,value);
      overviewList.appendChild(row);
    });
  }

  function filteredMovers(){
    if(state.filter === 'all') return state.movers.slice();
    return state.movers.filter(item => videoType(item) === state.filter);
  }

  function updateFilterButtons(){
    filterButtons.forEach(button => {
      const active = button.dataset.hfFilter === state.filter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function renderMovers(){
    if(!moversList) return;
    clear(moversList);

    const movers = filteredMovers();
    if(moverCount){
      moverCount.textContent = state.filter === 'all'
        ? fmtNumber(state.movers.length) + ' moving'
        : fmtNumber(movers.length) + ' of ' + fmtNumber(state.movers.length);
    }

    if(!movers.length){
      const empty = document.createElement('div');
      empty.className = 'hf-empty';
      empty.textContent = state.filter === 'all'
        ? 'No mover data returned yet.'
        : 'No ' + (state.filter === 'short' ? 'Shorts' : 'videos') + ' are moving in the current feed.';
      moversList.appendChild(empty);
      return;
    }

    movers.forEach(item => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'hf-mover';
      if(state.selectedVideoId === item.videoId) row.classList.add('selected');
      if(isActiveAlert(item.videoId)) row.classList.add('is-alert');
      row.dataset.videoId = item.videoId || '';

      const main = document.createElement('div');
      main.className = 'hf-mover-main';

      const img = document.createElement('img');
      img.src = item.thumbnail || ('https://img.youtube.com/vi/' + encodeURIComponent(item.videoId || '') + '/mqdefault.jpg');
      img.alt = '';
      img.loading = 'lazy';

      const copy = document.createElement('div');
      copy.className = 'hf-mover-copy';

      const strong = document.createElement('strong');
      strong.textContent = item.title || item.videoId || 'YouTube video';

      const meta = document.createElement('div');
      meta.className = 'hf-mover-meta';

      const type = document.createElement('span');
      type.className = 'hf-type-pill ' + videoType(item);
      type.textContent = typeLabel(item);
      meta.appendChild(type);

      if(isActiveAlert(item.videoId)){
        const alertPill = document.createElement('span');
        alertPill.className = 'hf-alert-pill';
        alertPill.textContent = 'ALERT';
        meta.appendChild(alertPill);
      }

      copy.append(strong,meta);
      main.append(img,copy);
      row.appendChild(main);

      const values = [
        ['total', item.totalViews, fmtNumber],
        ['d15', item.delta15m, fmtDelta],
        ['current', item.currentHourViews, fmtDelta],
        ['previous', item.previousHourViews, fmtDelta]
      ];

      values.forEach(([name,value,formatter]) => {
        const el = document.createElement('div');
        el.className = 'hf-mover-value ' + name + (name === 'd15' || name === 'current' || name === 'previous' ? ' delta' : '');
        el.textContent = formatter(value);
        row.appendChild(el);
      });

      row.addEventListener('click', () => selectVideo(item.videoId));
      moversList.appendChild(row);
    });
  }

  function renderActiveAlerts(){
    if(!activeAlertList) return;
    clear(activeAlertList);

    if(!state.alerts.length){
      if(alertBadge) alertBadge.textContent = 'Standby';
      const empty = document.createElement('div');
      empty.className = 'hf-empty';
      empty.textContent = 'No active Hese-Fredrik alert.';
      activeAlertList.appendChild(empty);
      return;
    }

    if(alertBadge){
      alertBadge.textContent = state.alerts.length === 1
        ? '1 ACTIVE'
        : state.alerts.length + ' ACTIVE';
    }

    state.alerts.forEach(alert => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'hf-active-card';
      if(state.selectedVideoId === alert.videoId) card.classList.add('selected');

      const img = document.createElement('img');
      img.src = alert.thumbnail || ('https://img.youtube.com/vi/' + encodeURIComponent(alert.videoId || '') + '/mqdefault.jpg');
      img.alt = '';

      const copy = document.createElement('div');
      copy.className = 'hf-active-card-copy';

      const title = document.createElement('strong');
      title.textContent = alert.title || alert.videoId || 'SkyrScout video';

      const small = document.createElement('small');
      small.textContent = typeLabel(alert) + ' · ' + windowLabel(alert) + ' · ' + baselineText(alert);

      copy.append(title,small);

      const delta = document.createElement('div');
      delta.className = 'hf-active-delta';
      delta.textContent = fmtDelta(alert.deltaViews);

      card.append(img,copy,delta);
      card.addEventListener('click', () => selectVideo(alert.videoId, {scroll:true}));
      activeAlertList.appendChild(card);
    });
  }

  function metric(label, value, hot){
    const box = document.createElement('div');
    box.className = 'hf-detail-metric' + (hot ? ' hot' : '');
    const span = document.createElement('span');
    span.textContent = label;
    const strong = document.createElement('strong');
    strong.textContent = value;
    box.append(span,strong);
    return box;
  }

  function renderDetail(){
    if(!detailBody) return;
    clear(detailBody);

    let item = state.selectedVideoId ? mergedVideo(state.selectedVideoId) : null;
    if(!item){
      const fallback = state.alerts[0] || filteredMovers()[0] || state.movers[0] || null;
      if(fallback){
        state.selectedVideoId = fallback.videoId;
        item = mergedVideo(fallback.videoId);
      }
    }

    if(!item){
      if(detailTypeBadge) detailTypeBadge.textContent = '—';
      const empty = document.createElement('div');
      empty.className = 'hf-empty';
      empty.textContent = 'Select a moving video or active alert.';
      detailBody.appendChild(empty);
      return;
    }

    const alert = item._alert;
    const type = typeLabel(item);
    if(detailTypeBadge){
      detailTypeBadge.textContent = alert ? type + ' · ALERT' : type;
    }

    const head = document.createElement('div');
    head.className = 'hf-detail-head';

    const img = document.createElement('img');
    img.src = item.thumbnail || ('https://img.youtube.com/vi/' + encodeURIComponent(item.videoId || '') + '/hqdefault.jpg');
    img.alt = item.title || 'Selected Hese-Fredrik video';

    const copy = document.createElement('div');
    copy.className = 'hf-detail-copy';

    const h2 = document.createElement('h2');
    h2.textContent = item.title || item.videoId || 'YouTube video';

    const p = document.createElement('p');
    p.textContent = 'YouTube ID: ' + (item.videoId || '—') + ' · last feed check ' + fmtTime(state.checkedAt);

    const flags = document.createElement('div');
    flags.className = 'hf-detail-flags';

    const typePill = document.createElement('span');
    typePill.className = 'hf-type-pill ' + videoType(item);
    typePill.textContent = type;
    flags.appendChild(typePill);

    if(alert){
      const alertPill = document.createElement('span');
      alertPill.className = 'hf-alert-pill';
      alertPill.textContent = shortWindowLabel(alert) + ' ALERT';
      flags.appendChild(alertPill);
    }

    copy.append(h2,p,flags);
    head.append(img,copy);

    const metrics = document.createElement('div');
    metrics.className = 'hf-detail-metrics';
    metrics.append(
      metric('Total views', fmtNumber(item.totalViews), false),
      metric('Since last poll', fmtDelta(item.deltaSincePoll), false),
      metric('Last 15 min', fmtDelta(item.delta15m), Boolean(alert && Number(alert.windowMinutes) === 15)),
      metric('Current clock hour', fmtDelta(item.currentHourViews), Boolean(alert && alert.windowType === 'clockHour' && alert.hourKind !== 'previous')),
      metric('Previous clock hour', fmtDelta(item.previousHourViews), Boolean(alert && alert.windowType === 'clockHour' && alert.hourKind === 'previous')),
      metric('Alert status', alert ? 'ACTIVE' : 'STANDBY', Boolean(alert))
    );

    detailBody.append(head,metrics);

    if(alert){
      const alertBox = document.createElement('div');
      alertBox.className = 'hf-detail-alert';
      const title = document.createElement('strong');
      title.textContent = fmtDelta(alert.deltaViews) + ' views · ' + windowLabel(alert);
      const note = document.createElement('p');
      note.textContent = baselineText(alert);
      alertBox.append(title,note);
      detailBody.appendChild(alertBox);
    }

    const actions = document.createElement('div');
    actions.className = 'hf-detail-actions';
    const youtube = document.createElement('a');
    youtube.className = 'hf-detail-link';
    youtube.href = item.videoUrl || ('https://www.youtube.com/watch?v=' + encodeURIComponent(item.videoId || ''));
    youtube.target = '_blank';
    youtube.rel = 'noopener noreferrer';
    youtube.textContent = 'OPEN ON YOUTUBE';
    actions.appendChild(youtube);
    detailBody.appendChild(actions);
  }

  function selectVideo(videoId, options){
    if(!videoId) return;
    state.selectedVideoId = videoId;
    renderActiveAlerts();
    renderMovers();
    renderDetail();

    if(options && options.scroll && detailPanel){
      window.setTimeout(() => {
        try{
          detailPanel.scrollIntoView({behavior:'smooth',block:'center'});
        }catch(_){
          detailPanel.scrollIntoView();
        }
      }, 20);
    }
  }

  function renderRules(internalRules){
    if(!rulesBody) return;
    clear(rulesBody);

    const absolute = internalRules && Array.isArray(internalRules.absolute) ? internalRules.absolute : [];
    const relative = internalRules && Array.isArray(internalRules.relative) ? internalRules.relative : [];
    const rules = [];

    absolute.forEach(rule => {
      const label = Number(rule.minutes) === 60 ? 'Clock-hour absolute' : String(rule.minutes) + ' min absolute';
      rules.push([label, '+' + fmtNumber(rule.minViews) + ' views']);
    });
    relative.forEach(rule => {
      const label = Number(rule.minutes) === 60 ? 'Clock-hour relative' : String(rule.minutes) + ' min relative';
      rules.push([label, '+' + fmtNumber(rule.minViews) + ' & ≥' + Number(rule.multiplier || 0).toFixed(1) + '×']);
    });

    if(!rules.length){
      const empty = document.createElement('div');
      empty.className = 'hf-empty';
      empty.textContent = 'No internal alert rules returned.';
      rulesBody.appendChild(empty);
      return;
    }

    rules.forEach(([labelText,valueText]) => {
      const row = document.createElement('div');
      row.className = 'hf-rule';
      const label = document.createElement('span');
      label.textContent = labelText;
      const value = document.createElement('strong');
      value.textContent = valueText;
      row.append(label,value);
      rulesBody.appendChild(row);
    });
  }

  function render(payload){
    if(!payload || payload.ok === false) throw new Error('Invalid Hese-Fredrik payload');

    const videos = document.getElementById('hfVideosPolled');
    const alertsCount = document.getElementById('hfActiveAlerts');
    const checked = document.getElementById('hfCheckedAt');

    state.alerts = Array.isArray(payload.internalAlerts) ? payload.internalAlerts : [];
    state.movers = Array.isArray(payload.topMovers) ? payload.topMovers : [];
    state.rules = payload.internalRules || {};
    state.checkedAt = payload.checkedAt;
    state.videosPolled = payload.videosPolled;

    if(videos) videos.textContent = fmtNumber(payload.videosPolled);
    if(alertsCount) alertsCount.textContent = fmtNumber(state.alerts.length);
    if(checked) checked.textContent = fmtTime(payload.checkedAt);

    if(liveSummary){
      liveSummary.textContent = state.alerts.length
        ? state.alerts.length + ' active alert' + (state.alerts.length === 1 ? '' : 's') + ' across ' + fmtNumber(payload.videosPolled) + ' polled videos'
        : 'Monitoring ' + fmtNumber(payload.videosPolled) + ' videos · no active alerts';
    }

    if(!state.selectedVideoId || !mergedVideo(state.selectedVideoId)){
      const first = state.alerts[0] || state.movers[0] || null;
      state.selectedVideoId = first ? first.videoId : null;
    }

    updateFilterButtons();
    renderActiveAlerts();
    renderMovers();
    renderDetail();
    renderRules(state.rules);
    renderOverviewMovers(state.movers, state.alerts);

    if(state.alerts.length){
      const lead = state.alerts[0];
      setStatus('warn','Hese-Fredrik går! · ' + (lead.title || 'video') + ' ' + fmtDelta(lead.deltaViews) + ' / ' + shortWindowLabel(lead));
      showInternalOverlay(state.alerts);
    }else{
      setStatus('ok','Hese-Fredrik live · ' + fmtTime(payload.checkedAt));
      hideOverlayIfClear(state.alerts);
    }
  }

  function setFeedMessage(message, isError){
    if(moversList){
      clear(moversList);
      const empty = document.createElement('div');
      empty.className = 'hf-empty' + (isError ? ' hf-error' : '');
      empty.textContent = message;
      moversList.appendChild(empty);
    }
  }

  function fail(message){
    setStatus('error','Hese-Fredrik offline');
    if(badge) badge.textContent = 'Offline';
    if(liveSummary) liveSummary.textContent = 'Hese-Fredrik feed unavailable';
    setFeedMessage(message || 'Could not reach the Hese-Fredrik endpoint.', true);
  }

  function renderPublicFallback(payload, reason){
    if(!payload || payload.ok === false){
      throw new Error('Invalid public Hese-Fredrik payload');
    }

    if(badge) badge.textContent = 'Backend live';
    const checked = document.getElementById('hfCheckedAt');
    const alertsCount = document.getElementById('hfActiveAlerts');
    const videos = document.getElementById('hfVideosPolled');
    if(checked) checked.textContent = fmtTime(payload.checkedAt);
    if(alertsCount) alertsCount.textContent = payload.active === true ? '1 public' : '0 public';
    if(videos) videos.textContent = '—';
    if(liveSummary) liveSummary.textContent = 'Public feed answered · internal debug feed unavailable';

    state.movers = [];
    state.alerts = [];
    state.checkedAt = payload.checkedAt;
    state.selectedVideoId = null;

    setStatus('warn','Hese-Fredrik backend live · Control Room feed unavailable');
    setFeedMessage('The public Hese-Fredrik feed answered, but the Control Room debug feed did not. ' + (reason || ''), false);

    if(activeAlertList){
      clear(activeAlertList);
      const empty = document.createElement('div');
      empty.className = 'hf-empty';
      empty.textContent = payload.active === true
        ? 'Public Hese-Fredrik is active. Internal alert details require the debug feed.'
        : 'Public backend is live. No public alarm is active.';
      activeAlertList.appendChild(empty);
    }
    if(alertBadge) alertBadge.textContent = payload.active === true ? 'PUBLIC ACTIVE' : 'Standby';

    if(detailBody){
      clear(detailBody);
      const empty = document.createElement('div');
      empty.className = 'hf-empty';
      empty.textContent = 'Selected-signal detail requires the Control Room debug feed.';
      detailBody.appendChild(empty);
    }

    if(rulesBody){
      clear(rulesBody);
      const empty = document.createElement('div');
      empty.className = 'hf-empty';
      empty.textContent = 'Internal rules require the debug feed.';
      rulesBody.appendChild(empty);
    }
  }

  function staffBackend(){
    const backend = window.SkyrScoutStaffBackend;
    if(!backend || typeof backend.fetchHeseFredrik !== 'function'){
      throw new Error('Authenticated Staff backend is not available.');
    }
    return backend;
  }

  async function requestPublicFallback(token, reason){
    try{
      const payload = await staffBackend().fetchHeseFredrik('public');
      if(token !== activeRequestToken) return;
      renderPublicFallback(payload || {}, reason);
    }catch(error){
      if(token !== activeRequestToken) return;
      console.warn('Control Room public Hese-Fredrik fallback:', error);
      fail('Neither the Control Room feed nor the public Hese-Fredrik feed could be loaded through the Staff backend.');
    }
  }

  async function load(){
    activeRequestToken += 1;
    const token = activeRequestToken;

    try{
      const payload = await staffBackend().fetchHeseFredrik('debug');
      if(token !== activeRequestToken) return;

      try{
        render(payload || {});
      }catch(error){
        console.warn('Control Room live feed render:', error);
        await requestPublicFallback(token, 'Debug payload was returned but could not be rendered.');
      }
    }catch(error){
      if(token !== activeRequestToken) return;
      console.warn('Control Room Staff backend:', error);
      await requestPublicFallback(token, 'Debug feed request failed.');
    }
  }

  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      const next = button.dataset.hfFilter;
      if(next !== 'all' && next !== 'video' && next !== 'short') return;
      state.filter = next;
      updateFilterButtons();
      renderMovers();
    });
  });

  initVideoLibrary();
  load();
  window.setInterval(load, REFRESH_MS);
  document.addEventListener('controlroom:screenchange', event => {
    if(event.detail && event.detail.screen === 'hese-fredrik') load();
  });

  window.SkyrScoutHeseFredrik = Object.freeze({
    openVideo: openHeseVideo,
    refresh: load
  });
})();
