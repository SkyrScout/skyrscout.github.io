(function(){
  'use strict';

  let geo = window.SkyrScoutGeographyState || null;
  let activeTab = 'countries';
  let activeRange = '2d';
  let selectedKey = '';

  const RANGE_ORDER = ['2d','7d','28d','90d'];

  function bodies(){
    return Array.from(document.querySelectorAll(
      '[data-screen="youtube"] .yt-geography-body, #consoleFocusShell .yt-geography-body'
    ));
  }

  function n(value){
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function fmt(value){
    const parsed = n(value);
    return parsed === null ? '—' : parsed.toLocaleString('en-US');
  }

  function fmtDate(value){
    const raw = String(value || '').trim();
    if(!raw) return '';
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? m[3] + '.' + m[2] + '.' + m[1] : raw;
  }

  function rangeData(){
    if(!geo) return null;

    if(
      geo.windows &&
      typeof geo.windows === 'object' &&
      geo.windows[activeRange]
    ){
      return geo.windows[activeRange];
    }

    return geo;
  }

  function availableRangeKeys(){
    if(!geo || !geo.windows || typeof geo.windows !== 'object'){
      return ['2d'];
    }

    const keys = RANGE_ORDER.filter(key => geo.windows[key]);
    return keys.length ? keys : ['2d'];
  }

  function normalizeActiveRange(){
    const available = availableRangeKeys();
    if(!available.includes(activeRange)){
      activeRange = available.includes(String(geo && geo.defaultWindow || ''))
        ? String(geo.defaultWindow)
        : available[0];
    }
  }

  function periodText(win){
    if(!win) return 'Latest available YouTube Analytics geography.';

    const start = fmtDate(win.startDate);
    const end = fmtDate(win.endDate || win.date);

    if(start && end && start !== end){
      return 'YouTube Analytics · ' + start + ' → ' + end;
    }

    return end
      ? 'Latest available · ' + end
      : 'Latest available YouTube Analytics geography.';
  }

  function countryByKey(win, key){
    if(!win || !Array.isArray(win.countries)) return null;
    return win.countries.find(item => String(item.key || '') === String(key || '')) || null;
  }

  function selectedCountry(win){
    if(!win || !Array.isArray(win.countries) || !win.countries.length) return null;

    let country = countryByKey(win, selectedKey);
    if(!country){
      country = win.countries[0];
      selectedKey = String(country.key || '');
    }

    return country;
  }

  function rowsFor(source, key){
    if(!source) return [];
    if(source instanceof Map) return source.get(key) || [];
    if(typeof source === 'object') return source[key] || [];
    return [];
  }

  function videoTitle(item){
    const id = String((item && item.videoId) || '');
    const fallback = String((item && (item.name || item.videoId)) || 'Video');
    if(!id || fallback !== id) return fallback;

    const ytRow = document.querySelector(
      '[data-yt-video-row][data-yt-video-id="' + CSS.escape(id) + '"]'
    );
    if(ytRow){
      return String(ytRow.dataset.ytVideoTitle || ytRow.dataset.ytVideoName || fallback);
    }

    const libraryRow = document.querySelector(
      '[data-video-library-row][data-youtube-id="' + CSS.escape(id) + '"]'
    );
    return libraryRow
      ? String(libraryRow.dataset.playerDisplay || libraryRow.dataset.videoTitle || fallback)
      : fallback;
  }

  function renderBreakdown(container, rows, kind){
    if(!container) return;
    container.replaceChildren();

    if(!rows.length){
      const empty = document.createElement('div');
      empty.className = 'yt-geo-empty';
      empty.textContent = kind === 'city'
        ? 'City data unavailable for this country and period.'
        : 'Video data unavailable for this country and period.';
      container.appendChild(empty);
      return;
    }

    rows.slice(0, kind === 'city' ? 20 : 12).forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'yt-geo-breakdown-row';

      const rank = document.createElement('span');
      rank.className = 'yt-geo-breakdown-rank';
      rank.textContent = '#' + (index + 1);

      const label = document.createElement('span');
      label.className = 'yt-geo-breakdown-label';
      label.textContent = kind === 'video'
        ? videoTitle(item)
        : String(item.name || '—');
      label.title = label.textContent;

      const value = document.createElement('b');
      value.textContent = fmt(item.views);

      row.append(rank, label, value);
      container.appendChild(row);
    });
  }

  function markup(){
    return `
      <div class="yt-geo-rangebar">
        <span class="yt-geo-range-label">TRAFFIC WINDOW</span>
        <div class="yt-geo-ranges" role="tablist" aria-label="Geography traffic window">
          <button class="yt-geo-range active" type="button" data-yt-geo-range="2d">2D</button>
          <button class="yt-geo-range" type="button" data-yt-geo-range="7d">7D</button>
          <button class="yt-geo-range" type="button" data-yt-geo-range="28d">28D</button>
          <button class="yt-geo-range" type="button" data-yt-geo-range="90d">90D</button>
        </div>
      </div>

      <div class="yt-geo-tabs" role="tablist" aria-label="Geography detail">
        <button class="yt-geo-tab active" type="button" role="tab" aria-selected="true" data-yt-geo-tab="countries">COUNTRIES</button>
        <button class="yt-geo-tab" type="button" role="tab" aria-selected="false" data-yt-geo-tab="cities">CITIES</button>
        <button class="yt-geo-tab" type="button" role="tab" aria-selected="false" data-yt-geo-tab="videos">TOP VIDEOS</button>
      </div>

      <div class="yt-geo-view" data-yt-geo-view="countries">
        <div class="yt-geo-copy">
          <strong>Countries</strong>
          <span data-yt-geo-period>Latest available YouTube Analytics geography.</span>
        </div>
        <div class="yt-geo-selected-note">
          Selected: <strong data-yt-geo-selected-inline>—</strong>
          <span>Choose a country, then open Cities or Top Videos.</span>
        </div>
        <div class="yt-geo-country-list" data-yt-geo-countries>
          <div class="yt-geo-empty">Waiting for geography data…</div>
        </div>
      </div>

      <div class="yt-geo-view" data-yt-geo-view="cities" hidden>
        <div class="yt-geo-detail-head">
          <div>
            <span>TOP CITIES IN</span>
            <strong data-yt-geo-selected-country>—</strong>
          </div>
          <b data-yt-geo-selected-total>—</b>
        </div>
        <div class="yt-geo-detail-scroll" data-yt-geo-cities>
          <div class="yt-geo-empty">Choose a country first.</div>
        </div>
      </div>

      <div class="yt-geo-view" data-yt-geo-view="videos" hidden>
        <div class="yt-geo-detail-head">
          <div>
            <span>TOP VIDEOS IN</span>
            <strong data-yt-geo-selected-country>—</strong>
          </div>
          <b data-yt-geo-selected-total>—</b>
        </div>
        <div class="yt-geo-detail-scroll" data-yt-geo-videos>
          <div class="yt-geo-empty">Choose a country first.</div>
        </div>
      </div>
    `;
  }

  function ensureCompatibleMarkup(panel){
    if(!panel) return;

    const hasV3 =
      panel.querySelector('[data-yt-geo-range]') &&
      panel.querySelector('[data-yt-geo-tab="videos"]');

    if(hasV3){
      panel.setAttribute('data-yt-geography-body', '');
      return;
    }

    panel.setAttribute('data-yt-geography-body', '');
    panel.innerHTML = markup();
  }

  function render(panel){
    if(!panel) return;

    ensureCompatibleMarkup(panel);
    normalizeActiveRange();

    const win = rangeData();

    panel.querySelectorAll('[data-yt-geo-range]').forEach(button => {
      const key = String(button.dataset.ytGeoRange || '');
      const available = availableRangeKeys().includes(key);
      const isActive = key === activeRange;

      button.disabled = !available;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    panel.querySelectorAll('[data-yt-geo-tab]').forEach(button => {
      const isActive = String(button.dataset.ytGeoTab || '') === activeTab;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    panel.querySelectorAll('[data-yt-geo-view]').forEach(view => {
      view.hidden = String(view.dataset.ytGeoView || '') !== activeTab;
    });

    const period = panel.querySelector('[data-yt-geo-period]');
    if(period) period.textContent = periodText(win);

    const list = panel.querySelector('[data-yt-geo-countries]');
    if(!win || !Array.isArray(win.countries) || !win.countries.length){
      if(list) list.innerHTML = '<div class="yt-geo-empty">Waiting for geography data…</div>';
      return;
    }

    const country = selectedCountry(win);
    if(!country) return;

    panel.querySelectorAll('[data-yt-geo-selected-country]').forEach(node => {
      node.textContent = String(country.display || country.mapName || country.raw || 'Country');
    });

    panel.querySelectorAll('[data-yt-geo-selected-inline]').forEach(node => {
      node.textContent = String(country.display || country.mapName || country.raw || 'Country');
    });

    panel.querySelectorAll('[data-yt-geo-selected-total]').forEach(node => {
      const pct = n(country.share);
      node.textContent =
        fmt(country.views) + ' views' +
        (pct === null ? '' : ' · ' + pct.toFixed(pct >= 10 ? 1 : 2).replace(/\\.00$/, '') + '%');
    });

    if(list){
      list.replaceChildren();
      const maxViews = Math.max(1, ...win.countries.map(item => n(item.views) || 0));

      win.countries.forEach((item, index) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'yt-geo-country-row';
        row.dataset.ytGeoCountry = String(item.key || '');

        const isSelected = String(item.key || '') === String(selectedKey || '');
        row.classList.toggle('selected', isSelected);
        row.setAttribute('aria-pressed', isSelected ? 'true' : 'false');

        const rank = document.createElement('span');
        rank.className = 'yt-geo-rank';
        rank.textContent = '#' + (index + 1);

        const name = document.createElement('strong');
        name.className = 'yt-geo-country-name';
        name.textContent = String(item.display || item.mapName || item.raw || 'Country');

        const views = document.createElement('b');
        views.className = 'yt-geo-country-views';
        views.textContent = fmt(item.views);

        const share = document.createElement('span');
        share.className = 'yt-geo-country-share';
        const pct = n(item.share);
        share.textContent = pct === null
          ? ''
          : pct.toFixed(pct >= 10 ? 1 : 2).replace(/\\.00$/, '') + '%';

        const bar = document.createElement('span');
        bar.className = 'yt-geo-bar';

        const fill = document.createElement('i');
        fill.style.width = Math.max(
          2,
          Math.min(100, ((n(item.views) || 0) / maxViews) * 100)
        ).toFixed(1) + '%';

        bar.appendChild(fill);
        row.append(rank, name, views, share, bar);
        list.appendChild(row);
      });
    }

    const key = String(country.key || '');
    renderBreakdown(
      panel.querySelector('[data-yt-geo-cities]'),
      rowsFor(win.cities, key),
      'city'
    );
    renderBreakdown(
      panel.querySelector('[data-yt-geo-videos]'),
      rowsFor(win.videos, key),
      'video'
    );
  }

  function renderAll(){
    bodies().forEach(render);
  }

  function setTab(next){
    activeTab = ['countries','cities','videos'].includes(next)
      ? next
      : 'countries';

    const win = rangeData();
    if(activeTab !== 'countries') selectedCountry(win);

    renderAll();
  }

  function setRange(next){
    const key = String(next || '').toLowerCase();
    if(!availableRangeKeys().includes(key)) return;

    activeRange = key;

    // Keep the same country where possible. If it does not exist in the new
    // range, selectedCountry() will safely fall back to that range's #1.
    selectedCountry(rangeData());
    renderAll();
  }

  function ensureStyle(){
    if(document.getElementById('ytGeographyTabsStyle')) return;

    const style = document.createElement('style');
    style.id = 'ytGeographyTabsStyle';
    style.textContent = `
      .yt-geography-body{display:grid;grid-template-rows:auto auto minmax(0,1fr);gap:7px;overflow:hidden}
      .yt-geo-rangebar{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .yt-geo-range-label{color:#765f5d;font-size:6px;font-weight:900;letter-spacing:.08em}
      .yt-geo-ranges,.yt-geo-tabs{display:flex;gap:5px;align-items:center;flex-wrap:wrap}
      .yt-geo-range,.yt-geo-tab{appearance:none;border:1px solid #3a1715;border-radius:999px;background:#080707;color:#9d8381;padding:4px 9px;font:800 7px/1 inherit;letter-spacing:.05em;cursor:pointer}
      .yt-geo-range:hover:not(:disabled),.yt-geo-tab:hover{border-color:#80413d;color:#f2dddd}
      .yt-geo-range.active,.yt-geo-tab.active{border-color:#d75f58;background:#29100f;color:#fff}
      .yt-geo-range:disabled{opacity:.28;cursor:default}
      .yt-geo-view{min-height:0;overflow:hidden}
      .yt-geo-view[hidden]{display:none!important}
      .yt-geo-copy{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-bottom:4px}
      .yt-geo-copy strong{color:#fff;font-size:9px}
      .yt-geo-copy span{color:#765f5d;font-size:6px;text-align:right}
      .yt-geo-selected-note{display:flex;gap:5px;align-items:center;min-width:0;color:#735e5d;font-size:6px;margin:0 0 4px}
      .yt-geo-selected-note strong{color:#d2b8b5}
      .yt-geo-selected-note span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .yt-geo-country-list{min-height:0;height:calc(100% - 34px);overflow-y:auto;padding-right:5px;scrollbar-gutter:stable}
      .yt-geo-country-row{appearance:none;width:100%;display:grid;grid-template-columns:24px minmax(0,1fr) auto auto;grid-template-rows:auto auto;gap:3px 8px;align-items:center;border:0;border-bottom:1px solid #20100f;background:transparent;color:inherit;padding:7px 3px;text-align:left;cursor:pointer}
      .yt-geo-country-row:hover{background:#130908}
      .yt-geo-country-row.selected{background:#170b0a;box-shadow:inset 2px 0 #d75f58}
      .yt-geo-rank{grid-row:1/3;color:#d66d68;font-size:8px;font-weight:900;text-align:center}
      .yt-geo-country-name{min-width:0;color:#f1eeee;font-size:9px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .yt-geo-country-views{color:#fff;font-size:9px;font-weight:900;white-space:nowrap}
      .yt-geo-country-share{color:#9d8381;font-size:7px;font-weight:800;white-space:nowrap}
      .yt-geo-bar{grid-column:2/5;height:4px;border-radius:999px;overflow:hidden;background:#1c0d0d}
      .yt-geo-bar>i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#80302d,#e2645e)}
      .yt-geo-detail-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:2px 2px 8px;border-bottom:1px solid #24100f}
      .yt-geo-detail-head div{display:grid;gap:3px}
      .yt-geo-detail-head span{color:#8f7472;font-size:6px;font-weight:900;letter-spacing:.08em}
      .yt-geo-detail-head strong{color:#fff;font-size:12px}
      .yt-geo-detail-head>b{color:#e86a63;font-size:10px;white-space:nowrap}
      .yt-geo-detail-scroll{height:calc(100% - 44px);min-height:0;overflow-y:auto;padding:4px 4px 0 0}
      .yt-geo-breakdown-row{display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #1d0d0c;font-size:8px}
      .yt-geo-breakdown-rank{color:#765f5d;font-weight:900;text-align:center}
      .yt-geo-breakdown-label{min-width:0;color:#e4dddd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .yt-geo-breakdown-row b{color:#fff;white-space:nowrap}
      .yt-geo-empty{padding:10px 2px;color:#735e5d;font-size:8px;line-height:1.45}
      #consoleFocusShell .yt-geo-range,#consoleFocusShell .yt-geo-tab{font-size:10px;padding:6px 13px}
      #consoleFocusShell .yt-geo-country-row{grid-template-columns:34px minmax(0,1fr) auto auto;padding:10px 5px}
      #consoleFocusShell .yt-geo-country-name{font-size:12px}
      #consoleFocusShell .yt-geo-country-views{font-size:12px}
      #consoleFocusShell .yt-geo-country-share{font-size:9px}
      #consoleFocusShell .yt-geo-breakdown-row{padding:9px 0;font-size:11px}
      #consoleFocusShell .yt-geo-detail-head strong{font-size:18px}
      #consoleFocusShell .yt-geo-detail-head>b{font-size:13px}
      #consoleFocusShell .yt-geo-copy strong{font-size:12px}
      #consoleFocusShell .yt-geo-copy span{font-size:9px}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('controlroom:geographydata', event => {
    geo = event && event.detail ? event.detail : window.SkyrScoutGeographyState || null;
    normalizeActiveRange();
    renderAll();
  });

  document.addEventListener('click', event => {
    const range = event.target.closest('[data-yt-geo-range]');
    if(range){
      event.preventDefault();
      event.stopPropagation();
      setRange(range.dataset.ytGeoRange);
      return;
    }

    const tab = event.target.closest('[data-yt-geo-tab]');
    if(tab){
      event.preventDefault();
      event.stopPropagation();
      setTab(tab.dataset.ytGeoTab);
      return;
    }

    const country = event.target.closest('[data-yt-geo-country]');
    if(country){
      event.preventDefault();
      event.stopPropagation();
      selectedKey = String(country.dataset.ytGeoCountry || '');
      renderAll();
    }
  });

  const focusShell = document.getElementById('consoleFocusShell');
  if(focusShell){
    new MutationObserver(mutations => {
      const changed = mutations.some(mutation =>
        Array.from(mutation.addedNodes || []).some(node =>
          node && node.nodeType === 1 &&
          ((node.matches && node.matches('.yt-geography-panel')) ||
           (node.querySelector && node.querySelector('.yt-geography-panel')))
        )
      );

      if(changed) window.setTimeout(renderAll, 0);
    }).observe(focusShell, {childList:true, subtree:true});
  }

  document.addEventListener('controlroom:screenchange', event => {
    if(event && event.detail && event.detail.screen === 'youtube'){
      geo = window.SkyrScoutGeographyState || geo;
      normalizeActiveRange();
      window.setTimeout(renderAll, 0);
    }
  });

  ensureStyle();
  normalizeActiveRange();
  renderAll();
})();
