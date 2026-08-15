(function(){
  'use strict';

  const endpoint = document.body.dataset.heseFredrikEndpoint || '';
  const badge = document.getElementById('hfConnectionBadge');
  const statusBox = document.getElementById('controlRoomDataStatus');
  const statusDot = document.getElementById('controlRoomDataDot');
  const moversList = document.getElementById('hfMoversList');
  const rulesBody = document.getElementById('hfRulesBody');
  const alertBody = document.getElementById('hfAlertBody');
  const alertBadge = document.getElementById('hfAlertBadge');
  let timer = null;
  let requestSerial = 0;

  function number(value){
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
  }

  function delta(value){
    const n = Number(value);
    if(!Number.isFinite(n)) return '—';
    return (n >= 0 ? '+' : '') + n.toLocaleString('en-US');
  }

  function checkedAt(value){
    const n = Number(value);
    if(!Number.isFinite(n)) return '—';
    return new Date(n).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
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

  function clear(el){ while(el && el.firstChild) el.removeChild(el.firstChild); }

  function renderMovers(items){
    if(!moversList) return;
    clear(moversList);
    if(!Array.isArray(items) || !items.length){
      const empty = document.createElement('div');
      empty.className = 'hf-empty';
      empty.textContent = 'No mover data returned yet.';
      moversList.appendChild(empty);
      return;
    }

    items.forEach(item => {
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
      copy.append(strong, small);

      const vals = [
        [item.totalViews, false, number],
        [item.deltaSincePoll, true, delta],
        [item.delta15m, true, delta],
        [item.delta60m, true, delta]
      ];

      a.append(img, copy);
      vals.forEach(([value,isDelta,formatter]) => {
        const el = document.createElement('div');
        el.className = 'hf-mover-value' + (isDelta ? ' delta' : '');
        el.textContent = formatter(value);
        a.appendChild(el);
      });
      moversList.appendChild(a);
    });
  }

  function renderRules(rules){
    if(!rulesBody) return;
    clear(rulesBody);
    if(!Array.isArray(rules) || !rules.length){
      const empty = document.createElement('div');
      empty.className = 'hf-empty';
      empty.textContent = 'No alert rules returned.';
      rulesBody.appendChild(empty);
      return;
    }
    rules.forEach(rule => {
      const row = document.createElement('div');
      row.className = 'hf-rule';
      const label = document.createElement('span');
      label.textContent = String(rule.minutes || '—') + ' minute movement';
      const value = document.createElement('strong');
      value.textContent = '+' + number(rule.minViews) + ' views';
      row.append(label, value);
      rulesBody.appendChild(row);
    });
  }

  function renderAlert(alerts){
    if(!alertBody) return;
    clear(alertBody);
    const alert = Array.isArray(alerts) && alerts.length ? alerts[0] : null;
    if(!alert){
      if(alertBadge) alertBadge.textContent = 'Standby';
      const empty = document.createElement('div');
      empty.className = 'hf-empty';
      empty.textContent = 'No active Hese-Fredrik alert.';
      alertBody.appendChild(empty);
      return;
    }

    if(alertBadge) alertBadge.textContent = 'ACTIVE';
    const card = document.createElement('div');
    card.className = 'hf-alert-card';
    const img = document.createElement('img');
    img.src = alert.thumbnail || ('https://img.youtube.com/vi/' + encodeURIComponent(alert.videoId || '') + '/mqdefault.jpg');
    img.alt = '';
    const copy = document.createElement('div');
    const h = document.createElement('h3');
    h.textContent = alert.title || 'SkyrScout video';
    const p = document.createElement('p');
    p.textContent = delta(alert.deltaViews) + ' views in ' + number(alert.windowMinutes) + ' minutes';
    copy.append(h,p);
    card.append(img,copy);
    alertBody.appendChild(card);
  }

  function render(payload){
    const videos = document.getElementById('hfVideosPolled');
    const alerts = document.getElementById('hfActiveAlerts');
    const checked = document.getElementById('hfCheckedAt');
    if(videos) videos.textContent = number(payload && payload.videosPolled);
    if(alerts) alerts.textContent = number(payload && Array.isArray(payload.activeAlerts) ? payload.activeAlerts.length : 0);
    if(checked) checked.textContent = checkedAt(payload && payload.checkedAt);
    renderMovers(payload && payload.topMovers);
    renderRules(payload && payload.rules);
    renderAlert(payload && payload.activeAlerts);
    setStatus('ok','Hese-Fredrik linked');
  }

  function fail(){
    setStatus('error','Hese-Fredrik offline');
    if(moversList && !moversList.querySelector('.hf-mover')){
      clear(moversList);
      const empty = document.createElement('div');
      empty.className = 'hf-empty hf-error';
      empty.textContent = 'Could not reach the Hese-Fredrik endpoint. The Control Room itself remains available.';
      moversList.appendChild(empty);
    }
  }

  window.SkyrScoutControlRoomHeseFredrik = function(payload){
    render(payload || {});
    const s = document.getElementById('hf-control-room-jsonp');
    if(s) s.remove();
  };

  function load(){
    if(!endpoint){
      setStatus('warn','Backend not configured');
      return;
    }
    requestSerial += 1;
    const old = document.getElementById('hf-control-room-jsonp');
    if(old) old.remove();
    const script = document.createElement('script');
    script.id = 'hf-control-room-jsonp';
    const sep = endpoint.indexOf('?') === -1 ? '?' : '&';
    script.src = endpoint + sep + 'mode=debug&callback=SkyrScoutControlRoomHeseFredrik&_=' + Date.now() + '&r=' + requestSerial;
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  }

  load();
  timer = window.setInterval(load, 60000);
  document.addEventListener('controlroom:screenchange', event => {
    if(event.detail && event.detail.screen === 'hese-fredrik') load();
  });
})();
