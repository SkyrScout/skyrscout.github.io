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
    suspicious: [],
    rules: {},
    checkedAt: null,
    videosPolled: null,
    selectedVideoId: null,
    filter: 'all',
    mostLiked: [],
    mostLiked24h: [],
    mostLiked7d: [],
    likesHistory: {},
    likeWindow: '24h'
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
    const suspicious = state.suspicious.find(item => item && item.videoId === videoId) || null;
    const alert = state.alerts.find(item => item && item.videoId === videoId) || null;
    if(!mover && !suspicious && !alert) return null;
    return Object.assign({}, mover || {}, suspicious || {}, alert || {}, {
      videoId,
      _mover: mover,
      _suspicious: suspicious,
      _alert: alert
    });
  }

  function isActiveAlert(videoId){
    return state.alerts.some(alert => alert && alert.videoId === videoId);
  }

  function isSuspicious(videoId){
    return state.suspicious.some(signal => signal && signal.videoId === videoId);
  }

  function signalFor(item){
    if(!item) return null;
    return item._alert || item._suspicious || item.signal || null;
  }

  function activityStatus(item){
    if(!item) return 'STANDBY';
    if(item._alert || item.signalLevel === 'ALARM' || isActiveAlert(item.videoId)) return 'ALARM';
    if(item._suspicious || item.signalLevel === 'SUSPICIOUS' || isSuspicious(item.videoId)) return 'SUSPICIOUS';
    const explicit = String(item.activityStatus || '').toUpperCase();
    if(explicit) return explicit;
    const poll = numericOrNull(item.deltaSincePoll);
    const current = numericOrNull(item.currentHourViews);
    const previous = numericOrNull(item.previousHourViews);
    if((poll !== null && poll > 0) || (current !== null && current > 0)) return 'MOVING';
    if(previous !== null && previous > 0) return 'RECENT';
    return 'STANDBY';
  }

  function bestOverviewDelta(mover){
    const signal = signalFor(mergedVideo(mover && mover.videoId));
    if(signal && numericOrNull(signal.deltaViews) !== null){
      return {value:numericOrNull(signal.deltaViews),label:activityStatus(mover)};
    }
    const poll = numericOrNull(mover && mover.deltaSincePoll);
    const currentHour = numericOrNull(mover && mover.currentHourViews);
    if(poll !== null && poll > 0) return {value:poll,label:'LAST POLL'};
    if(currentHour !== null && currentHour > 0) return {value:currentHour,label:'THIS HOUR'};
    return {value:null,label:activityStatus(mover)};
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
    if(!alert) return 'activity';
    if(alert.windowLabel) return String(alert.windowLabel).toLowerCase();
    if(alert.windowType === 'clockHour'){
      return alert.hourKind === 'previous' ? 'previous clock hour' : 'current clock hour';
    }
    if(alert.windowType === 'poll') return 'last poll';
    if(Number(alert.windowMinutes) === 60) return 'clock hour';
    return 'activity';
  }

  function shortWindowLabel(alert){
    if(!alert) return 'SIGNAL';
    if(alert.windowType === 'clockHour'){
      return alert.hourKind === 'previous' ? 'LAST HR' : 'THIS HR';
    }
    if(alert.windowType === 'poll') return 'LAST POLL';
    return 'SIGNAL';
  }

  function baselineText(alert){
    if(!alert) return '';
    if(alert.reason === 'batchJump') return 'Possible delayed YouTube counter batch';
    if(alert.reason === 'rollback') return 'YouTube counter adjustment detected';
    if(alert.reason === 'unconfirmedHour') return 'Hour movement is not confirmed strongly enough for an alarm';

    const baseline = alert.baselineViews !== null && alert.baselineViews !== undefined
      ? Number(alert.baselineViews)
      : null;
    const multiple = alert.multiple !== null && alert.multiple !== undefined
      ? Number(alert.multiple)
      : null;
    const label = alert.baselineLabel ||
      (alert.windowType === 'clockHour' ? 'Hour before previous' : 'Comparison');

    if(Number.isFinite(baseline)){
      if(alert.reason === 'relative' && Number.isFinite(multiple)){
        return label + ': ' + baseline.toLocaleString('en-US') + ' · ' + multiple.toFixed(1) + '× pace';
      }
      return label + ': ' + baseline.toLocaleString('en-US');
    }
    if(alert.reason === 'absolute') return 'Absolute alarm threshold reached';
    if(alert.reason === 'relative') return 'Relative activity threshold reached';
    return alert.confidence ? 'Confidence: ' + String(alert.confidence).toUpperCase() : 'Activity signal';
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

  function renderOverviewMovers(items, internalAlerts, suspiciousSignals){
    if(!overviewList) return;
    const activeIds = new Set((internalAlerts || []).map(a => a.videoId));
    const suspiciousIds = new Set((suspiciousSignals || []).map(a => a.videoId));
    const movers = (Array.isArray(items) ? items : []).filter(item => {
      const poll = numericOrNull(item && item.deltaSincePoll);
      const current = numericOrNull(item && item.currentHourViews);
      return activeIds.has(item.videoId) || suspiciousIds.has(item.videoId) ||
        (poll !== null && poll > 0) || (current !== null && current > 0);
    });

    clear(overviewList);
    if(overviewTitle) overviewTitle.textContent = 'ACTIVITY RADAR';
    if(overviewBadge) overviewBadge.textContent = internalAlerts.length ? 'ALARM' : suspiciousSignals.length ? 'WATCH' : 'LIVE';

    if(!movers.length){
      const empty = document.createElement('div');
      empty.className = 'hf-empty';
      empty.textContent = 'No current counter movement.';
      overviewList.appendChild(empty);
      return;
    }

    movers.forEach(item => {
      const d = bestOverviewDelta(item);
      const row = document.createElement('div');
      row.className = 'rtrow live-mover' + (activeIds.has(item.videoId) ? ' live-alert' : '') + (suspiciousIds.has(item.videoId) ? ' live-suspicious' : '');
      const name = document.createElement('span');
      name.textContent = item.title || item.videoId || 'YouTube video';
      name.title = name.textContent;
      const value = document.createElement('b');
      value.textContent = d.value === null ? '—' : '+' + d.value.toLocaleString('en-US');
      value.title = d.label;
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
        ? fmtNumber(state.movers.length) + ' active'
        : fmtNumber(movers.length) + ' of ' + fmtNumber(state.movers.length);
    }

    if(!movers.length){
      const empty = document.createElement('div');
      empty.className = 'hf-empty';
      empty.textContent = state.filter === 'all'
        ? 'No activity in the current radar feed.'
        : 'No ' + (state.filter === 'short' ? 'Shorts' : 'videos') + ' in the current activity radar.';
      moversList.appendChild(empty);
      return;
    }

    movers.forEach(item => {
      const status = activityStatus(item);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'hf-mover';
      if(state.selectedVideoId === item.videoId) row.classList.add('selected');
      if(status === 'ALARM') row.classList.add('is-alert');
      if(status === 'SUSPICIOUS') row.classList.add('is-suspicious');
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
      if(status === 'SUSPICIOUS' || status === 'ALARM'){
        const signalPill = document.createElement('span');
        signalPill.className = status === 'ALARM' ? 'hf-alert-pill' : 'hf-suspicious-pill';
        signalPill.textContent = status;
        meta.appendChild(signalPill);
      }
      copy.append(strong,meta);
      main.append(img,copy);
      row.appendChild(main);

      const values = [
        ['total', item.totalViews, fmtNumber],
        ['poll', item.deltaSincePoll, fmtDelta],
        ['current', item.currentHourViews, fmtDelta],
        ['previous', item.previousHourViews, fmtDelta]
      ];
      values.forEach(([name,value,formatter]) => {
        const el = document.createElement('div');
        el.className = 'hf-mover-value ' + name + (name !== 'total' ? ' delta' : '');
        el.textContent = formatter(value);
        row.appendChild(el);
      });

      const statusEl = document.createElement('div');
      statusEl.className = 'hf-mover-status ' + status.toLowerCase();
      statusEl.textContent = status;
      row.appendChild(statusEl);

      row.addEventListener('click', () => selectVideo(item.videoId));
      moversList.appendChild(row);
    });
  }

  function renderActiveAlerts(){
    if(!activeAlertList) return;
    clear(activeAlertList);

    const signals = state.alerts.concat(state.suspicious).sort((a,b) => {
      const aAlarm = String(a && a.signalLevel || '').toUpperCase() === 'ALARM' ? 1 : 0;
      const bAlarm = String(b && b.signalLevel || '').toUpperCase() === 'ALARM' ? 1 : 0;
      if(aAlarm !== bAlarm) return bAlarm - aAlarm;
      return Number(b && b.score || 0) - Number(a && a.score || 0);
    });

    if(!signals.length){
      if(alertBadge) alertBadge.textContent = 'Standby';
      const empty = document.createElement('div');
      empty.className = 'hf-empty';
      empty.textContent = 'No suspicious activity or Hese-Fredrik alarm.';
      activeAlertList.appendChild(empty);
      return;
    }

    if(alertBadge){
      const parts = [];
      if(state.alerts.length) parts.push(state.alerts.length + ' ALARM' + (state.alerts.length === 1 ? '' : 'S'));
      if(state.suspicious.length) parts.push(state.suspicious.length + ' SUSPICIOUS');
      alertBadge.textContent = parts.join(' · ');
    }

    signals.forEach(signal => {
      const level = String(signal.signalLevel || (isActiveAlert(signal.videoId) ? 'ALARM' : 'SUSPICIOUS')).toUpperCase();
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'hf-active-card ' + (level === 'ALARM' ? 'is-alarm' : 'is-suspicious');
      card.dataset.videoId = signal.videoId || '';
      if(state.selectedVideoId === signal.videoId) card.classList.add('selected');

      const img = document.createElement('img');
      img.src = signal.thumbnail || ('https://img.youtube.com/vi/' + encodeURIComponent(signal.videoId || '') + '/mqdefault.jpg');
      img.alt = '';
      const copy = document.createElement('div');
      copy.className = 'hf-active-card-copy';
      const title = document.createElement('strong');
      title.textContent = signal.title || signal.videoId || 'SkyrScout video';
      const small = document.createElement('small');
      small.textContent = typeLabel(signal) + ' · ' + level + ' · ' + windowLabel(signal) + ' · ' + baselineText(signal);
      copy.append(title,small);
      const delta = document.createElement('div');
      delta.className = 'hf-active-delta';
      delta.textContent = fmtDelta(signal.deltaViews);
      card.append(img,copy,delta);
      card.addEventListener('click', () => selectVideo(signal.videoId, {scroll:true}));
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
      const fallback = state.alerts[0] || state.suspicious[0] || filteredMovers()[0] || state.movers[0] || null;
      if(fallback){
        state.selectedVideoId = fallback.videoId;
        item = mergedVideo(fallback.videoId);
      }
    }

    if(!item){
      if(detailTypeBadge) detailTypeBadge.textContent = '—';
      const empty = document.createElement('div');
      empty.className = 'hf-empty';
      empty.textContent = 'Select a video from the activity radar or Signals.';
      detailBody.appendChild(empty);
      return;
    }

    const signal = signalFor(item);
    const status = activityStatus(item);
    const type = typeLabel(item);
    if(detailTypeBadge){
      detailTypeBadge.textContent = type;
      detailTypeBadge.classList.toggle('short', videoType(item) === 'short');
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
    const statusPill = document.createElement('span');
    statusPill.className = status === 'ALARM' ? 'hf-alert-pill' : status === 'SUSPICIOUS' ? 'hf-suspicious-pill' : 'hf-status-pill ' + status.toLowerCase();
    statusPill.textContent = status;
    flags.appendChild(statusPill);
    copy.append(h2,p,flags);
    head.append(img,copy);

    const metrics = document.createElement('div');
    metrics.className = 'hf-detail-metrics';
    metrics.append(
      metric('Total views', fmtNumber(item.totalViews), false),
      metric('Since last poll', fmtDelta(item.deltaSincePoll), false),
      metric('This clock hour', fmtDelta(item.currentHourViews), status === 'ALARM' && signal && signal.hourKind !== 'previous'),
      metric('Previous clock hour', fmtDelta(item.previousHourViews), status === 'ALARM' && signal && signal.hourKind === 'previous'),
      metric('This hour confidence', String(item.currentHourConfidence || '—').toUpperCase(), false),
      metric('Signal status', status, status === 'ALARM')
    );
    detailBody.append(head,metrics);

    const note = document.createElement('div');
    note.className = 'hf-detail-note';
    note.textContent = 'Previous clock hour is the stored counter difference between the two hour-boundary snapshots. This clock hour is still in progress.';
    detailBody.appendChild(note);

    if(signal){
      const signalBox = document.createElement('div');
      signalBox.className = 'hf-detail-alert ' + (status === 'SUSPICIOUS' ? 'suspicious' : 'alarm');
      const title = document.createElement('strong');
      title.textContent = status + ' · ' + fmtDelta(signal.deltaViews) + ' · ' + windowLabel(signal);
      const signalNote = document.createElement('p');
      signalNote.textContent = baselineText(signal);
      signalBox.append(title,signalNote);
      detailBody.appendChild(signalBox);
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

    const byType = internalRules && internalRules.byType && typeof internalRules.byType === 'object'
      ? internalRules.byType
      : null;
    const suspicious = internalRules && internalRules.suspicious ? internalRules.suspicious : {};
    const rules = [];

    if(byType){
      [['long','LONG'],['short','SHORT'],['unknown','UNKNOWN']].forEach(([key,label]) => {
        const rule = byType[key];
        if(!rule) return;
        rules.push([label + ' · absolute hour', '+' + fmtNumber(rule.absoluteHourMinViews) + ' views']);
        rules.push([label + ' · recent 1–2 h', '+' + fmtNumber(rule.recentTwoHoursMinViews) + ' views']);
        rules.push([
          label + ' · relative hour',
          '+' + fmtNumber(rule.relativeHourMinViews) + ' & ≥' +
            Number(rule.relativeHourMultiplier || 0).toFixed(1) + '×'
        ]);
        rules.push([
          label + ' · suspicious',
          'poll +' + fmtNumber(rule.suspiciousLastPollMinViews) +
            ' · hour +' + fmtNumber(rule.suspiciousHourMinViews)
        ]);
      });
    }else{
      const absolute = internalRules && Array.isArray(internalRules.absolute) ? internalRules.absolute : [];
      const relative = internalRules && Array.isArray(internalRules.relative) ? internalRules.relative : [];
      absolute.forEach(rule => rules.push(['Alarm · clock hour absolute', '+' + fmtNumber(rule.minViews) + ' views']));
      relative.forEach(rule => rules.push(['Alarm · clock hour relative', '+' + fmtNumber(rule.minViews) + ' & ≥' + Number(rule.multiplier || 0).toFixed(1) + '×']));
      if(numericOrNull(suspicious.lastPollMinViews) !== null) rules.push(['Suspicious · last poll', '+' + fmtNumber(suspicious.lastPollMinViews) + ' views']);
      if(numericOrNull(suspicious.hourMinViews) !== null) rules.push(['Suspicious · current hour', '+' + fmtNumber(suspicious.hourMinViews) + ' views']);
    }

    if(numericOrNull(suspicious.alarmMinPositivePolls) !== null){
      rules.push(['Alarm confirmation', '≥' + fmtNumber(suspicious.alarmMinPositivePolls) + ' positive polls']);
    }
    rules.push(['Public siren', 'Strongest confirmed ALARM']);

    if(!rules.length){
      const empty = document.createElement('div');
      empty.className = 'hf-empty';
      empty.textContent = 'No internal signal rules returned.';
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

  function mostLikedLists(){
    const seen = new Set();
    return Array.from(document.querySelectorAll('[data-yt-most-liked-list], #ytMostLikedList')).filter(node => {
      if(seen.has(node)) return false;
      seen.add(node);
      return true;
    });
  }

  function mostLikedNotes(){
    return Array.from(document.querySelectorAll('[data-yt-most-liked-note]'));
  }

  function fmtLikeDelta(value){
    const n = numericOrNull(value);
    if(n === null) return '—';
    return (n > 0 ? '+' : '') + fmtNumber(n);
  }

  function formatHistoryAge(hours){
    const h = Math.max(0, Number(hours) || 0);
    if(h < 1) return '<1H';
    if(h < 24) return Math.floor(h) + 'H';
    const days = Math.floor(h / 24);
    const remainder = Math.floor(h % 24);
    return remainder ? (days + 'D ' + remainder + 'H') : (days + 'D');
  }

  function activeMostLikedItems(){
    if(state.likeWindow === 'lifetime') return state.mostLiked;
    if(state.likeWindow === '7d') return state.mostLiked7d;
    return state.mostLiked24h;
  }

  function syncMostLikedTabs(){
    document.querySelectorAll('[data-yt-like-window]').forEach(button => {
      const active = String(button.dataset.ytLikeWindow || '') === state.likeWindow;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function mostLikedNoteText(){
    if(state.likeWindow === 'lifetime'){
      return 'Lifetime likes · refreshed with the VPS collector.';
    }

    const age = Math.max(0, Number((state.likesHistory || {}).ageHours) || 0);
    const targetHours = state.likeWindow === '7d' ? 168 : 24;
    const complete = age >= targetHours;
    const targetLabel = state.likeWindow === '7d' ? '7D' : '24H';

    if(!complete){
      return 'BUILDING HISTORY · ' + formatHistoryAge(age) + ' / ' + targetLabel + ' · ranking uses collected history so far.';
    }
    return 'Rolling ' + targetLabel + ' net likes · hourly local baseline · no extra API polls.';
  }

  function renderMostLiked(){
    const lists = mostLikedLists();
    if(!lists.length) return;

    syncMostLikedTabs();

    const items = activeMostLikedItems();
    const isLifetime = state.likeWindow === 'lifetime';
    const allRows = Array.isArray(items)
      ? items.filter(item => numericOrNull(item && (isLifetime ? item.likeCount : item.likeDelta)) !== null)
      : [];

    // A zero-delta ranking is meaningless while 24H/7D history is still being built.
    // For rolling windows, show only videos that have actually gained likes.
    const rows = (isLifetime
      ? allRows
      : allRows.filter(item => numericOrNull(item.likeDelta) > 0)
    ).slice(0,5);

    const historyAge = Math.max(0, Number((state.likesHistory || {}).ageHours) || 0);
    const targetHours = state.likeWindow === '7d' ? 168 : 24;
    const historyComplete = isLifetime || historyAge >= targetHours;

    lists.forEach(list => {
      clear(list);

      if(!rows.length){
        const empty = document.createElement('div');
        empty.className = 'yt-most-liked-empty';

        if(isLifetime){
          empty.textContent = 'Waiting for VPS like counts…';
        }else if(!historyComplete){
          const label = state.likeWindow === '7d' ? '7D' : '24H';
          const pct = Math.max(1, Math.min(100, Math.round((historyAge / targetHours) * 100)));

          const title = document.createElement('strong');
          title.textContent = 'BUILDING ' + label + ' HISTORY';

          const detail = document.createElement('div');
          detail.style.marginTop = '8px';
          detail.textContent = 'Hourly like snapshots are being collected. The ranking appears as soon as a video gains a like.';

          const track = document.createElement('span');
          track.className = 'yt-most-liked-bar';
          track.style.display = 'block';
          track.style.marginTop = '12px';
          track.style.maxWidth = '520px';
          const fill = document.createElement('i');
          fill.style.width = pct + '%';
          track.appendChild(fill);

          const progress = document.createElement('div');
          progress.style.marginTop = '7px';
          progress.textContent = formatHistoryAge(historyAge) + ' / ' + label + ' collected';

          empty.append(title, detail, track, progress);
        }else{
          empty.textContent = 'No likes gained in this window yet.';
        }

        list.appendChild(empty);
        return;
      }

      const metrics = rows.map(item => {
        const value = numericOrNull(isLifetime ? item.likeCount : item.likeDelta);
        return value === null ? 0 : Math.max(0, value);
      });
      const maxMetric = Math.max.apply(null, metrics);

      rows.forEach((item,index) => {
        const metric = numericOrNull(isLifetime ? item.likeCount : item.likeDelta);
        const row = document.createElement('div');
        row.className = 'yt-most-liked-row';

        const rank = document.createElement('span');
        rank.className = 'yt-most-liked-rank';
        rank.textContent = '#' + (index + 1);

        const title = document.createElement('strong');
        title.className = 'yt-most-liked-title';
        title.textContent = item.title || item.videoId || 'SkyrScout video';
        title.title = title.textContent;

        const count = document.createElement('b');
        count.className = 'yt-most-liked-count';
        count.textContent = isLifetime ? fmtNumber(metric) : fmtLikeDelta(metric);

        const meta = document.createElement('div');
        meta.className = 'yt-most-liked-meta';

        const type = document.createElement('span');
        type.className = 'yt-most-liked-type';
        type.textContent = String(item.videoType || 'unknown').toUpperCase();

        const bar = document.createElement('span');
        bar.className = 'yt-most-liked-bar';
        const fill = document.createElement('i');
        const positive = metric === null ? 0 : Math.max(0, metric);
        const pct = maxMetric > 0 ? Math.max(2, Math.round((positive / maxMetric) * 100)) : 0;
        fill.style.width = pct + '%';
        bar.appendChild(fill);
        meta.append(type,bar);

        row.append(rank,title,count,meta);
        list.appendChild(row);
      });
    });

    const note = mostLikedNoteText();
    mostLikedNotes().forEach(el => { el.textContent = note; });
  }


  function render(payload){
    if(!payload || payload.ok === false) throw new Error('Invalid Hese-Fredrik payload');

    const videos = document.getElementById('hfVideosPolled');
    const alertsCount = document.getElementById('hfActiveAlerts');
    const suspiciousCount = document.getElementById('hfSuspiciousCount');
    const checked = document.getElementById('hfCheckedAt');

    state.alerts = Array.isArray(payload.internalAlerts) ? payload.internalAlerts : [];
    state.suspicious = Array.isArray(payload.suspiciousSignals) ? payload.suspiciousSignals : [];
    state.movers = Array.isArray(payload.topMovers) ? payload.topMovers : [];
    state.mostLiked = Array.isArray(payload.mostLiked) ? payload.mostLiked : [];
    state.mostLiked24h = Array.isArray(payload.mostLiked24h) ? payload.mostLiked24h : [];
    state.mostLiked7d = Array.isArray(payload.mostLiked7d) ? payload.mostLiked7d : [];
    state.likesHistory = payload.likesHistory || {};
    state.rules = payload.internalRules || {};
    state.checkedAt = payload.checkedAt;
    state.videosPolled = payload.videosPolled;

    if(videos) videos.textContent = fmtNumber(payload.videosPolled);
    if(alertsCount) alertsCount.textContent = fmtNumber(state.alerts.length);
    if(suspiciousCount) suspiciousCount.textContent = fmtNumber(state.suspicious.length);
    if(checked) checked.textContent = fmtTime(payload.checkedAt);

    if(liveSummary){
      if(state.alerts.length){
        liveSummary.textContent = state.alerts.length + ' confirmed Hese-Fredrik alarm' + (state.alerts.length === 1 ? '' : 's') + ' · ' + state.suspicious.length + ' suspicious';
      }else if(state.suspicious.length){
        liveSummary.textContent = state.suspicious.length + ' suspicious signal' + (state.suspicious.length === 1 ? '' : 's') + ' · no confirmed alarm';
      }else{
        liveSummary.textContent = 'Monitoring ' + fmtNumber(payload.videosPolled) + ' videos · ' + fmtNumber(payload.activityCount || state.movers.length) + ' in activity radar';
      }
    }

    if(!state.selectedVideoId || !mergedVideo(state.selectedVideoId)){
      const first = state.alerts[0] || state.suspicious[0] || state.movers[0] || null;
      state.selectedVideoId = first ? first.videoId : null;
    }

    updateFilterButtons();
    renderActiveAlerts();
    renderMovers();
    renderDetail();
    renderRules(state.rules);
    renderOverviewMovers(state.movers, state.alerts, state.suspicious);
    renderMostLiked();

    if(state.alerts.length){
      const lead = state.alerts[0];
      setStatus('warn','Hese-Fredrik ALARM · ' + (lead.title || 'video') + ' ' + fmtDelta(lead.deltaViews) + ' / ' + shortWindowLabel(lead));
      showInternalOverlay(state.alerts);
    }else if(state.suspicious.length){
      setStatus('warn','Hese-Fredrik watching · ' + state.suspicious.length + ' suspicious · ' + fmtTime(payload.checkedAt));
      hideOverlayIfClear(state.alerts);
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
    state.suspicious = [];
    state.checkedAt = payload.checkedAt;
    const suspiciousCount = document.getElementById('hfSuspiciousCount');
    if(suspiciousCount) suspiciousCount.textContent = '—';
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

  function initHeseFocusMode(){
    const overlay = document.getElementById('consoleFocusOverlay');
    const shell = document.getElementById('consoleFocusShell');
    const closeBtn = document.getElementById('consoleFocusClose');
    if(!overlay || !shell || !closeBtn) return;

    let lastTrigger = null;
    const panels = Array.from(document.querySelectorAll('[data-screen="hese-fredrik"] .hf-focus-panel'));

    function closeFocus(){
      if(!overlay.classList.contains('open')) return;
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden','true');
      document.body.classList.remove('console-focus-open');
      shell.querySelectorAll('.panel').forEach(el => el.remove());
      if(lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus();
      lastTrigger = null;
    }

    function openFocus(panel, trigger){
      if(!panel || overlay.classList.contains('open')) return;
      lastTrigger = trigger || null;
      shell.className = 'console-focus-shell hese-focus';
      if(panel.classList.contains('hf-movers-panel')) shell.classList.add('hese-radar-focus');
      if(panel.classList.contains('hf-detail-panel')) shell.classList.add('hese-detail-focus');
      if(panel.classList.contains('hf-signals-panel')) shell.classList.add('hese-signals-focus');
      if(panel.classList.contains('hf-rules-panel')) shell.classList.add('hese-rules-focus');
      if(panel.classList.contains('hf-command-panel')) shell.classList.add('hese-command-focus');

      const clone = panel.cloneNode(true);
      clone.classList.remove('console-focusable');
      clone.querySelectorAll('.console-focus-btn').forEach(el => el.remove());
      shell.querySelectorAll('.panel').forEach(el => el.remove());
      shell.appendChild(clone);
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden','false');
      document.body.classList.add('console-focus-open');
      requestAnimationFrame(() => closeBtn.focus());
    }

    panels.forEach(panel => {
      if(panel.querySelector(':scope > .ph > .console-focus-btn')) return;
      panel.classList.add('console-focusable');
      const header = panel.querySelector(':scope > .ph');
      if(!header) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'console-focus-btn';
      btn.innerHTML = '⛶';
      btn.title = 'Open console in Focus Mode';
      btn.setAttribute('aria-label','Open console in Focus Mode');
      header.appendChild(btn);
      btn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openFocus(panel, btn);
      });
    });

    if(!closeBtn.dataset.heseFocusBound){
      closeBtn.dataset.heseFocusBound = '1';
      closeBtn.addEventListener('click', closeFocus);
      overlay.addEventListener('click', event => { if(event.target === overlay) closeFocus(); });
      document.addEventListener('keydown', event => { if(event.key === 'Escape' && shell.classList.contains('hese-focus')) closeFocus(); });
      shell.addEventListener('click', event => {
        const row = event.target.closest('.hf-mover[data-video-id], .hf-active-card[data-video-id]');
        if(!row || !shell.classList.contains('hese-focus')) return;
        const id = row.dataset.videoId;
        closeFocus();
        if(id) selectVideo(id);
      });
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


  document.addEventListener('click', event => {
    const button = event.target.closest('[data-yt-like-window]');
    if(!button) return;
    const next = String(button.dataset.ytLikeWindow || '').toLowerCase();
    if(!['24h','7d','lifetime'].includes(next)) return;
    event.preventDefault();
    event.stopPropagation();
    state.likeWindow = next;
    renderMostLiked();
  });

  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      const next = button.dataset.hfFilter;
      if(next !== 'all' && next !== 'video' && next !== 'short') return;
      state.filter = next;
      updateFilterButtons();
      renderMovers();
    });
  });

  initHeseFocusMode();
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
