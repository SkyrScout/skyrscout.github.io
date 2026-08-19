(function(){
  'use strict';

  let geo = window.SkyrScoutGeographyState || null;
  let activeTab = 'countries';
  let selectedKey = '';

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

  function periodText(){
    if(!geo) return 'Latest available YouTube Analytics geography.';
    const start = fmtDate(geo.startDate);
    const end = fmtDate(geo.endDate || geo.date);
    if(start && end && start !== end) return 'YouTube Analytics · ' + start + ' → ' + end;
    return end ? 'Latest available · ' + end : 'Latest available YouTube Analytics geography.';
  }

  function countryByKey(key){
    if(!geo || !Array.isArray(geo.countries)) return null;
    return geo.countries.find(item => String(item.key || '') === String(key || '')) || null;
  }

  function selectedCountry(){
    if(!geo || !Array.isArray(geo.countries) || !geo.countries.length) return null;
    let country = countryByKey(selectedKey);
    if(!country){
      country = geo.countries[0];
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
        ? 'City data unavailable for this period.'
        : 'Video breakdown unavailable for this period.';
      container.appendChild(empty);
      return;
    }

    rows.slice(0, 12).forEach(item => {
      const row = document.createElement('div');
      row.className = 'yt-geo-breakdown-row';

      const label = document.createElement('span');
      label.textContent = kind === 'video' ? videoTitle(item) : String(item.name || '—');
      label.title = label.textContent;

      const value = document.createElement('b');
      value.textContent = fmt(item.views);

      row.append(label, value);
      container.appendChild(row);
    });
  }

  function ensureCompatibleMarkup(panel){
    if(!panel) return;
    if(panel.querySelector('[data-yt-geo-countries]')){
      panel.setAttribute('data-yt-geography-body', '');
      return;
    }

    // Older YouTube-tab builds used a visual placeholder here.
    // Upgrade that body in place so the real Geography feed can render
    // without depending on a specific historical index.html version.
    panel.setAttribute('data-yt-geography-body', '');
    panel.innerHTML = `
      <div class="yt-geo-tabs" role="tablist" aria-label="Geography level">
        <button class="yt-geo-tab active" type="button" role="tab" aria-selected="true" data-yt-geo-tab="countries">COUNTRIES</button>
        <button class="yt-geo-tab" type="button" role="tab" aria-selected="false" data-yt-geo-tab="cities">CITIES</button>
      </div>

      <div class="yt-geo-view" data-yt-geo-view="countries">
        <div class="yt-geo-copy">
          <strong>Countries</strong>
          <span data-yt-geo-period>Latest available YouTube Analytics geography.</span>
        </div>
        <div class="yt-geo-country-list" data-yt-geo-countries>
          <div class="yt-geo-empty">Waiting for geography data…</div>
        </div>
      </div>

      <div class="yt-geo-view" data-yt-geo-view="cities" hidden>
        <div class="yt-geo-city-head">
          <div>
            <span>SELECTED COUNTRY</span>
            <strong data-yt-geo-selected-country>—</strong>
          </div>
          <b data-yt-geo-selected-total>—</b>
        </div>
        <div class="yt-geo-city-grid">
          <section class="yt-geo-breakdown">
            <h4>TOP CITIES</h4>
            <div data-yt-geo-cities><div class="yt-geo-empty">Choose a country first.</div></div>
          </section>
          <section class="yt-geo-breakdown">
            <h4>TOP VIDEOS</h4>
            <div data-yt-geo-videos><div class="yt-geo-empty">Choose a country first.</div></div>
          </section>
        </div>
      </div>
    `;
  }

  function render(panel){
    if(!panel) return;

    ensureCompatibleMarkup(panel);

    panel.querySelectorAll('[data-yt-geo-tab]').forEach(button => {
      const isActive = String(button.dataset.ytGeoTab || '') === activeTab;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    panel.querySelectorAll('[data-yt-geo-view]').forEach(view => {
      view.hidden = String(view.dataset.ytGeoView || '') !== activeTab;
    });

    const period = panel.querySelector('[data-yt-geo-period]');
    if(period) period.textContent = periodText();

    const list = panel.querySelector('[data-yt-geo-countries]');
    if(!geo || !Array.isArray(geo.countries) || !geo.countries.length){
      if(list) list.innerHTML = '<div class="yt-geo-empty">Waiting for geography data…</div>';
      return;
    }

    if(list){
      list.replaceChildren();
      const maxViews = Math.max(1, ...geo.countries.map(country => n(country.views) || 0));

      geo.countries.forEach((country, index) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'yt-geo-country-row';
        row.dataset.ytGeoCountry = String(country.key || '');

        const rank = document.createElement('span');
        rank.className = 'yt-geo-rank';
        rank.textContent = '#' + (index + 1);

        const name = document.createElement('strong');
        name.className = 'yt-geo-country-name';
        name.textContent = String(country.display || country.mapName || country.raw || 'Country');

        const views = document.createElement('b');
        views.className = 'yt-geo-country-views';
        views.textContent = fmt(country.views);

        const share = document.createElement('span');
        share.className = 'yt-geo-country-share';
        const pct = n(country.share);
        share.textContent = pct === null
          ? ''
          : pct.toFixed(pct >= 10 ? 1 : 2).replace(/\.00$/, '') + '%';

        const bar = document.createElement('span');
        bar.className = 'yt-geo-bar';
        const fill = document.createElement('i');
        fill.style.width = Math.max(
          2,
          Math.min(100, ((n(country.views) || 0) / maxViews) * 100)
        ).toFixed(1) + '%';
        bar.appendChild(fill);

        row.append(rank, name, views, share, bar);
        list.appendChild(row);
      });
    }

    const country = selectedCountry();
    if(!country) return;

    const selectedName = panel.querySelector('[data-yt-geo-selected-country]');
    if(selectedName){
      selectedName.textContent = String(country.display || country.mapName || country.raw || 'Country');
    }

    const selectedTotal = panel.querySelector('[data-yt-geo-selected-total]');
    if(selectedTotal){
      const pct = n(country.share);
      selectedTotal.textContent =
        fmt(country.views) + ' views' +
        (pct === null ? '' : ' · ' + pct.toFixed(pct >= 10 ? 1 : 2).replace(/\.00$/, '') + '%');
    }

    const key = String(country.key || '');
    renderBreakdown(panel.querySelector('[data-yt-geo-cities]'), rowsFor(geo.cities, key), 'city');
    renderBreakdown(panel.querySelector('[data-yt-geo-videos]'), rowsFor(geo.videos, key), 'video');
  }

  function renderAll(){
    bodies().forEach(render);
  }

  function setTab(next){
    activeTab = next === 'cities' ? 'cities' : 'countries';
    if(activeTab === 'cities') selectedCountry();
    renderAll();
  }

  function ensureStyle(){
    if(document.getElementById('ytGeographyTabsStyle')) return;

    const style = document.createElement('style');
    style.id = 'ytGeographyTabsStyle';
    style.textContent = `
      .yt-geography-body{display:grid;grid-template-rows:auto minmax(0,1fr);gap:8px;overflow:hidden}
      .yt-geo-tabs{display:flex;gap:5px;align-items:center}
      .yt-geo-tab{appearance:none;border:1px solid #3a1715;border-radius:999px;background:#080707;color:#9d8381;padding:4px 9px;font:800 7px/1 inherit;letter-spacing:.05em;cursor:pointer}
      .yt-geo-tab:hover{border-color:#80413d;color:#f2dddd}
      .yt-geo-tab.active{border-color:#d75f58;background:#29100f;color:#fff}
      .yt-geo-view{min-height:0;overflow:hidden}
      .yt-geo-view[hidden]{display:none!important}
      .yt-geo-country-list{min-height:0;height:100%;overflow-y:auto;padding-right:5px;scrollbar-gutter:stable}
      .yt-geo-country-row{appearance:none;width:100%;display:grid;grid-template-columns:24px minmax(0,1fr) auto auto;grid-template-rows:auto auto;gap:3px 8px;align-items:center;border:0;border-bottom:1px solid #20100f;background:transparent;color:inherit;padding:7px 3px;text-align:left;cursor:pointer}
      .yt-geo-country-row:hover{background:#130908}
      .yt-geo-rank{grid-row:1/3;color:#d66d68;font-size:8px;font-weight:900;text-align:center}
      .yt-geo-country-name{min-width:0;color:#f1eeee;font-size:9px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .yt-geo-country-views{color:#fff;font-size:9px;font-weight:900;white-space:nowrap}
      .yt-geo-country-share{color:#9d8381;font-size:7px;font-weight:800;white-space:nowrap}
      .yt-geo-bar{grid-column:2/5;height:4px;border-radius:999px;overflow:hidden;background:#1c0d0d}
      .yt-geo-bar>i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#80302d,#e2645e)}
      .yt-geo-city-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:2px 2px 8px;border-bottom:1px solid #24100f}
      .yt-geo-city-head div{display:grid;gap:3px}
      .yt-geo-city-head span{color:#8f7472;font-size:6px;font-weight:900;letter-spacing:.08em}
      .yt-geo-city-head strong{color:#fff;font-size:12px}
      .yt-geo-city-head>b{color:#e86a63;font-size:10px;white-space:nowrap}
      .yt-geo-city-grid{height:calc(100% - 44px);display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;padding-top:8px}
      .yt-geo-breakdown{min-width:0;min-height:0;overflow-y:auto;padding-right:4px}
      .yt-geo-breakdown h4{margin:0 0 5px;color:#d75f58;font-size:7px;letter-spacing:.06em}
      .yt-geo-breakdown-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:6px 0;border-bottom:1px solid #1d0d0c;font-size:8px}
      .yt-geo-breakdown-row span{min-width:0;color:#e4dddd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .yt-geo-breakdown-row b{color:#fff;white-space:nowrap}
      .yt-geo-empty{padding:10px 2px;color:#735e5d;font-size:8px;line-height:1.45}
      #consoleFocusShell .yt-geo-country-row{grid-template-columns:34px minmax(0,1fr) auto auto;padding:10px 5px}
      #consoleFocusShell .yt-geo-country-name{font-size:12px}
      #consoleFocusShell .yt-geo-country-views{font-size:12px}
      #consoleFocusShell .yt-geo-country-share{font-size:9px}
      #consoleFocusShell .yt-geo-breakdown-row{padding:9px 0;font-size:11px}
      #consoleFocusShell .yt-geo-city-head strong{font-size:18px}
      #consoleFocusShell .yt-geo-city-head>b{font-size:13px}
      @media(max-width:900px){.yt-geo-city-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('controlroom:geographydata', event => {
    geo = event && event.detail ? event.detail : window.SkyrScoutGeographyState || null;
    renderAll();
  });

  document.addEventListener('click', event => {
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
      setTab('cities');
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
      window.setTimeout(renderAll, 0);
    }
  });

  ensureStyle();
  renderAll();
})();
