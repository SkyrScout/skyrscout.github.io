(function(){
  'use strict';

  const endpoint = document.body.dataset.heseFredrikEndpoint || '';
  const REFRESH_MS = 60 * 1000;
  const REQUEST_TIMEOUT_MS = 15000;
  const ACK_KEY = 'skyrscout-cr-hf-internal-ack-v3';
  const ACK_TTL_MS = 45 * 60 * 1000;

  const badge = document.getElementById('hfConnectionBadge');
  const statusBox = document.getElementById('controlRoomDataStatus');
  const statusDot = document.getElementById('controlRoomDataDot');
  const moversList = document.getElementById('hfMoversList');
  const rulesBody = document.getElementById('hfRulesBody');
  const alertBody = document.getElementById('hfAlertBody');
  const alertBadge = document.getElementById('hfAlertBadge');
  const overviewList = document.getElementById('crRealtimeList');
  const overviewTitle = document.getElementById('crRealtimeListTitle');
  const overviewBadge = document.getElementById('crRealtimeBadge');

  let requestSerial = 0;

  function fmtNumber(value){
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
  }

  function fmtDelta(value){
    const n = Number(value);
    if(!Number.isFinite(n)) return '—';
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

  function bestOverviewDelta(mover){
    const currentHour = Number(mover && mover.currentHourViews);
    const previousHour = Number(mover && mover.previousHourViews);
    const d15 = Number(mover && mover.delta15m);
    const poll = Number(mover && mover.deltaSincePoll);
    const candidates = [];

    if(Number.isFinite(currentHour)) candidates.push({value:currentHour,label:'CURRENT HOUR',weight:currentHour});
    if(Number.isFinite(previousHour)) candidates.push({value:previousHour,label:'PREVIOUS HOUR',weight:previousHour});
    if(Number.isFinite(d15)) candidates.push({value:d15,label:'15 M',weight:d15 * 4});
    if(candidates.length){
      candidates.sort((a,b) => b.weight - a.weight);
      return candidates[0];
    }
    if(Number.isFinite(poll)) return {value:poll,label:'LAST POLL',weight:poll};
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

  function getAck(){
    try{
      const parsed = JSON.parse(localStorage.getItem(ACK_KEY) || 'null');
      if(!parsed || !parsed.sig || !parsed.at) return null;
      if(Date.now() - Number(parsed.at) > ACK_TTL_MS){
        localStorage.removeItem(ACK_KEY);
        return null;
      }
      return parsed;
    }catch(_){
      return null;
    }
  }

  function setAck(alert){
    try{
      localStorage.setItem(ACK_KEY, JSON.stringify({sig:alertSignature(alert),at:Date.now()}));
    }catch(_){ }
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
          '<div class="hf-internal-actions">',
            '<button type="button" class="hf-internal-ack">ACK</button>',
            '<a class="hf-internal-open" target="_blank" rel="noopener">OPEN VIDEO</a>',
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
    return overlay;
  }

  function windowLabel(alert){
    if(alert && alert.windowType === 'clockHour'){
      return alert.hourKind === 'previous' ? 'previous clock hour' : 'current clock hour';
    }
    return String(Number(alert && alert.windowMinutes) || 15) + ' min';
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

  function showInternalOverlay(alert, moreCount){
    if(!alert) return;
    const sig = alertSignature(alert);
    const ack = getAck();
    if(ack && ack.sig === sig) return;

    const overlay = ensureOverlay();
    const sameOpen = overlay.classList.contains('is-open') && overlay.dataset.alertSig === sig;
    overlay._currentAlert = alert;
    overlay.dataset.alertSig = sig;

    overlay.querySelector('.hf-internal-title').textContent = alert.title || 'YouTube video';
    overlay.querySelector('.hf-internal-movement').textContent =
      fmtDelta(alert.deltaViews) + ' views · ' + windowLabel(alert) +
      (moreCount ? ' · +' + moreCount + ' more moving' : '');
    overlay.querySelector('.hf-internal-baseline').textContent = baselineText(alert);

    const thumb = overlay.querySelector('.hf-internal-thumb');
    thumb.src = alert.thumbnail || ('https://img.youtube.com/vi/' + encodeURIComponent(alert.videoId || '') + '/hqdefault.jpg');
    thumb.alt = alert.title || 'Hese-Fredrik alert thumbnail';

    const open = overlay.querySelector('.hf-internal-open');
    open.href = alert.videoUrl || ('https://www.youtube.com/watch?v=' + encodeURIComponent(alert.videoId || ''));

    overlay.classList.add('is-open');
    if(!sameOpen){
      document.body.classList.remove('hf-alert-flash');
      void document.body.getBoundingClientRect();
      document.body.classList.add('hf-alert-flash');
      window.setTimeout(() => document.body.classList.remove('hf-alert-flash'), 1900);
    }
  }

  function hideOverlayIfClear(alerts){
    if(alerts.length) return;
    const overlay = document.getElementById('hfInternalOverlay');
    if(overlay) overlay.classList.remove('is-open');
    try{ localStorage.removeItem(ACK_KEY); }catch(_){ }
  }

  function renderOverviewMovers(items, internalAlerts){
    if(!overviewList) return;
    const movers = Array.isArray(items) ? items : [];
    const activeIds = new Set((internalAlerts || []).map(a => a.videoId));

    if(!movers.length){
      if(overviewTitle) overviewTitle.textContent = 'MOVING NOW';
      if(overviewBadge) overviewBadge.textContent = internalAlerts.length ? 'ALERT' : 'LIVE';
      return;
    }

    const first = bestOverviewDelta(movers[0]);
    if(overviewTitle) overviewTitle.textContent = internalAlerts.length ? 'HESE-FREDRIK · MOVING NOW' : 'MOVING NOW · ' + first.label;
    if(overviewBadge) overviewBadge.textContent = internalAlerts.length ? 'ALERT' : 'LIVE';

    clear(overviewList);
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

  function renderMovers(items){
    if(!moversList) return;
    clear(moversList);
    const movers = Array.isArray(items) ? items : [];
    if(!movers.length){
      const empty = document.createElement('div');
      empty.className = 'hf-empty';
      empty.textContent = 'No mover data returned yet.';
      moversList.appendChild(empty);
      return;
    }

    movers.forEach(item => {
      const a = document.createElement('a');
      a.className = 'hf-mover';
      a.href = item.videoUrl || ('https://www.youtube.com/watch?v=' + encodeURIComponent(item.videoId || ''));
      a.target = '_blank';
      a.rel = 'noopener noreferrer';

      const img = document.createElement('img');
      img.src = item.thumbnail || ('https://img.youtube.com/vi/' + encodeURIComponent(item.videoId || '') + '/mqdefault.jpg');
      img.alt = '';
      img.loading = 'lazy';

      const copy = document.createElement('div');
      copy.className = 'hf-mover-copy';
      const strong = document.createElement('strong');
      strong.textContent = item.title || item.videoId || 'YouTube video';
      const small = document.createElement('small');
      small.textContent = item.videoId || '';
      copy.append(strong,small);

      const values = [
        [item.totalViews, false, fmtNumber],
        [item.deltaSincePoll, true, fmtDelta],
        [item.delta15m, true, fmtDelta],
        [item.currentHourViews, true, fmtDelta],
        [item.previousHourViews, true, fmtDelta]
      ];

      a.append(img,copy);
      values.forEach(([value,isDelta,formatter]) => {
        const el = document.createElement('div');
        el.className = 'hf-mover-value' + (isDelta ? ' delta' : '');
        el.textContent = formatter(value);
        a.appendChild(el);
      });
      moversList.appendChild(a);
    });
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

  function renderAlert(alerts){
    if(!alertBody) return;
    clear(alertBody);
    const list = Array.isArray(alerts) ? alerts : [];
    const alert = list.length ? list[0] : null;

    if(!alert){
      if(alertBadge) alertBadge.textContent = 'Standby';
      const empty = document.createElement('div');
      empty.className = 'hf-empty';
      empty.textContent = 'No active internal Hese-Fredrik alert.';
      alertBody.appendChild(empty);
      return;
    }

    if(alertBadge) alertBadge.textContent = list.length > 1 ? 'ACTIVE +' + (list.length - 1) : 'ACTIVE';
    const card = document.createElement('div');
    card.className = 'hf-alert-card';
    const img = document.createElement('img');
    img.src = alert.thumbnail || ('https://img.youtube.com/vi/' + encodeURIComponent(alert.videoId || '') + '/mqdefault.jpg');
    img.alt = '';
    const copy = document.createElement('div');
    const h = document.createElement('h3');
    h.textContent = alert.title || 'SkyrScout video';
    const p = document.createElement('p');
    p.textContent = fmtDelta(alert.deltaViews) + ' views · ' + windowLabel(alert) + ' · ' + baselineText(alert);
    copy.append(h,p);
    card.append(img,copy);
    alertBody.appendChild(card);
  }

  function render(payload){
    if(!payload || payload.ok === false) throw new Error('Invalid Hese-Fredrik payload');

    const videos = document.getElementById('hfVideosPolled');
    const alertsCount = document.getElementById('hfActiveAlerts');
    const checked = document.getElementById('hfCheckedAt');
    const internalAlerts = Array.isArray(payload.internalAlerts) ? payload.internalAlerts : [];
    const movers = Array.isArray(payload.topMovers) ? payload.topMovers : [];

    if(videos) videos.textContent = fmtNumber(payload.videosPolled);
    if(alertsCount) alertsCount.textContent = fmtNumber(internalAlerts.length);
    if(checked) checked.textContent = fmtTime(payload.checkedAt);

    renderMovers(movers);
    renderRules(payload.internalRules || {});
    renderAlert(internalAlerts);
    renderOverviewMovers(movers, internalAlerts);

    if(internalAlerts.length){
      const lead = internalAlerts[0];
      const shortWindow = lead.windowType === 'clockHour'
        ? (lead.hourKind === 'previous' ? 'PREV HR' : 'CURR HR')
        : '15 M';
      setStatus('warn','Hese-Fredrik går! · ' + (lead.title || 'video') + ' ' + fmtDelta(lead.deltaViews) + ' / ' + shortWindow);
      showInternalOverlay(lead, Math.max(0,internalAlerts.length - 1));
    }else{
      setStatus('ok','Hese-Fredrik live · ' + fmtTime(payload.checkedAt));
      hideOverlayIfClear(internalAlerts);
    }
  }

  function fail(message){
    setStatus('error','Hese-Fredrik offline');
    if(badge) badge.textContent = 'Offline';
    if(moversList && !moversList.querySelector('.hf-mover')){
      clear(moversList);
      const empty = document.createElement('div');
      empty.className = 'hf-empty hf-error';
      empty.textContent = message || 'Could not reach the Hese-Fredrik endpoint.';
      moversList.appendChild(empty);
    }
  }

  function load(){
    if(!endpoint){
      fail('Backend endpoint is not configured on this page.');
      return;
    }

    requestSerial += 1;
    const callbackName = '__SkyrScoutControlRoomHF' + requestSerial;
    const script = document.createElement('script');
    let finished = false;

    const timeout = window.setTimeout(() => {
      if(finished) return;
      finished = true;
      cleanup();
      fail('Hese-Fredrik endpoint timed out.');
    }, REQUEST_TIMEOUT_MS);

    function cleanup(){
      window.clearTimeout(timeout);
      try{ delete window[callbackName]; }catch(_){ window[callbackName] = undefined; }
      if(script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = function(payload){
      if(finished) return;
      finished = true;
      try{
        render(payload || {});
      }catch(error){
        console.warn('Control Room live feed:', error);
        fail('Hese-Fredrik payload could not be rendered.');
      }finally{
        cleanup();
      }
    };

    script.async = true;
    script.onerror = function(){
      if(finished) return;
      finished = true;
      cleanup();
      fail('Could not load the Hese-Fredrik JSONP feed.');
    };

    const sep = endpoint.indexOf('?') === -1 ? '?' : '&';
    script.src = endpoint + sep +
      'callback=' + encodeURIComponent(callbackName) +
      '&mode=debug&_=' + Date.now();
    document.head.appendChild(script);
  }

  load();
  window.setInterval(load, REFRESH_MS);
  document.addEventListener('controlroom:screenchange', event => {
    if(event.detail && event.detail.screen === 'hese-fredrik') load();
  });
})();
