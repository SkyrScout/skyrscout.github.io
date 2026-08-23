/*
 * Scoutland Yard Control Room — World Traffic city layer v1
 *
 * Adds to the existing World Traffic map without changing the YouTube
 * Geography collector or making any extra YouTube requests.
 *
 * Data source:
 *   window.SkyrScoutGeographyState / controlroom:geographydata
 *
 * Behaviour:
 *   - 2D / 7D / 28D / 90D map windows
 *   - country traffic on the world map
 *   - when a country is opened, a CITIES button becomes available
 *   - CITIES replaces the large country activity node with the city rows
 *     YouTube actually returned for the selected window
 *   - city lat/lng are supplied by control-room-geography-v2.gs and cached
 *     there; this frontend never geocodes anything itself
 *
 * Geography is delayed. City rows may be incomplete. Missing city rows are
 * never interpreted as zero traffic.
 */
(function(){
  'use strict';

  const RANGE_KEYS = ['2d','7d','28d','90d'];
  const DETAIL_WORLD_WIDTH = 1036.8;
  const WEB_MERCATOR_LIMIT = 85.05112878;

  const local = {
    geography: null,
    rangeKey: '2d',
    selectedCountry: null,
    selectedDisplay: null,
    cityMode: false,
    observer: null
  };

  function esc(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function fmtNumber(value){
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
  }

  function fmtDate(value){
    const s = String(value || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? m[3] + '.' + m[2] + '.' + m[1] : s;
  }

  function countryKey(value){
    return String(value || '').trim().toLowerCase();
  }

  function mapBodies(){
    return Array.from(document.querySelectorAll('.mapbody.map-interactive'));
  }

  function geographyBodies(){
    return Array.from(document.querySelectorAll('.geography-panel-body'));
  }

  function currentWindow(){
    const geo = local.geography;
    if(!geo) return null;
    if(geo.windows && geo.windows[local.rangeKey]) return geo.windows[local.rangeKey];
    if(local.rangeKey === '2d') return geo;
    return null;
  }

  function findCountry(win, value){
    if(!win || !Array.isArray(win.countries)) return null;
    const key = countryKey(value);
    return win.countries.find(item =>
      countryKey(item.mapName) === key ||
      countryKey(item.display) === key ||
      countryKey(item.raw) === key ||
      countryKey(item.key) === key
    ) || null;
  }

  function rawCityRows(win, country){
    if(!win || !country || !win.root || typeof win.root !== 'object') return [];
    const rawCode = String(country.raw || '').toUpperCase();
    const detail = rawCode && win.root[rawCode] && typeof win.root[rawCode] === 'object'
      ? win.root[rawCode]
      : null;
    if(!detail || !Array.isArray(detail.cities)) return [];

    return detail.cities.map(row => {
      if(!row || typeof row !== 'object' || Array.isArray(row)) return null;
      const name = String(row.city || row.cityName || row.name || '').trim();
      const views = Number(row.views !== undefined ? row.views : row.viewCount);
      const lat = Number(row.lat);
      const lng = Number(row.lng);
      if(!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return {
        name,
        views: Number.isFinite(views) ? views : null,
        lat,
        lng
      };
    }).filter(Boolean).sort((a,b) => (b.views || 0) - (a.views || 0));
  }

  function mercatorPoint(lat, lng){
    const safeLat = Math.max(-WEB_MERCATOR_LIMIT, Math.min(WEB_MERCATOR_LIMIT, Number(lat)));
    const safeLng = Math.max(-180, Math.min(180, Number(lng)));
    if(!Number.isFinite(safeLat) || !Number.isFinite(safeLng)) return null;

    const x = (safeLng + 180) / 360 * DETAIL_WORLD_WIDTH;
    const phi = safeLat * Math.PI / 180;
    const y = (
      1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI
    ) / 2 * DETAIL_WORLD_WIDTH;

    return {x,y};
  }

  function ensureStyle(){
    if(document.getElementById('controlRoomMapCitiesStyle')) return;
    const style = document.createElement('style');
    style.id = 'controlRoomMapCitiesStyle';
    style.textContent = `
      .map-range-nav{
        position:absolute;z-index:10;right:12px;top:12px;
        display:flex;align-items:center;gap:4px;padding:3px;
        border:1px solid #16394a;border-radius:8px;background:rgba(0,4,7,.88);
        box-shadow:0 6px 18px rgba(0,0,0,.42)
      }
      .map-range-nav button,.map-city-mode-btn{
        appearance:none;border:1px solid transparent;border-radius:6px;
        background:transparent;color:#718c99;padding:4px 7px;
        font:800 7px/1 Arial,sans-serif;letter-spacing:.05em;cursor:pointer
      }
      .map-range-nav button:hover,.map-city-mode-btn:hover{
        color:#dff7ff;border-color:#276f8e;background:rgba(22,122,167,.11)
      }
      .map-range-nav button.active,.map-city-mode-btn.active{
        color:#e7fbff;border-color:#36a9d7;background:rgba(25,132,178,.18)
      }
      .map-city-mode-btn:disabled{opacity:.34;cursor:default;border-color:transparent;background:transparent}
      .map-geo-delay-note{
        position:absolute;z-index:7;left:12px;bottom:10px;pointer-events:none;
        color:#536a75;font:800 6.5px/1.2 Arial,sans-serif;letter-spacing:.07em;text-transform:uppercase
      }
      .mapbody.is-detail .map-geo-delay-note{bottom:10px}
      .mapbody.is-city-mode .detail-layer .vps-geo-nodes{display:none}
      .map-city-nodes{pointer-events:none}
      .map-city-node{pointer-events:all;cursor:default}
      .map-city-node .map-city-halo{
        fill:rgba(77,208,255,.08);stroke:rgba(96,220,255,.38);stroke-width:.52;
        vector-effect:non-scaling-stroke;filter:drop-shadow(0 0 4px rgba(52,193,244,.58))
      }
      .map-city-node .map-city-ring{
        fill:none;stroke:rgba(137,231,255,.70);stroke-width:.42;vector-effect:non-scaling-stroke
      }
      .map-city-node .map-city-core{
        fill:#8ce8ff;stroke:#e5fbff;stroke-width:.28;vector-effect:non-scaling-stroke;
        filter:drop-shadow(0 0 3px rgba(77,211,255,.95))
      }
      .map-city-empty{
        position:absolute;z-index:8;left:50%;top:50%;transform:translate(-50%,-50%);
        display:none;pointer-events:none;padding:7px 10px;border:1px solid #173b4b;border-radius:7px;
        background:rgba(0,4,7,.90);color:#71909e;font:800 8px/1.25 Arial,sans-serif;
        letter-spacing:.05em;text-align:center;text-transform:uppercase
      }
      .mapbody.is-city-mode.city-data-empty .map-city-empty{display:block}
      @media(max-width:760px){
        .map-range-nav{right:8px;top:8px;gap:2px}
        .map-range-nav button{padding:5px 6px}
        .map-geo-delay-note{display:none}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureControls(root){
    ensureStyle();
    (root || document).querySelectorAll('.mapbody.map-interactive').forEach(body => {
      if(!body.querySelector('.map-range-nav')){
        const ranges = document.createElement('div');
        ranges.className = 'map-range-nav';
        ranges.setAttribute('role','group');
        ranges.setAttribute('aria-label','World Traffic geography window');
        RANGE_KEYS.forEach(key => {
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.mapGeoRange = key;
          button.textContent = key.toUpperCase();
          ranges.appendChild(button);
        });
        ranges.addEventListener('pointerdown', event => event.stopPropagation());
        body.appendChild(ranges);
      }

      const nav = body.querySelector('.map-nav');
      if(nav && !nav.querySelector('.map-city-mode-btn')){
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'map-city-mode-btn';
        button.dataset.mapCityMode = 'toggle';
        button.textContent = 'CITIES';
        button.title = 'Show city traffic returned by YouTube';
        const world = nav.querySelector('.map-world-btn');
        if(world) world.insertAdjacentElement('afterend', button);
        else nav.prepend(button);
      }

      if(!body.querySelector('.map-geo-delay-note')){
        const note = document.createElement('div');
        note.className = 'map-geo-delay-note';
        note.textContent = 'Geography is delayed · city data may be incomplete';
        body.appendChild(note);
      }

      if(!body.querySelector('.map-city-empty')){
        const empty = document.createElement('div');
        empty.className = 'map-city-empty';
        empty.textContent = 'No city rows returned for this window';
        body.appendChild(empty);
      }
    });
    syncControlStates();
  }

  function syncControlStates(){
    const win = currentWindow();
    const country = local.selectedCountry ? findCountry(win, local.selectedCountry) : null;
    const cities = country ? rawCityRows(win, country) : [];

    mapBodies().forEach(body => {
      body.querySelectorAll('[data-map-geo-range]').forEach(button => {
        button.classList.toggle('active', button.dataset.mapGeoRange === local.rangeKey);
      });
      const cityButton = body.querySelector('.map-city-mode-btn');
      if(cityButton){
        cityButton.hidden = !body.classList.contains('is-detail');
        cityButton.disabled = !country || !cities.length;
        cityButton.classList.toggle('active', local.cityMode && !!cities.length);
        cityButton.textContent = local.cityMode && cities.length ? 'COUNTRY' : 'CITIES';
      }
      body.classList.toggle('is-city-mode', local.cityMode && !!cities.length);
      body.classList.toggle('city-data-empty', local.cityMode && !cities.length);
    });
  }

  function findMapHit(svg, country){
    const key = countryKey(country);
    return Array.from(svg.querySelectorAll('.map-country-hit,.map-country-dot')).find(hit =>
      countryKey(hit.dataset.country || hit.dataset.display) === key
    ) || null;
  }

  function renderCountryTraffic(){
    const win = currentWindow();
    if(!win || !Array.isArray(win.countries)) return;
    const countries = win.countries;
    const max = Math.max(1, ...countries.map(c => c.views !== null ? c.views : (c.share || 0)));

    mapBodies().forEach(body => {
      body.querySelectorAll('.map-layer').forEach(svg => {
        svg.querySelectorAll('.vps-geo-nodes').forEach(el => el.remove());
        svg.querySelectorAll('.vps-geo-country').forEach(el => {
          el.classList.remove('vps-geo-country');
          el.style.removeProperty('--vps-geo-edge');
          el.style.removeProperty('--vps-geo-stroke');
        });

        const group = document.createElementNS('http://www.w3.org/2000/svg','g');
        group.setAttribute('class','vps-geo-nodes');
        const world = svg.classList.contains('world-layer');

        countries.forEach(country => {
          const hit = findMapHit(svg, country.mapName);
          if(!hit) return;
          hit.classList.add('vps-geo-country');
          const weight = country.views !== null ? country.views : (country.share || 0);
          const t = Math.max(.08, Math.min(1, weight / max));
          hit.style.setProperty('--vps-geo-edge', (.035 + .20 * t).toFixed(3));
          hit.style.setProperty('--vps-geo-stroke', (.18 + .22 * t).toFixed(2));

          const center = world ? hit.dataset.worldCenter : hit.dataset.detailCenter;
          if(!center) return;
          const nums = center.split(/[ ,]+/).map(Number);
          if(nums.length < 2 || !Number.isFinite(nums[0]) || !Number.isFinite(nums[1])) return;
          const scale = world ? 1 : 1.12;
          const cx = nums[0], cy = nums[1];

          const g = document.createElementNS('http://www.w3.org/2000/svg','g');
          g.setAttribute('class','vps-geo-node');
          g.style.setProperty('--vps-geo-opacity', (.42 + .58 * t).toFixed(2));
          g.style.setProperty('--vps-geo-delay', (-2.45 * t).toFixed(2) + 's');
          g.style.setProperty('--vps-geo-halo-fill', (.025 + .095 * t).toFixed(3));
          g.style.setProperty('--vps-geo-halo-stroke', (.24 + .48 * t).toFixed(3));
          g.style.setProperty('--vps-geo-ring-opacity', (.22 + .46 * t).toFixed(3));
          g.style.setProperty('--vps-geo-halo-glow', (1.5 + 4.5 * t).toFixed(1) + 'px');
          g.style.setProperty('--vps-geo-core-glow', (2.5 + 5.5 * t).toFixed(1) + 'px');
          g.style.setProperty('--vps-geo-outer-glow', (4.5 + 10.5 * t).toFixed(1) + 'px');

          const halo = document.createElementNS('http://www.w3.org/2000/svg','circle');
          halo.setAttribute('class','vps-geo-halo');
          halo.setAttribute('cx',cx); halo.setAttribute('cy',cy);
          halo.setAttribute('r',((2.1 + 6.2 * t) * scale).toFixed(2));

          const ring = document.createElementNS('http://www.w3.org/2000/svg','circle');
          ring.setAttribute('class','vps-geo-ring');
          ring.setAttribute('cx',cx); ring.setAttribute('cy',cy);
          ring.setAttribute('r',((1.05 + 2.35 * t) * scale).toFixed(2));

          const core = document.createElementNS('http://www.w3.org/2000/svg','circle');
          core.setAttribute('class','vps-geo-core');
          core.setAttribute('cx',cx); core.setAttribute('cy',cy);
          core.setAttribute('r',((.52 + 1.62 * t) * scale).toFixed(2));

          g.append(halo,ring,core);
          group.appendChild(g);
        });

        const hitGroup = svg.querySelector('.world-hit-zones,.detail-hit-zones');
        if(hitGroup) svg.insertBefore(group,hitGroup);
        else svg.appendChild(group);
      });
    });
  }

  function renderCityTraffic(){
    const win = currentWindow();
    const country = local.selectedCountry ? findCountry(win, local.selectedCountry) : null;
    const cities = country ? rawCityRows(win, country) : [];
    const max = Math.max(1, ...cities.map(city => city.views || 0));

    mapBodies().forEach(body => {
      const svg = body.querySelector('.detail-layer');
      if(!svg) return;
      svg.querySelectorAll('.map-city-nodes').forEach(el => el.remove());
      if(!local.cityMode || !country || !cities.length) return;

      const group = document.createElementNS('http://www.w3.org/2000/svg','g');
      group.setAttribute('class','map-city-nodes');

      cities.forEach(city => {
        const p = mercatorPoint(city.lat, city.lng);
        if(!p) return;
        const t = Math.max(.12, Math.min(1, (city.views || 0) / max));
        const g = document.createElementNS('http://www.w3.org/2000/svg','g');
        g.setAttribute('class','map-city-node');
        g.dataset.city = city.name;
        g.dataset.cityViews = city.views === null ? '' : String(city.views);
        g.dataset.cityLat = String(city.lat);
        g.dataset.cityLng = String(city.lng);

        const halo = document.createElementNS('http://www.w3.org/2000/svg','circle');
        halo.setAttribute('class','map-city-halo');
        halo.setAttribute('cx',p.x.toFixed(3)); halo.setAttribute('cy',p.y.toFixed(3));
        halo.setAttribute('r',(2.3 + 3.2 * t).toFixed(2));

        const ring = document.createElementNS('http://www.w3.org/2000/svg','circle');
        ring.setAttribute('class','map-city-ring');
        ring.setAttribute('cx',p.x.toFixed(3)); ring.setAttribute('cy',p.y.toFixed(3));
        ring.setAttribute('r',(1.2 + 1.25 * t).toFixed(2));

        const core = document.createElementNS('http://www.w3.org/2000/svg','circle');
        core.setAttribute('class','map-city-core');
        core.setAttribute('cx',p.x.toFixed(3)); core.setAttribute('cy',p.y.toFixed(3));
        core.setAttribute('r',(.62 + .70 * t).toFixed(2));

        g.append(halo,ring,core);
        group.appendChild(g);
      });

      const hitGroup = svg.querySelector('.detail-hit-zones');
      if(hitGroup) svg.insertBefore(group,hitGroup);
      else svg.appendChild(group);
    });

    syncControlStates();
  }

  function mapBadge(){
    const win = currentWindow();
    if(!win) return;
    const date = win.endDate ? 'LATEST AVAILABLE · ' + fmtDate(win.endDate) : 'LATEST AVAILABLE';
    const period = local.rangeKey.toUpperCase();
    const country = local.selectedCountry ? findCountry(win, local.selectedCountry) : null;
    const display = country ? country.display : local.selectedDisplay;
    document.querySelectorAll('.map-scope-badge').forEach(badge => {
      badge.textContent = display
        ? display + ' · ' + period + ' · ' + date
        : period + ' · ' + date;
    });
  }

  function renderOverviewGeography(){
    const win = currentWindow();
    if(!win) return;

    geographyBodies().forEach(panel => {
      const parentPanel = panel.closest('.sidepanel,.panel');
      const badge = parentPanel && parentPanel.querySelector('.ph .badge');
      if(badge){
        badge.textContent = local.rangeKey.toUpperCase() + (win.endDate ? ' · ' + fmtDate(win.endDate) : '');
      }

      const delay = panel.querySelector('.geo-delay-note');
      if(delay){
        delay.textContent = 'Geography is delayed and may be incomplete, especially at city level.';
      }

      const overview = panel.querySelector('.geo-overview-state');
      const detail = panel.querySelector('.geo-country-state');
      if(!overview || !detail) return;

      if(!local.selectedCountry){
        overview.hidden = false;
        detail.hidden = true;
        const title = overview.querySelector('.mini-title');
        if(title) title.textContent = 'Top countries · ' + local.rangeKey.toUpperCase();
        const geolist = overview.querySelector('.geolist');
        if(!geolist) return;
        geolist.replaceChildren();
        const maxShare = Math.max(1, ...win.countries.map(c => c.share || 0));
        win.countries.forEach(country => {
          const button = document.createElement('button');
          button.className = 'geoitem geo-country-link';
          button.type = 'button';
          button.dataset.mapCountry = country.mapName;
          const row = document.createElement('div');
          row.className = 'georow';
          const name = document.createElement('span');
          name.textContent = country.display;
          const value = document.createElement('b');
          value.textContent = country.share !== null
            ? country.share.toFixed(country.share >= 10 ? 1 : 2).replace(/\.00$/,'') + '%'
            : fmtNumber(country.views);
          row.append(name,value);
          const bar = document.createElement('div');
          bar.className = 'geobar';
          const fill = document.createElement('i');
          const width = country.share !== null ? country.share / maxShare * 100 : 0;
          fill.style.width = Math.max(2,Math.min(100,width)).toFixed(1) + '%';
          bar.appendChild(fill);
          button.append(row,bar);
          geolist.appendChild(button);
        });
        return;
      }

      overview.hidden = true;
      detail.hidden = false;
      const country = findCountry(win, local.selectedCountry);
      const title = detail.querySelector('.geo-country-title');
      const share = detail.querySelector('.geo-country-share');
      const videoBox = detail.querySelector('.geo-country-info');
      const cityBox = detail.querySelector('.geo-city-status');

      if(!country){
        if(title) title.textContent = local.selectedDisplay || local.selectedCountry;
        if(share) share.textContent = 'No reported traffic in ' + local.rangeKey.toUpperCase();
        if(videoBox){ videoBox.className='geo-country-info'; videoBox.textContent='Video breakdown unavailable for this period'; }
        if(cityBox){ cityBox.className='geo-city-status'; cityBox.textContent='City data unavailable for this period'; }
        return;
      }

      if(title) title.textContent = country.display;
      if(share){
        share.textContent = country.share !== null
          ? country.share.toFixed(country.share >= 10 ? 1 : 2).replace(/\.00$/,'') + '% of ' + local.rangeKey.toUpperCase() + ' geography'
          : fmtNumber(country.views) + ' views';
      }

      const videos = win.videos && typeof win.videos.get === 'function' ? (win.videos.get(country.key) || []) : [];
      if(videoBox){
        if(videos.length){
          videoBox.className = 'geo-country-info vps-geo-detail-list';
          videoBox.innerHTML = videos.slice(0,10).map(item =>
            '<div class="vps-geo-detail-row"><span title="' + esc(item.name || item.videoId || 'Video') + '">' +
            esc(item.name || item.videoId || 'Video') + '</span><b>' + esc(fmtNumber(item.views)) + '</b></div>'
          ).join('');
        }else{
          videoBox.className = 'geo-country-info';
          videoBox.textContent = 'Video breakdown unavailable for this period';
        }
      }

      const cities = win.cities && typeof win.cities.get === 'function' ? (win.cities.get(country.key) || []) : [];
      if(cityBox){
        if(cities.length){
          cityBox.className = 'geo-city-status vps-geo-detail-list';
          cityBox.innerHTML = cities.slice(0,12).map(item =>
            '<div class="vps-geo-detail-row"><span>' + esc(item.name) + '</span><b>' + esc(fmtNumber(item.views)) + '</b></div>'
          ).join('');
        }else{
          cityBox.className = 'geo-city-status';
          cityBox.textContent = 'City data unavailable for this period';
        }
      }
    });
  }

  function renderAll(){
    ensureControls(document);
    renderCountryTraffic();
    renderCityTraffic();
    renderOverviewGeography();
    mapBadge();
    syncControlStates();
  }

  function scheduleRender(){
    window.setTimeout(renderAll,0);
  }

  function setRange(key){
    if(!RANGE_KEYS.includes(key)) return;
    const geo = local.geography;
    if(!geo) return;
    if(key !== '2d' && !(geo.windows && geo.windows[key])) return;
    local.rangeKey = key;
    if(local.cityMode && local.selectedCountry){
      const win = currentWindow();
      const country = findCountry(win,local.selectedCountry);
      if(!country || !rawCityRows(win,country).length) local.cityMode = false;
    }
    renderAll();
  }

  function setSelectedCountry(value, display){
    local.selectedCountry = String(value || '').trim() || null;
    local.selectedDisplay = String(display || value || '').trim() || null;
    local.cityMode = false;
    scheduleRender();
  }

  function resetCountry(){
    local.selectedCountry = null;
    local.selectedDisplay = null;
    local.cityMode = false;
    scheduleRender();
  }

  function toggleCities(){
    const win = currentWindow();
    const country = local.selectedCountry ? findCountry(win,local.selectedCountry) : null;
    const cities = country ? rawCityRows(win,country) : [];
    if(!country || !cities.length){
      local.cityMode = false;
      renderAll();
      return;
    }
    local.cityMode = !local.cityMode;
    renderAll();
  }

  document.addEventListener('controlroom:geographydata', event => {
    local.geography = event && event.detail ? event.detail : window.SkyrScoutGeographyState;
    const preferred = String(local.geography && local.geography.defaultWindow || '2d').toLowerCase();
    if(!RANGE_KEYS.includes(local.rangeKey)) local.rangeKey = RANGE_KEYS.includes(preferred) ? preferred : '2d';
    scheduleRender();
  });

  document.addEventListener('click', event => {
    const range = event.target.closest('[data-map-geo-range]');
    if(range){
      event.preventDefault();
      event.stopPropagation();
      setRange(String(range.dataset.mapGeoRange || '').toLowerCase());
      return;
    }

    const cityToggle = event.target.closest('[data-map-city-mode]');
    if(cityToggle){
      event.preventDefault();
      event.stopPropagation();
      toggleCities();
      return;
    }

    const world = event.target.closest('.map-world-btn,.geo-world-view');
    if(world){
      resetCountry();
      return;
    }

    const geo = event.target.closest('[data-map-country]');
    if(geo){
      const value = String(geo.dataset.mapCountry || '').trim();
      if(value){
        const win = currentWindow();
        const country = findCountry(win,value);
        setSelectedCountry(value,country ? country.display : value);
      }
      return;
    }

    const hit = event.target.closest('.map-country-hit,.map-country-dot');
    if(hit){
      const value = String(hit.dataset.country || hit.dataset.display || '').trim();
      if(value){
        const win = currentWindow();
        const country = findCountry(win,value);
        setSelectedCountry(value,country ? country.display : (hit.dataset.display || value));
      }
    }
  });

  document.addEventListener('mousemove', event => {
    const city = event.target.closest && event.target.closest('.map-city-node');
    if(!city) return;
    const body = city.closest('.mapbody');
    const label = body && body.querySelector('.map-hover-label');
    if(!body || !label) return;
    const rect = body.getBoundingClientRect();
    const views = city.dataset.cityViews ? ' · ' + fmtNumber(city.dataset.cityViews) + ' views' : '';
    label.textContent = city.dataset.city + views;
    label.style.left = Math.min(rect.width - 170,Math.max(8,event.clientX - rect.left + 12)) + 'px';
    label.style.top = Math.min(rect.height - 36,Math.max(8,event.clientY - rect.top + 12)) + 'px';
    label.style.display = 'block';
  });

  document.addEventListener('mouseout', event => {
    if(!(event.target.closest && event.target.closest('.map-city-node'))) return;
    const body = event.target.closest('.mapbody');
    const label = body && body.querySelector('.map-hover-label');
    if(label) label.style.display = 'none';
  });

  const shell = document.getElementById('consoleFocusShell');
  if(shell){
    local.observer = new MutationObserver(() => {
      ensureControls(shell);
      scheduleRender();
    });
    local.observer.observe(shell,{childList:true,subtree:true});
  }

  ensureControls(document);
  if(window.SkyrScoutGeographyState){
    local.geography = window.SkyrScoutGeographyState;
    scheduleRender();
  }

  window.SkyrScoutWorldTrafficMap = Object.freeze({
    setRange,
    render:renderAll,
    getState:function(){
      return {
        rangeKey:local.rangeKey,
        selectedCountry:local.selectedCountry,
        cityMode:local.cityMode
      };
    }
  });
})();
