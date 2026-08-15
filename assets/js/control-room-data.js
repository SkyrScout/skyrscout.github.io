(function(){
  "use strict";

  const ENDPOINT = "https://script.google.com/macros/s/AKfycbw5hZ4rk0e4OwClAtrH3-K9g4Z_XBu00a61Lx-aqdlv_KRXxZhJhR3WGFynE9W2WY5Z/exec";
  const REFRESH_MS = 5 * 60 * 1000;
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
    if(Number.isFinite(Number(mover.delta60m))) return {value:Number(mover.delta60m), label:'60 M'};
    if(Number.isFinite(Number(mover.delta15m))) return {value:Number(mover.delta15m), label:'15 M'};
    if(Number.isFinite(Number(mover.deltaSincePoll))) return {value:Number(mover.deltaSincePoll), label:'LAST POLL'};
    return {value:null,label:'LIVE'};
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
    }else{
      setStatus('Hese-Fredrik live' + (checked ? ' · ' + checked : '') + (count ? ' · ' + count + ' videos' : ''), 'ok');
    }

    const list = document.getElementById('crRealtimeList');
    const title = document.getElementById('crRealtimeListTitle');
    const badge = document.getElementById('crRealtimeBadge');
    if(!list) return;

    const movers = Array.isArray(payload.topMovers) ? payload.topMovers : [];
    if(!movers.length){
      if(title) title.textContent = 'MOVING NOW';
      if(badge) badge.textContent = 'LIVE';
      return;
    }

    const firstDelta = bestDelta(movers[0]);
    if(title) title.textContent = internalAlerts.length ? 'HESE-FREDRIK · MOVING NOW' : 'MOVING NOW · ' + firstDelta.label;
    if(badge) badge.textContent = internalAlerts.length ? 'ALERT' : 'LIVE';

    // The private Control Room highlights the more sensitive internal watch state.
    // Public activeAlerts remain stricter and continue to drive only the public siren.
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
      setStatus('Live feed unavailable · showing references', 'warn');
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
        setStatus('Live feed error · showing references', 'warn');
      } finally { cleanup(); }
    };

    script.onerror = function(){
      cleanup();
      setStatus('Live feed unavailable · showing references', 'warn');
    };
    script.async = true;
    script.src = ENDPOINT + '?mode=debug&callback=' + encodeURIComponent(callbackName) + '&_=' + Date.now();
    document.head.appendChild(script);
  }

  load();
  window.setInterval(load, REFRESH_MS);
})();
