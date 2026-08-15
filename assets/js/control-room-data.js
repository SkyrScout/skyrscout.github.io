(function(){
  "use strict";

  const ENDPOINT = "https://script.google.com/macros/s/AKfycbw5hZ4rk0e4OwClAtrH3-K9g4Z_XBu00a61Lx-aqdlv_KRXxZhJhR3WGFynE9W2WY5Z/exec";
  const REFRESH_MS = 5 * 60 * 1000;
  const ACK_KEY = "skyrscout-cr-hf-internal-ack-v2";
  const ACK_TTL_MS = 45 * 60 * 1000;
  let requestCounter = 0;

  function setStatus(text, state){
    const status = document.getElementById('crLiveStatus');
    const dot = document.getElementById('crLiveDot');
    if(status) status.textContent = text;
    if(dot){
      dot.classList.remove('is-warn','is-error');
      if(state === 'warn') dot.classList.add('is-warn');
      if(state === 'error') dot.classList.add('is-error');
    }
  }

  function fmtTime(ms){
    if(!ms) return '';
    try{
      return new Intl.DateTimeFormat('nb-NO',{hour:'2-digit',minute:'2-digit'}).format(new Date(ms));
    }catch(_){ return ''; }
  }

  function bestDelta(mover){
    const d60 = mover.delta60m === null || mover.delta60m === undefined ? null : Number(mover.delta60m);
    const d15 = mover.delta15m === null || mover.delta15m === undefined ? null : Number(mover.delta15m);
    if(Number.isFinite(d60) && Number.isFinite(d15)){
      return d15 * 4 > d60 ? {value:d15,label:'15 M'} : {value:d60,label:'60 M'};
    }
    if(Number.isFinite(d60)) return {value:d60,label:'60 M'};
    if(Number.isFinite(d15)) return {value:d15,label:'15 M'};
    if(Number.isFinite(Number(mover.deltaSincePoll))) return {value:Number(mover.deltaSincePoll), label:'LAST POLL'};
    return {value:null,label:'LIVE'};
  }

  function alertSignature(alert){
    if(!alert) return '';
    return [alert.videoId || '', alert.windowMinutes || '', alert.reason || 'alert'].join(':');
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
    }catch(_){ return null; }
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

    const acknowledge = function(){
      if(overlay._currentAlert) setAck(overlay._currentAlert);
      overlay.classList.remove('is-open');
    };

    overlay.querySelector('.hf-internal-close').addEventListener('click', acknowledge);
    overlay.querySelector('.hf-internal-ack').addEventListener('click', acknowledge);
    return overlay;
  }

  function baselineText(alert){
    const baseline = alert.baselineViews === null || alert.baselineViews === undefined ? null : Number(alert.baselineViews);
    const multiple = alert.multiple === null || alert.multiple === undefined ? null : Number(alert.multiple);
    if(alert.reason === 'relative' && Number.isFinite(baseline)){
      if(Number.isFinite(multiple)){
        return 'Previous comparable window: ' + baseline.toLocaleString('en-US') + ' · ' + multiple.toFixed(1) + '× pace';
      }
      return 'Previous comparable window: ' + baseline.toLocaleString('en-US') + ' · new activity spike';
    }
    if(Number.isFinite(baseline)){
      return 'Previous comparable window: ' + baseline.toLocaleString('en-US') + ' · absolute spike rule';
    }
    return 'Absolute spike rule';
  }

  function showInternalOverlay(alert, moreCount){
    if(!alert) return;
    const ack = getAck();
    const sig = alertSignature(alert);
    if(ack && ack.sig === sig) return;

    const overlay = ensureOverlay();
    const sameOpenAlert = overlay.classList.contains('is-open') && overlay.dataset.alertSig === sig;
    overlay._currentAlert = alert;
    overlay.dataset.alertSig = sig;

    const title = overlay.querySelector('.hf-internal-title');
    const movement = overlay.querySelector('.hf-internal-movement');
    const baseline = overlay.querySelector('.hf-internal-baseline');
    const thumb = overlay.querySelector('.hf-internal-thumb');
    const open = overlay.querySelector('.hf-internal-open');

    title.textContent = alert.title || 'YouTube video';
    const delta = Number(alert.deltaViews || 0);
    movement.textContent = '+' + delta.toLocaleString('en-US') + ' views / ' + Number(alert.windowMinutes || 0) + ' min' + (moreCount ? ' · +' + moreCount + ' more moving' : '');
    baseline.textContent = baselineText(alert);
    thumb.src = alert.thumbnail || ('https://img.youtube.com/vi/' + encodeURIComponent(alert.videoId || '') + '/hqdefault.jpg');
    thumb.alt = alert.title || 'Hese-Fredrik alert thumbnail';
    open.href = alert.videoUrl || ('https://www.youtube.com/watch?v=' + encodeURIComponent(alert.videoId || ''));

    overlay.classList.add('is-open');
    if(!sameOpenAlert){
      document.body.classList.remove('hf-alert-flash');
      void document.body.getBoundingClientRect();
      document.body.classList.add('hf-alert-flash');
      window.setTimeout(() => document.body.classList.remove('hf-alert-flash'), 1900);
    }
  }

  function hideOverlayIfClear(internalAlerts){
    if(internalAlerts.length) return;
    const overlay = document.getElementById('hfInternalOverlay');
    if(overlay) overlay.classList.remove('is-open');
    try{ localStorage.removeItem(ACK_KEY); }catch(_){ }
  }

  function render(payload){
    if(!payload || payload.ok === false) throw new Error('Invalid Hese-Fredrik payload');

    const checked = fmtTime(payload.checkedAt);
    const count = Number(payload.videosPolled || 0);
    const internalAlerts = Array.isArray(payload.internalAlerts) ? payload.internalAlerts : [];

    if(internalAlerts.length){
      const lead = internalAlerts[0];
      const windowLabel = Number(lead.windowMinutes || 0) === 15 ? '15 M' : '60 M';
      const delta = Number(lead.deltaViews || 0);
      setStatus(
        'Hese-Fredrik går! · ' + (lead.title || 'video') +
        ' +' + delta.toLocaleString('en-US') + ' / ' + windowLabel,
        'warn'
      );
      showInternalOverlay(lead, Math.max(0, internalAlerts.length - 1));
    }else{
      setStatus('Hese-Fredrik live' + (checked ? ' · ' + checked : '') + (count ? ' · ' + count + ' videos' : ''), 'ok');
      hideOverlayIfClear(internalAlerts);
    }

    const list = document.getElementById('crRealtimeList');
    const title = document.getElementById('crRealtimeListTitle');
    const badge = document.getElementById('crRealtimeBadge');
    if(!list) return;

    const movers = Array.isArray(payload.topMovers) ? payload.topMovers : [];
    if(!movers.length){
      if(title) title.textContent = 'MOVING NOW';
      if(badge) badge.textContent = internalAlerts.length ? 'ALERT' : 'LIVE';
      return;
    }

    const firstDelta = bestDelta(movers[0]);
    if(title) title.textContent = internalAlerts.length ? 'HESE-FREDRIK · MOVING NOW' : 'MOVING NOW · ' + firstDelta.label;
    if(badge) badge.textContent = internalAlerts.length ? 'ALERT' : 'LIVE';

    const activeIds = new Set(internalAlerts.map(a => a.videoId));
    list.innerHTML = '';
    movers.forEach(mover => {
      const d = bestDelta(mover);
      const row = document.createElement('div');
      row.className = 'rtrow live-mover' + (activeIds.has(mover.videoId) ? ' live-alert' : '');
      const name = document.createElement('span');
      name.textContent = mover.title || mover.videoId || 'YouTube video';
      name.title = name.textContent;
      const value = document.createElement('b');
      value.textContent = d.value === null ? '—' : '+' + d.value.toLocaleString('en-US');
      row.append(name,value);
      list.appendChild(row);
    });
  }

  function load(){
    requestCounter += 1;
    const callbackName = '__SkyrScoutControlRoomHF' + requestCounter;
    const script = document.createElement('script');
    const timeout = setTimeout(() => {
      cleanup();
      setStatus('Hese-Fredrik offline', 'error');
    }, 12000);

    function cleanup(){
      clearTimeout(timeout);
      try{ delete window[callbackName]; }catch(_){ window[callbackName] = undefined; }
      if(script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = function(payload){
      try{ render(payload); }
      catch(error){
        console.warn('Control Room live feed:', error);
        setStatus('Hese-Fredrik feed error', 'error');
      } finally { cleanup(); }
    };

    script.onerror = function(){
      cleanup();
      setStatus('Hese-Fredrik offline', 'error');
    };
    script.async = true;
    script.src = ENDPOINT + '?mode=debug&callback=' + encodeURIComponent(callbackName) + '&_=' + Date.now();
    document.head.appendChild(script);
  }

  load();
  window.setInterval(load, REFRESH_MS);
})();
