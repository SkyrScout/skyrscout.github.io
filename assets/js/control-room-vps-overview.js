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

  const ISO_TO_MAP = {
    NO:'Norway', US:'United States of America', GB:'United Kingdom', UK:'United Kingdom',
    SE:'Sweden', DK:'Denmark', FI:'Finland', IS:'Iceland', DE:'Germany', FR:'France',
    NL:'Netherlands', BE:'Belgium', ES:'Spain', PT:'Portugal', IT:'Italy', PL:'Poland',
    EE:'Estonia', LV:'Latvia', LT:'Lithuania', IE:'Ireland', CA:'Canada', BR:'Brazil',
    AR:'Argentina', CL:'Chile', UY:'Uruguay', PY:'Paraguay', BO:'Bolivia', PE:'Peru',
    CO:'Colombia', EC:'Ecuador', VE:'Venezuela', MX:'Mexico', CR:'Costa Rica',
    HN:'Honduras', SV:'El Salvador', GT:'Guatemala', PA:'Panama', NI:'Nicaragua',
    JM:'Jamaica', DO:'Dominican Republic', PR:'Puerto Rico', AU:'Australia',
    NZ:'New Zealand', IN:'India', JP:'Japan', KR:'South Korea', CN:'China',
    ID:'Indonesia', MY:'Malaysia', SG:'Singapore', TH:'Thailand', VN:'Vietnam',
    PH:'Philippines', ZA:'South Africa', NG:'Nigeria', GH:'Ghana', CI:"Côte d'Ivoire",
    SN:'Senegal', MA:'Morocco', DZ:'Algeria', TN:'Tunisia', EG:'Egypt', KE:'Kenya',
    TZ:'Tanzania', UG:'Uganda', CM:'Cameroon', GA:'Gabon', CD:'Democratic Republic of the Congo',
    CG:'Republic of the Congo', AO:'Angola', ZM:'Zambia', ZW:'Zimbabwe',
    TR:'Turkey', GR:'Greece', HR:'Croatia', RS:'Serbia', SI:'Slovenia',
    SK:'Slovakia', CZ:'Czechia', AT:'Austria', CH:'Switzerland', HU:'Hungary',
    RO:'Romania', BG:'Bulgaria', UA:'Ukraine', GE:'Georgia', AM:'Armenia',
    AZ:'Azerbaijan', KZ:'Kazakhstan', KG:'Kyrgyzstan', UZ:'Uzbekistan',
    IL:'Israel', SA:'Saudi Arabia', AE:'United Arab Emirates', QA:'Qatar'
  };

  const DISPLAY_OVERRIDES = {
    'United States of America':'USA',
    'United Kingdom':'UK',
    "Côte d'Ivoire":"Ivory Coast"
  };

  const state = {
    byVideoId: new Map(),
    checkedAt: null,
    videosPolled: null,
    selectedVideoId: null,
    timer: null,
    loading: false,
    geography: null,
    selectedCountryKey: null,
    observer: null
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

  function fmtDate(value){
    if(value === null || value === undefined || value === '') return '';
    const s = String(value).trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(iso) return iso[3] + '.' + iso[2] + '.' + iso[1];
    const d = new Date(value);
    if(Number.isNaN(d.getTime())) return s;
    try{
      return new Intl.DateTimeFormat('nb-NO', {
        day:'2-digit', month:'2-digit', year:'numeric'
      }).format(d);
    }catch(_){
      return s;
    }
  }

  function esc(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
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
        '<div class="hf-empty">' +
        'Live view movement is supplied by the VPS collector. ' +
        'Full YouTube Analytics charts are not connected on this panel.' +
        '</div>';
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

  function findGeographyRoot(payload){
    const root = payload && payload.geography;
    return root && typeof root === 'object' && !Array.isArray(root)
      ? root
      : null;
  }

  function arrayFrom(root, names){
    if(!root || typeof root !== 'object'){
      return [];
    }

    for(const name of names){
      if(Array.isArray(root[name])){
        return root[name];
      }
    }

    const entries = Object.entries(root);

    for(const [key, value] of entries){
      if(
        Array.isArray(value) &&
        names.some(
          n => key.toLowerCase() === n.toLowerCase()
        )
      ){
        return value;
      }
    }

    return [];
  }

  function schemaFrom(root, names){
    for(const name of names){
      if(Array.isArray(root && root[name])){
        return root[name].map(String);
      }
    }

    return [];
  }

  function rowObject(row, schema){
    if(
      row &&
      !Array.isArray(row) &&
      typeof row === 'object'
    ){
      return row;
    }

    if(!Array.isArray(row)){
      return {};
    }

    const out = {};

    schema.forEach((key, i) => {
      out[String(key)] = row[i];
    });

    return out;
  }

  function firstValue(obj, names){
    for(const name of names){
      if(
        obj &&
        obj[name] !== undefined &&
        obj[name] !== null &&
        obj[name] !== ''
      ){
        return obj[name];
      }
    }

    const lookup = {};

    Object.keys(obj || {}).forEach(k => {
      lookup[k.toLowerCase()] = k;
    });

    for(const name of names){
      const actual =
        lookup[String(name).toLowerCase()];

      if(
        actual &&
        obj[actual] !== undefined &&
        obj[actual] !== null &&
        obj[actual] !== ''
      ){
        return obj[actual];
      }
    }

    return null;
  }

  function mapCountryName(raw){
    const s = String(raw || '').trim();

    if(!s){
      return '';
    }

    const upper = s.toUpperCase();

    if(ISO_TO_MAP[upper]){
      return ISO_TO_MAP[upper];
    }

    if(/^USA?$/i.test(s)){
      return 'United States of America';
    }

    if(/^UK$/i.test(s)){
      return 'United Kingdom';
    }

    return s;
  }

  function displayCountryName(mapName, rawDisplay){
    const d = String(rawDisplay || '').trim();

    if(d && d.length > 2){
      return d;
    }

    return DISPLAY_OVERRIDES[mapName] || mapName;
  }

  function countryKey(value){
    return mapCountryName(value).toLowerCase();
  }

  function normalizeCountries(root){
    const rows = Array.isArray(root && root.countries)
      ? root.countries
      : [];

    const normalized = rows.map(row => {
      if(!row || typeof row !== 'object' || Array.isArray(row)){
        return null;
      }

      const rawCountry = String(row.country || '').trim();
      const views = numberOrNull(row.views);
      if(!rawCountry || views === null){
        return null;
      }

      const mapName = mapCountryName(rawCountry);
      if(!mapName){
        return null;
      }

      return {
        raw: rawCountry,
        mapName,
        key: countryKey(mapName),
        display: displayCountryName(mapName, ''),
        views,
        share: null
      };
    }).filter(Boolean);

    const totalViews = normalized.reduce(
      (sum, item) => sum + item.views,
      0
    );

    normalized.forEach(item => {
      item.share = totalViews > 0
        ? item.views / totalViews * 100
        : null;
    });

    normalized.sort((a,b) => b.views - a.views);
    return normalized;
  }

  function findCountryDetailRoot(root){
    if(!root || typeof root !== 'object' || Array.isArray(root)){
      return null;
    }

    // The verified payload contains ISO-2 country keys whose values expose
    // topVideos[] and cities[]. The wrapper key itself was not needed by the UI,
    // so identify that single object by its observed structure rather than by
    // inventing alternate field names.
    const candidates = [root].concat(
      Object.values(root).filter(
        value => value && typeof value === 'object' && !Array.isArray(value)
      )
    );

    for(const candidate of candidates){
      const entries = Object.entries(candidate);
      const matches = entries.filter(([code, detail]) =>
        /^[A-Z]{2}$/.test(String(code)) &&
        detail && typeof detail === 'object' && !Array.isArray(detail) &&
        (Array.isArray(detail.topVideos) || Array.isArray(detail.cities))
      );
      if(matches.length){
        return candidate;
      }
    }

    return null;
  }

  function normalizeBreakdownRows(root, kind){
    const detailRoot = findCountryDetailRoot(root);
    const out = new Map();
    if(!detailRoot){
      return out;
    }

    const isVideo = kind === 'video';

    Object.entries(detailRoot).forEach(([countryCode, detail]) => {
      if(
        !/^[A-Z]{2}$/.test(String(countryCode)) ||
        !detail ||
        typeof detail !== 'object' ||
        Array.isArray(detail)
      ){
        return;
      }

      const source = isVideo ? detail.topVideos : detail.cities;
      if(!Array.isArray(source)){
        return;
      }

      const key = countryKey(countryCode);
      const list = source.map(item => {
        if(!item || typeof item !== 'object' || Array.isArray(item)){
          return null;
        }

        if(isVideo){
          const videoId = String(item.videoId || '').trim();
          const views = numberOrNull(item.views);
          if(!videoId || views === null){
            return null;
          }
          return {
            name: '',
            videoId,
            views
          };
        }

        const city = String(item.city || '').trim();
        const views = numberOrNull(item.views);
        if(!city || views === null){
          return null;
        }
        return {
          name: city,
          videoId: '',
          views
        };
      }).filter(Boolean);

      list.sort((a,b) => b.views - a.views);
      out.set(key, list);
    });

    return out;
  }

  function latestGeoDate(root){
    return root && root.endDate
      ? String(root.endDate)
      : '';
  }

  function normalizeGeography(payload){
    const root = findGeographyRoot(payload);

    if(!root){
      return null;
    }

    const countries =
      normalizeCountries(root);

    if(!countries.length){
      return null;
    }

    return {
      root,
      startDate: root.startDate ? String(root.startDate) : '',
      endDate: root.endDate ? String(root.endDate) : '',
      date: latestGeoDate(root),
      countries,
      videos:
        normalizeBreakdownRows(
          root,
          'video'
        ),
      cities:
        normalizeBreakdownRows(
          root,
          'city'
        )
    };
  }

  function ensureGeoStyle(){
    if(document.getElementById('vpsGeoStyle')){
      return;
    }

    const style = document.createElement('style');
    style.id = 'vpsGeoStyle';
    style.textContent = `
      .vps-geo-date{
        font-size:9px;
        color:#6f8998;
        margin:0 0 7px 0;
        letter-spacing:.04em
      }

      .vps-geo-detail-list{
        display:grid;
        gap:2px;
        margin:4px 0 10px
      }

      .vps-geo-detail-row{
        display:grid;
        grid-template-columns:minmax(0,1fr) auto;
        gap:10px;
        padding:6px 0;
        border-bottom:1px solid #10191e;
        font-size:10px
      }

      .vps-geo-detail-row span{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        color:#b8cbd5
      }

      .vps-geo-detail-row b{
        color:#f0f7fa
      }

      .vps-geo-node{
        pointer-events:none;
        opacity:var(--vps-geo-opacity,1)
      }

      .vps-geo-node .vps-geo-halo{
        fill:rgba(255,184,38,var(--vps-geo-halo-fill,.08));
        stroke:rgba(255,198,67,var(--vps-geo-halo-stroke,.52));
        stroke-width:.52;
        vector-effect:non-scaling-stroke;
        transform-box:fill-box;
        transform-origin:center;
        filter:drop-shadow(0 0 var(--vps-geo-halo-glow,3px) rgba(255,174,25,.72));
        animation:vpsGeoTrafficPulse 3.1s ease-out infinite;
        animation-delay:var(--vps-geo-delay,0s)
      }

      .vps-geo-node .vps-geo-core{
        fill:#ffd35a;
        stroke:#fff0a7;
        stroke-width:.28;
        vector-effect:non-scaling-stroke;
        opacity:.98;
        filter:
          drop-shadow(0 0 2px rgba(255,226,130,1))
          drop-shadow(0 0 var(--vps-geo-core-glow,5px) rgba(255,175,27,.95))
          drop-shadow(0 0 var(--vps-geo-outer-glow,10px) rgba(255,137,10,.62))
      }

      .vps-geo-node .vps-geo-ring{
        fill:none;
        stroke:rgba(255,199,79,var(--vps-geo-ring-opacity,.45));
        stroke-width:.38;
        vector-effect:non-scaling-stroke
      }

      .map-country-hit.vps-geo-country,
      .map-country-dot.vps-geo-country{
        fill:transparent!important;
        stroke:rgba(255,184,48,var(--vps-geo-edge,.08))!important;
        stroke-width:var(--vps-geo-stroke,.22)!important;
        vector-effect:non-scaling-stroke
      }

      .map-country-hit.vps-geo-country:hover,
      .map-country-dot.vps-geo-country:hover{
        fill:rgba(13,53,75,.16)!important;
        stroke:rgba(86,205,250,.72)!important
      }

      @keyframes vpsGeoTrafficPulse{
        0%{opacity:.78;transform:scale(.52)}
        58%{opacity:.14;transform:scale(1.50)}
        100%{opacity:0;transform:scale(1.95)}
      }

      @media (prefers-reduced-motion: reduce){
        .vps-geo-node .vps-geo-halo{animation:none;opacity:.24}
      }
    `;

    document.head.appendChild(style);
  }

  function geographyBodies(){
    return Array.from(
      document.querySelectorAll(
        '[data-screen="overview"] .geography-panel-body, ' +
        '#consoleFocusShell .geography-panel-body'
      )
    );
  }

  function mapBodies(){
    return Array.from(
      document.querySelectorAll(
        '[data-screen="overview"] .mapbody.map-interactive, ' +
        '#consoleFocusShell .mapbody.map-interactive'
      )
    );
  }

  function findMapHit(svg, country){
    const target =
      countryKey(country);

    return Array.from(
      svg.querySelectorAll(
        '.map-country-hit,.map-country-dot'
      )
    ).find(hit => {
      return countryKey(
        hit.dataset.country ||
        hit.dataset.display ||
        ''
      ) === target;
    }) || null;
  }

  function renderMapTraffic(){
    if(!state.geography){
      return;
    }

    ensureGeoStyle();

    const countries =
      state.geography.countries;

    const max = Math.max(
      1,
      ...countries.map(
        c =>
          c.views !== null
            ? c.views
            : (c.share || 0)
      )
    );

    mapBodies().forEach(body => {
      body.querySelectorAll(
        '.map-layer'
      ).forEach(svg => {
        svg.querySelectorAll(
          '.vps-geo-nodes'
        ).forEach(el => el.remove());

        svg.querySelectorAll(
          '.vps-geo-country'
        ).forEach(el => {
          el.classList.remove('vps-geo-country');
          el.style.removeProperty('--vps-geo-edge');
          el.style.removeProperty('--vps-geo-stroke');
        });

        const group =
          document.createElementNS(
            'http://www.w3.org/2000/svg',
            'g'
          );

        group.setAttribute(
          'class',
          'vps-geo-nodes'
        );

        const world =
          svg.classList.contains(
            'world-layer'
          );

        countries.forEach(country => {
          const hit =
            findMapHit(
              svg,
              country.mapName
            );

          if(!hit){
            return;
          }

          hit.classList.add(
            'vps-geo-country'
          );

          const rawWeight =
            country.views !== null
              ? country.views
              : (country.share || 0);
          const t = Math.max(
            .08,
            Math.min(1, rawWeight / max)
          );

          hit.style.setProperty(
            '--vps-geo-edge',
            (.035 + .20 * t).toFixed(3)
          );
          hit.style.setProperty(
            '--vps-geo-stroke',
            (.18 + .22 * t).toFixed(2)
          );

          const center = world
            ? hit.dataset.worldCenter
            : hit.dataset.detailCenter;

          if(!center){
            return;
          }

          const nums =
            center
              .split(/[ ,]+/)
              .map(Number);

          if(
            nums.length < 2 ||
            !Number.isFinite(nums[0]) ||
            !Number.isFinite(nums[1])
          ){
            return;
          }

          const scale =
            world ? 1 : 1.12;

          const cx = nums[0];
          const cy = nums[1];

          const g =
            document.createElementNS(
              'http://www.w3.org/2000/svg',
              'g'
            );

          g.setAttribute(
            'class',
            'vps-geo-node'
          );

          g.style.setProperty(
            '--vps-geo-opacity',
            (.42 + .58 * t).toFixed(2)
          );
          g.style.setProperty(
            '--vps-geo-delay',
            (-2.45 * t).toFixed(2) + 's'
          );
          g.style.setProperty(
            '--vps-geo-halo-fill',
            (.025 + .095 * t).toFixed(3)
          );
          g.style.setProperty(
            '--vps-geo-halo-stroke',
            (.24 + .48 * t).toFixed(3)
          );
          g.style.setProperty(
            '--vps-geo-ring-opacity',
            (.22 + .46 * t).toFixed(3)
          );
          g.style.setProperty(
            '--vps-geo-halo-glow',
            (1.5 + 4.5 * t).toFixed(1) + 'px'
          );
          g.style.setProperty(
            '--vps-geo-core-glow',
            (2.5 + 5.5 * t).toFixed(1) + 'px'
          );
          g.style.setProperty(
            '--vps-geo-outer-glow',
            (4.5 + 10.5 * t).toFixed(1) + 'px'
          );

          const halo =
            document.createElementNS(
              'http://www.w3.org/2000/svg',
              'circle'
            );

          halo.setAttribute(
            'class',
            'vps-geo-halo'
          );

          halo.setAttribute('cx',cx);
          halo.setAttribute('cy',cy);

          halo.setAttribute(
            'r',
            (
              (2.1 + 6.2 * t) *
              scale
            ).toFixed(2)
          );

          const ring =
            document.createElementNS(
              'http://www.w3.org/2000/svg',
              'circle'
            );

          ring.setAttribute(
            'class',
            'vps-geo-ring'
          );

          ring.setAttribute('cx',cx);
          ring.setAttribute('cy',cy);

          ring.setAttribute(
            'r',
            (
              (1.05 + 2.35 * t) *
              scale
            ).toFixed(2)
          );

          const core =
            document.createElementNS(
              'http://www.w3.org/2000/svg',
              'circle'
            );

          core.setAttribute(
            'class',
            'vps-geo-core'
          );

          core.setAttribute('cx',cx);
          core.setAttribute('cy',cy);

          core.setAttribute(
            'r',
            (
              (.52 + 1.62 * t) *
              scale
            ).toFixed(2)
          );

          g.append(
            halo,
            ring,
            core
          );

          group.appendChild(g);
        });

        const hitGroup =
          svg.querySelector(
            '.world-hit-zones,' +
            '.detail-hit-zones'
          );

        if(hitGroup){
          svg.insertBefore(
            group,
            hitGroup
          );
        }else{
          svg.appendChild(group);
        }
      });
    });
  }

  function renderGeoOverview(panel){
    if(!state.geography){
      return;
    }

    const overview =
      panel.querySelector(
        '.geo-overview-state'
      );

    if(!overview){
      return;
    }

    const geolist =
      overview.querySelector(
        '.geolist'
      );

    if(!geolist){
      return;
    }

    let date =
      overview.querySelector(
        '.vps-geo-date'
      );

    if(!date){
      date =
        document.createElement(
          'div'
        );

      date.className =
        'vps-geo-date';

      const title =
        overview.querySelector(
          '.mini-title'
        );

      if(
        title &&
        title.parentNode
      ){
        title.parentNode.insertBefore(
          date,
          title.nextSibling
        );
      }else{
        overview.prepend(date);
      }
    }

    if(state.geography.endDate){
      const period = state.geography.startDate
        ? fmtDate(state.geography.startDate) + ' → ' + fmtDate(state.geography.endDate)
        : fmtDate(state.geography.endDate);
      date.textContent = 'YouTube Analytics · ' + period;
    }else{
      date.textContent = 'Latest available YouTube Analytics geography';
    }

    geolist.replaceChildren();

    const maxShare = Math.max(
      1,
      ...state.geography.countries.map(
        c => c.share || 0
      )
    );

    state.geography.countries
      .forEach(country => {
        const button =
          document.createElement(
            'button'
          );

        button.className =
          'geoitem geo-country-link';

        button.type = 'button';

        button.dataset.mapCountry =
          country.mapName;

        button.dataset.vpsCountryKey =
          country.key;

        const row =
          document.createElement(
            'div'
          );

        row.className = 'georow';

        const name =
          document.createElement(
            'span'
          );

        name.textContent =
          country.display;

        const value =
          document.createElement(
            'b'
          );

        value.textContent =
          country.share !== null
            ? (
                country.share
                  .toFixed(
                    country.share >= 10
                      ? 1
                      : 2
                  )
                  .replace(
                    /\.00$/,
                    ''
                  ) +
                '%'
              )
            : fmtNumber(
                country.views
              );

        row.append(
          name,
          value
        );

        const bar =
          document.createElement(
            'div'
          );

        bar.className = 'geobar';

        const fill =
          document.createElement(
            'i'
          );

        const width =
          country.share !== null
            ? (
                country.share /
                maxShare *
                100
              )
            : 0;

        fill.style.width =
          Math.max(
            2,
            Math.min(
              100,
              width
            )
          ).toFixed(1) + '%';

        bar.appendChild(fill);

        button.append(
          row,
          bar
        );

        geolist.appendChild(
          button
        );
      });
  }

  function libraryTitle(videoId){
    if(!videoId){
      return '';
    }

    const row =
      document.querySelector(
        '[data-video-library-row]' +
        '[data-youtube-id="' +
        CSS.escape(videoId) +
        '"]'
      );

    if(!row){
      return '';
    }

    const title =
      row.querySelector(
        '.vmeta strong'
      );

    return title
      ? String(
          title.textContent || ''
        ).trim()
      : '';
  }

  function setMapScopeBadge(countryDisplay){
    if(!state.geography){
      return;
    }

    const latest = state.geography.endDate
      ? 'LATEST AVAILABLE · ' + fmtDate(state.geography.endDate)
      : 'LATEST AVAILABLE';

    document.querySelectorAll('.map-scope-badge').forEach(badge => {
      badge.textContent = countryDisplay
        ? countryDisplay + ' · ' + latest
        : latest;
    });
  }

  function renderGeoDetails(countryValue){
    if(!state.geography){
      return;
    }

    const key =
      countryKey(countryValue);

    const country =
      state.geography.countries
        .find(c => c.key === key);

    if(!country){
      return;
    }

    state.selectedCountryKey = key;
    setMapScopeBadge(country.display);

    geographyBodies()
      .forEach(panel => {
        const overview =
          panel.querySelector(
            '.geo-overview-state'
          );

        const detail =
          panel.querySelector(
            '.geo-country-state'
          );

        if(
          !overview ||
          !detail
        ){
          return;
        }

        overview.hidden = true;
        detail.hidden = false;

        const title =
          detail.querySelector(
            '.geo-country-title'
          );

        const share =
          detail.querySelector(
            '.geo-country-share'
          );

        if(title){
          title.textContent =
            country.display;
        }

        if(share){
          share.textContent =
            country.share !== null
              ? (
                  country.share
                    .toFixed(
                      country.share >= 10
                        ? 1
                        : 2
                    )
                    .replace(
                      /\.00$/,
                      ''
                    ) +
                  '% of latest geography'
                )
              : (
                  country.views !== null
                    ? (
                        fmtNumber(
                          country.views
                        ) +
                        ' views'
                      )
                    : 'Latest available'
                );
        }

        const videoBox =
          detail.querySelector(
            '.geo-country-info'
          );

        if(videoBox){
          const videos =
            state.geography.videos
              .get(key) || [];

          if(videos.length){
            videoBox.className =
              'geo-country-info ' +
              'vps-geo-detail-list';

            videoBox.innerHTML =
              videos
                .slice(0,10)
                .map(item => {
                  const titleText =
                    item.name ||
                    libraryTitle(
                      item.videoId
                    ) ||
                    item.videoId ||
                    'Video';

                  return (
                    '<div class="' +
                    'vps-geo-detail-row' +
                    '">' +
                    '<span title="' +
                    esc(titleText) +
                    '">' +
                    esc(titleText) +
                    '</span>' +
                    '<b>' +
                    esc(
                      fmtNumber(
                        item.views
                      )
                    ) +
                    '</b>' +
                    '</div>'
                  );
                })
                .join('');
          }else{
            videoBox.className =
              'geo-country-info';

            videoBox.textContent =
              'Video breakdown unavailable ' +
              'for this period';
          }
        }

        const cityBox =
          detail.querySelector(
            '.geo-city-status'
          );

        if(cityBox){
          const cities =
            state.geography.cities
              .get(key) || [];

          if(cities.length){
            cityBox.className =
              'geo-city-status ' +
              'vps-geo-detail-list';

            cityBox.innerHTML =
              cities
                .slice(0,12)
                .map(item =>
                  '<div class="' +
                  'vps-geo-detail-row' +
                  '">' +
                  '<span>' +
                  esc(item.name) +
                  '</span>' +
                  '<b>' +
                  esc(
                    fmtNumber(
                      item.views
                    )
                  ) +
                  '</b>' +
                  '</div>'
                )
                .join('');
          }else{
            cityBox.className =
              'geo-city-status';

            cityBox.textContent =
              'City data unavailable for this period';
          }
        }
      });
  }

  function renderGeography(payload){
    const geo =
      normalizeGeography(payload);

    if(!geo){
      return false;
    }

    state.geography = geo;

    const geoBody =
      document.querySelector(
        '[data-screen="overview"] ' +
        '.geography-panel-body'
      );

    const geoPanel =
      geoBody
        ? geoBody.closest(
            '.sidepanel'
          )
        : null;

    if(geoPanel){
      geoPanel.style.display = '';

      const badge =
        geoPanel.querySelector(
          '.ph .badge'
        );

      if(badge){
        badge.textContent = geo.endDate
          ? 'LATEST AVAILABLE · ' + fmtDate(geo.endDate)
          : 'LATEST AVAILABLE';
      }
    }

    const side =
      document.querySelector(
        '[data-screen="overview"] ' +
        '.topgrid .side'
      );

    if(side){
      side.style.gridTemplateRows = '';
    }

    geographyBodies()
      .forEach(
        renderGeoOverview
      );

    setMapScopeBadge(null);

    renderMapTraffic();

    if(state.selectedCountryKey){
      renderGeoDetails(
        state.selectedCountryKey
      );
    }

    return true;
  }

  function applyOverviewLayout(){
    const geoBody =
      document.querySelector(
        '[data-screen="overview"] ' +
        '.geography-panel-body'
      );

    const geoPanel =
      geoBody
        ? geoBody.closest(
            '.sidepanel'
          )
        : null;

    if(geoPanel){
      geoPanel.style.display = '';
    }

    const side =
      document.querySelector(
        '[data-screen="overview"] ' +
        '.topgrid .side'
      );

    if(side){
      side.style.gridTemplateRows = '';
    }

    const mapBadge =
      document.querySelector(
        '[data-screen="overview"] ' +
        '.map-scope-badge'
      );

    if(
      mapBadge &&
      !state.geography
    ){
      mapBadge.textContent =
        'MAP READY · DATA PENDING';
    }
  }

  function renderPayload(payload){
    state.byVideoId =
      decodeSnapshot(
        payload || {}
      );

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
      numberOrNull(
        payload &&
        payload.videosPolled
      );

    applyOverviewLayout();
    updateRealtimeSummary(
      payload || {}
    );
    populateLibrary();
    renderSelected();
    renderGeography(
      payload || {}
    );
  }

  function backend(){
    const b =
      window.SkyrScoutStaffBackend;

    return (
      b &&
      typeof b.fetchHeseFredrik ===
        'function'
    )
      ? b
      : null;
  }

  async function refresh(){
    if(state.loading){
      return;
    }

    const b = backend();

    if(!b){
      state.timer =
        window.setTimeout(
          refresh,
          1000
        );

      return;
    }

    state.loading = true;

    try{
      const payload =
        await b.fetchHeseFredrik(
          'debug'
        );

      renderPayload(
        payload || {}
      );
    }catch(error){
      console.warn(
        'Control Room VPS Overview:',
        error
      );
    }finally{
      state.loading = false;

      window.clearTimeout(
        state.timer
      );

      state.timer =
        window.setTimeout(
          refresh,
          REFRESH_MS
        );
    }
  }

  document.addEventListener(
    'controlroom:videoselected',
    event => {
      const id =
        event &&
        event.detail
          ? String(
              event.detail.videoId ||
              ''
            )
          : '';

      if(!id){
        return;
      }

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
        event.target &&
        event.target.closest
          ? event.target.closest(
              '[data-video-library-row]'
            )
          : null;

      if(row){
        const id =
          String(
            row.dataset.youtubeId ||
            ''
          );

        if(id){
          state.selectedVideoId = id;

          window.setTimeout(
            () => renderSelected(id),
            0
          );
        }
      }

      const geo =
        event.target &&
        event.target.closest
          ? event.target.closest(
              '[data-map-country]'
            )
          : null;

      if(
        geo &&
        state.geography
      ){
        const country =
          String(
            geo.dataset.mapCountry ||
            ''
          );

        if(country){
          window.setTimeout(
            () =>
              renderGeoDetails(
                country
              ),
            0
          );
        }
      }

      const hit =
        event.target &&
        event.target.closest
          ? event.target.closest(
              '.map-country-hit,' +
              '.map-country-dot'
            )
          : null;

      if(
        hit &&
        state.geography
      ){
        const country =
          String(
            hit.dataset.country ||
            hit.dataset.display ||
            ''
          );

        if(country){
          window.setTimeout(
            () =>
              renderGeoDetails(
                country
              ),
            0
          );
        }
      }

      const world =
        event.target &&
        event.target.closest
          ? event.target.closest(
              '.geo-world-view,' +
              '.map-world-btn'
            )
          : null;

      if(world){
        state.selectedCountryKey = null;

        window.setTimeout(
          () => {
            setMapScopeBadge(null);
            geographyBodies()
              .forEach(panel => {
                const overview =
                  panel.querySelector(
                    '.geo-overview-state'
                  );

                const detail =
                  panel.querySelector(
                    '.geo-country-state'
                  );

                if(overview){
                  overview.hidden =
                    false;
                }

                if(detail){
                  detail.hidden =
                    true;
                }
              });
          },
          0
        );
      }
    }
  );

  function observeFocusMode(){
    const shell =
      document.getElementById(
        'consoleFocusShell'
      );

    if(
      !shell ||
      state.observer
    ){
      return;
    }

    state.observer =
      new MutationObserver(
        mutations => {
          if(!state.geography){
            return;
          }

          const panelChanged = mutations.some(mutation =>
            Array.from(mutation.addedNodes || []).some(node =>
              node &&
              node.nodeType === 1 &&
              (
                (node.matches && node.matches('.panel')) ||
                (node.querySelector && node.querySelector('.panel'))
              )
            )
          );

          if(!panelChanged){
            return;
          }

          window.setTimeout(
            () => {
              geographyBodies().forEach(renderGeoOverview);
              renderMapTraffic();

              if(state.selectedCountryKey){
                renderGeoDetails(state.selectedCountryKey);
              }else{
                setMapScopeBadge(null);
              }
            },
            0
          );
        }
      );

    state.observer.observe(
      shell,
      {
        childList:true,
        subtree:true
      }
    );
  }

  ensureGeoStyle();
  applyOverviewLayout();
  observeFocusMode();
  refresh();
})();
