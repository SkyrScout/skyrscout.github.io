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
    TZ:'Tanzania', UG:'Uganda', CM:'Cameroon', GA:'Gabon', ET:'Ethiopia', SO:'Somalia', CD:'Democratic Republic of the Congo',
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

  const REGION_NAMES =
    typeof Intl !== 'undefined' &&
    typeof Intl.DisplayNames === 'function'
      ? new Intl.DisplayNames(['en'], {type:'region'})
      : null;

  const state = {
    byVideoId: new Map(),
    checkedAt: null,
    videosPolled: null,
    selectedVideoId: null,
    timer: null,
    loading: false,
    geography: null,
    geographyWindowKey: '2d',
    selectedCountryKey: null,
    cityMode: false,
    realtimeMonitor: null,
    realtimeWindowKey: '48h',
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

  function realtimePanels(){
    return Array.from(
      document.querySelectorAll('.realtime-monitor-panel')
    );
  }

  function realtimeWindowLabel(key){
    return key === '60m' ? '60M' : '48H';
  }

  function realtimeWindowCopy(key){
    return key === '60m'
      ? {
          sub:'Rolling public counter movement · last 60 minutes',
          xStart:'60m ago'
        }
      : {
          sub:'Rolling public counter movement · last 48 hours',
          xStart:'48h ago'
        };
  }

  function niceRealtimeCeil(value){
    const n = Math.max(0, Number(value) || 0);
    if(n <= 0) return 1;
    const power = Math.pow(10, Math.floor(Math.log10(n)));
    const scaled = n / power;
    const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
    return nice * power;
  }

  function niceRealtimeFloor(value){
    const n = Math.min(0, Number(value) || 0);
    if(n >= 0) return 0;
    return -niceRealtimeCeil(Math.abs(n));
  }

  function fmtRealtimeAxis(value){
    const n = Number(value);
    if(!Number.isFinite(n)) return '—';
    if(Math.abs(n) >= 1000){
      const compact = n / 1000;
      return (Math.round(compact * 10) / 10).toLocaleString('en-US') + 'k';
    }
    return Math.round(n).toLocaleString('en-US');
  }

  function buildRealtimeChart(values){
    const safe = Array.isArray(values)
      ? values.map(value => numberOrNull(value))
      : [];

    const finite = safe.filter(value => value !== null);
    if(!finite.length){
      return {
        line:'', area:'', ticks:['—','—','—','—'], zero:null
      };
    }

    const rawMax = Math.max(0, ...finite);
    const rawMin = Math.min(0, ...finite);
    let yMax = niceRealtimeCeil(rawMax);
    let yMin = niceRealtimeFloor(rawMin);

    if(yMax === yMin){
      yMax = yMin + 1;
    }

    const width = 1000;
    const height = 300;
    const span = yMax - yMin;
    const xFor = index => safe.length <= 1
      ? width / 2
      : (index / (safe.length - 1)) * width;
    const yFor = value => ((yMax - value) / span) * height;
    const zeroY = yFor(0);

    const lineParts = [];
    const areaParts = [];
    let run = [];

    function flushRun(){
      if(!run.length) return;
      lineParts.push(
        run.map((point,index) =>
          (index ? 'L' : 'M') + point.x.toFixed(2) + ',' + point.y.toFixed(2)
        ).join(' ')
      );
      areaParts.push(
        'M' + run[0].x.toFixed(2) + ',' + zeroY.toFixed(2) + ' ' +
        run.map(point =>
          'L' + point.x.toFixed(2) + ',' + point.y.toFixed(2)
        ).join(' ') + ' ' +
        'L' + run[run.length - 1].x.toFixed(2) + ',' + zeroY.toFixed(2) + ' Z'
      );
      run = [];
    }

    safe.forEach((value,index) => {
      if(value === null){
        flushRun();
        return;
      }
      run.push({x:xFor(index),y:yFor(value)});
    });
    flushRun();

    const ticks = [0,1,2,3].map(index =>
      yMax - ((span / 3) * index)
    );

    return {
      line:lineParts.join(' '),
      area:areaParts.join(' '),
      ticks:ticks.map(fmtRealtimeAxis),
      zero:(rawMin < 0 && rawMax > 0)
        ? Math.max(0, Math.min(100, (zeroY / height) * 100))
        : (rawMin < 0 && rawMax === 0 ? 0 : null)
    };
  }

  function renderRealtimePanel(panel,windowData,key){
    if(!panel) return;

    const label = realtimeWindowLabel(key);
    const copy = realtimeWindowCopy(key);
    const total = panel.querySelector('[data-realtime-total]');
    const sub = panel.querySelector('[data-realtime-sub]');
    const status = panel.querySelector('[data-realtime-status]');
    const topTitle = panel.querySelector('[data-realtime-top-title]');
    const topList = panel.querySelector('[data-realtime-top-list]');
    const xStart = panel.querySelector('[data-realtime-x-start]');
    const line = panel.querySelector('[data-realtime-line]');
    const area = panel.querySelector('[data-realtime-area]');
    const yscale = panel.querySelector('[data-realtime-yscale]');
    const zeroLine = panel.querySelector('[data-realtime-zero-line]');

    panel.querySelectorAll('[data-realtime-window]').forEach(button => {
      const active = button.dataset.realtimeWindow === key;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',active ? 'true' : 'false');
    });

    if(sub) sub.textContent = copy.sub;
    if(xStart) xStart.textContent = copy.xStart;
    if(topTitle) topTitle.textContent = 'TOP VIDEOS · ' + label;

    if(!windowData || typeof windowData !== 'object'){
      if(total) total.textContent = '—';
      if(status) status.textContent = 'Waiting for sampled public-counter history…';
      if(line) line.setAttribute('d','');
      if(area) area.setAttribute('d','');
      if(yscale) yscale.querySelectorAll('span').forEach(node => { node.textContent = '—'; });
      if(zeroLine) zeroLine.hidden = true;
      if(topList) topList.innerHTML = '<div class="hf-empty">Waiting for Realtime Monitor data…</div>';
      return;
    }

    const complete = windowData.complete === true;
    const views = numberOrNull(windowData.views);
    const partialViews = numberOrNull(windowData.partialViews);
    const missing = numberOrNull(windowData.missingBaselines) || 0;
    const seriesMatches = windowData.seriesMatchesTotal;

    if(total){
      total.textContent = complete && views !== null
        ? fmtNumber(views)
        : '—';
      total.title = complete
        ? label + ' sampled public-counter movement'
        : (partialViews !== null
            ? 'Incomplete window · partial movement ' + fmtNumber(partialViews)
            : 'Incomplete window');
    }

    if(status){
      if(!complete){
        status.textContent = 'INCOMPLETE · ' + fmtNumber(missing) + ' BASELINE' + (missing === 1 ? '' : 'S') + ' MISSING';
        status.className = 'realtime-window-status is-warning';
      }else if(seriesMatches === false){
        status.textContent = 'CHECK DATA · SERIES/TOTAL MISMATCH';
        status.className = 'realtime-window-status is-warning';
      }else{
        const rollbackCount = Array.isArray(windowData.rollbackBuckets)
          ? windowData.rollbackBuckets.length
          : 0;
        status.textContent = rollbackCount
          ? 'COMPLETE · PUBLIC COUNTER CORRECTIONS PRESERVED'
          : 'COMPLETE · ROLLING WINDOW';
        status.className = 'realtime-window-status is-ok';
      }
    }

    const chart = buildRealtimeChart(windowData.values);
    if(line) line.setAttribute('d',chart.line);
    if(area) area.setAttribute('d',chart.area);
    if(yscale){
      const labels = yscale.querySelectorAll('span');
      chart.ticks.forEach((tick,index) => {
        if(labels[index]) labels[index].textContent = tick;
      });
    }
    if(zeroLine){
      if(chart.zero === null){
        zeroLine.hidden = true;
        zeroLine.style.top = '';
      }else{
        zeroLine.hidden = false;
        zeroLine.style.top = chart.zero.toFixed(2) + '%';
      }
    }

    if(topList){
      topList.innerHTML = '';
      const rows = Array.isArray(windowData.top) ? windowData.top : [];
      if(!rows.length){
        const empty = document.createElement('div');
        empty.className = 'hf-empty';
        empty.textContent = 'No positive public-counter movement in this window.';
        topList.appendChild(empty);
      }else{
        rows.forEach((row,index) => {
          const videoId = Array.isArray(row) ? String(row[0] || '') : '';
          const delta = Array.isArray(row) ? numberOrNull(row[1]) : null;
          const title = Array.isArray(row) ? String(row[2] || videoId || 'YouTube video') : 'YouTube video';
          const item = document.createElement('div');
          item.className = 'rtrow realtime-top-row';
          item.dataset.rank = String(index + 1);
          if(videoId) item.dataset.videoId = videoId;
          const name = document.createElement('span');
          name.textContent = title;
          name.title = title;
          const value = document.createElement('b');
          value.textContent = delta === null ? '—' : fmtNumber(delta);
          value.title = label + ' public-counter movement';
          item.append(name,value);
          topList.appendChild(item);
        });
      }
    }
  }

  function renderRealtimeMonitor(){
    const monitor = state.realtimeMonitor;
    const windows = monitor && monitor.windows && typeof monitor.windows === 'object'
      ? monitor.windows
      : {};
    const key = state.realtimeWindowKey === '60m' ? '60m' : '48h';
    const windowData = windows[key] || null;
    realtimePanels().forEach(panel => renderRealtimePanel(panel,windowData,key));
  }

  function updateRealtimeSummary(payload){
    state.realtimeMonitor = payload && payload.realtimeMonitor && typeof payload.realtimeMonitor === 'object'
      ? payload.realtimeMonitor
      : null;
    renderRealtimeMonitor();
  }

  function hasGeoShape(obj){
    if(!obj || typeof obj !== 'object' || Array.isArray(obj)){
      return false;
    }

    // Verified current shape: countries[] plus optional ISO-2 detail objects.
    if(Array.isArray(obj.countries) && obj.countries.length){
      return true;
    }

    const keys = Object.keys(obj).map(key => key.toLowerCase());
    const hasCountryKey = keys.some(key => key.includes('countr'));
    const hasGeoKey = keys.some(key => key.includes('geograph'));
    const hasRows = Object.values(obj).some(
      value => Array.isArray(value) && value.length
    );

    return (hasCountryKey || hasGeoKey) && hasRows;
  }

  function findGeographyRoot(payload){
    const preferred = [
      payload && payload.geography,
      payload && payload.geographySnapshot,
      payload && payload.youtubeAnalyticsGeography,
      payload && payload.analyticsGeography,
      payload && payload.analytics && payload.analytics.geography,
      payload && payload.youtubeAnalytics && payload.youtubeAnalytics.geography
    ].filter(Boolean);

    for(const candidate of preferred){
      if(candidate && typeof candidate === 'object' && hasGeoShape(candidate)){
        return candidate;
      }
    }

    // Do not assume the Firebase/function wrapper will always keep Geography
    // at payload.geography. Search only likely analytics/geography branches.
    const seen = new Set();

    function walk(value, depth){
      if(
        !value ||
        typeof value !== 'object' ||
        depth > 5 ||
        seen.has(value)
      ){
        return null;
      }

      seen.add(value);

      if(hasGeoShape(value)){
        return value;
      }

      for(const [key, child] of Object.entries(value)){
        if(!child || typeof child !== 'object'){
          continue;
        }

        if(/geograph|countr|audience|analytics|snapshot|debug|payload/i.test(key)){
          const hit = walk(child, depth + 1);
          if(hit){
            return hit;
          }
        }
      }

      return null;
    }

    return walk(payload, 0);
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

    if(/^[A-Z]{2}$/.test(upper) && REGION_NAMES){
      const resolved = REGION_NAMES.of(upper);
      if(resolved && resolved !== upper){
        const clean = String(resolved).replace(/’/g, "'");
        if(clean === 'United States'){
          return 'United States of America';
        }
        return clean;
      }
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
    const directRows = Array.isArray(root && root.countries)
      ? root.countries
      : [];

    let rows = directRows;
    let schema = [];

    if(!rows.length){
      rows = arrayFrom(root, [
        'countryRows',
        'geographyRows',
        'countryData',
        'topCountries',
        'latestCountryRows',
        'geographyCountryRows'
      ]);

      schema = schemaFrom(root, [
        'countrySchema',
        'countryRowSchema',
        'geographySchema',
        'countryColumns',
        'geographyColumns',
        'countryColumnHeaders'
      ]);
    }

    if(!rows.length && root && root.country && typeof root.country === 'object'){
      rows = Array.isArray(root.country.rows) ? root.country.rows : [];
      schema = schema.length ? schema : (
        root.country.schema ||
        root.country.columns ||
        root.country.columnHeaders ||
        []
      );
    }

    if(
      !rows.length &&
      root &&
      root.countries &&
      !Array.isArray(root.countries) &&
      Array.isArray(root.countries.rows)
    ){
      rows = root.countries.rows;
      schema = schema.length ? schema : (
        root.countries.schema ||
        root.countries.columns ||
        root.countries.columnHeaders ||
        []
      );
    }

    const normalized = [];

    rows.forEach(row => {
      const obj = rowObject(row, schema);

      let rawCountry = firstValue(obj, [
        'country','countryCode','country_code','code','iso','iso2',
        'name','countryName','country_name'
      ]);
      let views = numberOrNull(firstValue(obj, [
        'views','viewCount','view_count','count','value','traffic'
      ]));
      let share = numberOrNull(firstValue(obj, [
        'share','percentage','percent','pct','ratio'
      ]));
      let display = firstValue(obj, [
        'display','displayName','countryName','country_name','label'
      ]);

      if(Array.isArray(row) && !schema.length){
        rawCountry = row[0];
        views = numberOrNull(row[1]);
        if(row.length > 2){
          share = numberOrNull(row[2]);
        }
      }

      if(!rawCountry){
        return;
      }

      const mapName = mapCountryName(rawCountry);
      if(!mapName){
        return;
      }

      normalized.push({
        raw: String(rawCountry),
        mapName,
        key: countryKey(mapName),
        display: displayCountryName(mapName, display),
        views,
        share
      });
    });

    const totalViews = normalized.reduce(
      (sum, item) => sum + (item.views || 0),
      0
    );

    normalized.forEach(item => {
      if(item.share !== null){
        if(item.share > 0 && item.share <= 1){
          item.share *= 100;
        }
      }else if(totalViews > 0 && item.views !== null){
        item.share = item.views / totalViews * 100;
      }
    });

    normalized.sort(
      (a,b) => (b.views || b.share || 0) - (a.views || a.share || 0)
    );

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
    const isVideo = kind === 'video';
    const out = new Map();

    // 1) Verified current payload: ISO-2 keys with topVideos[] / cities[].
    const detailRoot = findCountryDetailRoot(root);
    if(detailRoot){
      Object.entries(detailRoot).forEach(([countryCode, detail]) => {
        if(
          !/^[A-Z]{2}$/i.test(String(countryCode)) ||
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
            const videoId = String(item.videoId || item.id || '').trim();
            const views = numberOrNull(
              item.views !== undefined ? item.views : item.viewCount
            );
            if(!videoId){
              return null;
            }
            return {
              name: String(item.title || item.videoTitle || ''),
              videoId,
              views
            };
          }

          const city = String(item.city || item.cityName || item.name || '').trim();
          const views = numberOrNull(
            item.views !== undefined ? item.views : item.viewCount
          );
          if(!city){
            return null;
          }
          return {
            name:city,
            videoId:'',
            views,
            lat:numberOrNull(item.lat),
            lng:numberOrNull(item.lng)
          };
        }).filter(Boolean);

        list.sort((a,b) => (b.views || 0) - (a.views || 0));
        out.set(key, list);
      });
    }

    // 2) Fallback row/schema payloads from earlier Analytics bridge versions.
    const rowNames = isVideo
      ? ['countryVideoRows','videoCountryRows','videosByCountryRows','topVideoRows','geographyVideoRows']
      : ['countryCityRows','cityCountryRows','citiesByCountryRows','cityRows','geographyCityRows'];

    const schemaNames = isVideo
      ? ['countryVideoSchema','videoCountrySchema','videoSchema','videoColumns','countryVideoColumns']
      : ['countryCitySchema','cityCountrySchema','citySchema','cityColumns','countryCityColumns'];

    const rows = arrayFrom(root, rowNames);
    const schema = schemaFrom(root, schemaNames);

    rows.forEach(row => {
      const obj = rowObject(row, schema);
      let country = firstValue(obj, [
        'country','countryCode','country_code','code','iso','countryName'
      ]);
      let views = numberOrNull(firstValue(obj, [
        'views','viewCount','view_count','count','value'
      ]));
      let name = firstValue(
        obj,
        isVideo
          ? ['title','videoTitle','video_title','name','videoId','video_id']
          : ['city','cityName','city_name','name','label']
      );
      let videoId = isVideo
        ? firstValue(obj, ['videoId','video_id','id'])
        : null;

      if(Array.isArray(row) && !schema.length){
        country = row[0];
        if(isVideo){
          videoId = row[1];
          name = row[2] || row[1];
          views = numberOrNull(row[3] !== undefined ? row[3] : row[2]);
        }else{
          name = row[1];
          views = numberOrNull(row[2]);
        }
      }

      if(!country || !name){
        return;
      }

      const key = countryKey(country);
      const target = out.get(key) || [];
      target.push({
        name:String(name),
        videoId:videoId ? String(videoId) : '',
        views
      });
      out.set(key,target);
    });

    // 3) Fallback object maps keyed by country.
    const objectNames = isVideo
      ? ['videosByCountry','topVideosByCountry','countryVideos']
      : ['citiesByCountry','countryCities','cityBreakdownByCountry'];

    objectNames.forEach(name => {
      const obj = root && root[name];
      if(!obj || typeof obj !== 'object' || Array.isArray(obj)){
        return;
      }

      Object.entries(obj).forEach(([country,list]) => {
        if(!Array.isArray(list)){
          return;
        }

        const key = countryKey(country);
        const target = out.get(key) || [];

        list.forEach(item => {
          if(item == null){
            return;
          }

          if(typeof item === 'string'){
            target.push({name:item, videoId:'', views:null});
            return;
          }

          if(Array.isArray(item)){
            target.push({
              name:String(item[isVideo ? 1 : 0] || item[0] || ''),
              videoId:isVideo ? String(item[0] || '') : '',
              views:numberOrNull(item[isVideo ? 2 : 1])
            });
            return;
          }

          if(typeof item === 'object'){
            target.push({
              name:String(
                firstValue(
                  item,
                  isVideo
                    ? ['title','videoTitle','name','videoId']
                    : ['city','cityName','name']
                ) || ''
              ),
              videoId:isVideo
                ? String(firstValue(item,['videoId','id']) || '')
                : '',
              views:numberOrNull(
                firstValue(item,['views','viewCount','count','value'])
              )
            });
          }
        });

        out.set(key,target);
      });
    });

    out.forEach(list => list.sort(
      (a,b) => (b.views || 0) - (a.views || 0)
    ));

    return out;
  }

  function latestGeoDate(root){
    if(root && root.endDate){
      return String(root.endDate);
    }

    return firstValue(root || {}, [
      'latestAvailableDate','latestDate','dataThrough','availableThrough',
      'throughDate','countryDate','geographyDate','reportDate','date'
    ]) || '';
  }

  function normalizeGeographyRoot(root){
    if(!root || typeof root !== 'object' || Array.isArray(root)){
      return null;
    }

    const countries = normalizeCountries(root);
    if(!countries.length){
      return null;
    }

    const date = latestGeoDate(root);

    return {
      root,
      key: root.key ? String(root.key) : '',
      label: root.label ? String(root.label) : '',
      days: numberOrNull(root.days),
      startDate: root.startDate ? String(root.startDate) : '',
      endDate: root.endDate ? String(root.endDate) : String(date || ''),
      date,
      countries,
      videos: normalizeBreakdownRows(root, 'video'),
      cities: normalizeBreakdownRows(root, 'city')
    };
  }

  function normalizeGeography(payload){
    const root = findGeographyRoot(payload);

    if(!root){
      return null;
    }

    // The top-level Geography fields remain the backward-compatible 2D window
    // used by the working Overview map.
    const normalized = normalizeGeographyRoot(root);
    if(!normalized){
      return null;
    }

    // Geography v3 adds independent 2D/7D/28D/90D windows.
    // Normalize and share them with the YouTube console without changing
    // the map's existing 2D behaviour.
    const windows = {};

    if(root.windows && typeof root.windows === 'object' && !Array.isArray(root.windows)){
      Object.entries(root.windows).forEach(([key, windowRoot]) => {
        const windowGeo = normalizeGeographyRoot(windowRoot);
        if(!windowGeo){
          return;
        }

        windowGeo.key = windowGeo.key || String(key);
        windowGeo.label = windowGeo.label || String(key).toUpperCase();
        windows[String(key)] = windowGeo;
      });
    }

    normalized.windows = windows;
    normalized.defaultWindow = String(root.defaultWindow || '2d');
    normalized.latestAvailableDate = String(
      root.latestAvailableDate ||
      normalized.endDate ||
      normalized.date ||
      ''
    );

    return normalized;
  }

  function activeGeography(){
    if(!state.geography){
      return null;
    }

    const key = String(
      state.geographyWindowKey ||
      state.geography.defaultWindow ||
      '2d'
    ).toLowerCase();

    const windows = state.geography.windows || {};
    return windows[key] || state.geography;
  }

  function setGeographyWindow(key){
    if(!state.geography){
      return;
    }

    const nextKey = String(key || '').toLowerCase();
    const windows = state.geography.windows || {};
    const next = windows[nextKey] || (
      nextKey === String(state.geography.defaultWindow || '2d').toLowerCase()
        ? state.geography
        : null
    );

    if(!next){
      return;
    }

    state.geographyWindowKey = nextKey;

    if(
      state.selectedCountryKey &&
      !next.countries.some(country => country.key === state.selectedCountryKey)
    ){
      state.selectedCountryKey = null;
      state.cityMode = false;
      const world = document.querySelector(
        '[data-screen="overview"] .map-world-btn'
      );
      if(world){
        window.setTimeout(() => world.click(), 0);
      }
    }

    geographyBodies().forEach(renderGeoOverview);
    renderMapTraffic();

    if(state.selectedCountryKey){
      renderGeoDetails(state.selectedCountryKey);
    }else{
      setMapScopeBadge(null);
    }
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

      .vps-map-window-nav{
        position:absolute;
        z-index:9;
        top:12px;
        right:12px;
        display:flex;
        gap:5px;
        padding:3px;
        border:1px solid rgba(28,83,109,.65);
        border-radius:8px;
        background:rgba(0,4,7,.86);
        box-shadow:0 6px 18px rgba(0,0,0,.42)
      }

      .vps-map-window-nav button{
        height:24px;
        min-width:31px;
        padding:0 6px;
        border:1px solid transparent;
        border-radius:6px;
        background:transparent;
        color:#688695;
        font:800 8px/1 Arial,sans-serif;
        cursor:pointer
      }

      .vps-map-window-nav button:hover{
        color:#dff7ff;
        border-color:#1c536d
      }

      .vps-map-window-nav button.active{
        color:#eefaff;
        border-color:#39b7ee;
        background:#061923
      }

      .vps-map-city-toggle.active{
        color:#eefaff!important;
        border-color:#39b7ee!important;
        background:#061923!important
      }

      .vps-map-city-toggle:disabled{
        opacity:.34;
        cursor:default
      }

      .mapbody.vps-city-mode .detail-layer .vps-geo-nodes{
        opacity:0;
        pointer-events:none
      }

      .vps-city-nodes{
        pointer-events:all
      }

      .vps-city-node,
      .vps-city-node *{
        pointer-events:all;
        cursor:default
      }

      .map-hover-label.vps-city-hover{
        font-size:11px;
        line-height:1.2;
        font-weight:800;
        padding:6px 9px;
        border-color:#4adfff;
        box-shadow:
          0 8px 20px rgba(0,0,0,.68),
          0 0 14px rgba(74,220,255,.16)
      }

      .console-focus-shell.map-focus .map-hover-label.vps-city-hover{
        font-size:14px!important;
        line-height:1.2;
        padding:8px 11px!important
      }

      .vps-city-node .vps-city-halo{
        fill:rgba(74,220,255,.08);
        stroke:rgba(91,224,255,.62);
        stroke-width:.20;
        vector-effect:non-scaling-stroke;
        transform-box:fill-box;
        transform-origin:center;
        filter:drop-shadow(0 0 2px rgba(70,210,255,.78));
        animation:vpsCityTrafficPulse 3.8s ease-in-out infinite
      }

      .vps-city-node .vps-city-core{
        fill:#dffcff;
        stroke:#62e0ff;
        stroke-width:.20;
        vector-effect:non-scaling-stroke;
        filter:
          drop-shadow(0 0 1.5px rgba(225,253,255,1))
          drop-shadow(0 0 3px rgba(56,197,241,.92))
      }

      .vps-map-delay-note{
        position:absolute;
        z-index:7;
        left:12px;
        bottom:9px;
        color:#49626e;
        font:700 7px/1.2 Arial,sans-serif;
        letter-spacing:.04em;
        text-transform:uppercase;
        pointer-events:none
      }

      @keyframes vpsCityTrafficPulse{
        0%,100%{opacity:.66;transform:scale(.82)}
        50%{opacity:.18;transform:scale(1.42)}
      }

      @keyframes vpsGeoTrafficPulse{
        0%{opacity:.78;transform:scale(.52)}
        58%{opacity:.14;transform:scale(1.50)}
        100%{opacity:0;transform:scale(1.95)}
      }

      @media (prefers-reduced-motion: reduce){
        .vps-geo-node .vps-geo-halo{animation:none;opacity:.24}
        .vps-city-node .vps-city-halo{animation:none;opacity:.34}
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

  function ensureMapControls(body){
    if(!body){
      return;
    }

    let windowNav = body.querySelector('.vps-map-window-nav');
    if(!windowNav){
      windowNav = document.createElement('div');
      windowNav.className = 'vps-map-window-nav';
      windowNav.setAttribute('aria-label','Geography traffic window');
      ['2d','7d','28d','90d'].forEach(key => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.vpsGeoWindow = key;
        button.textContent = key.toUpperCase();

        // The map's own pointerdown handler starts drag/pointer-capture on any
        // control that is not inside .map-nav. Keep period controls completely
        // outside that drag lifecycle so 7D/28D/90D clicks are reliable.
        button.addEventListener('pointerdown', event => {
          event.stopPropagation();
        });
        button.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          setGeographyWindow(key);
        });

        windowNav.appendChild(button);
      });
      body.appendChild(windowNav);
    }

    windowNav.querySelectorAll('[data-vps-geo-window]').forEach(button => {
      const active = String(button.dataset.vpsGeoWindow || '').toLowerCase() ===
        String(state.geographyWindowKey || '2d').toLowerCase();
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',active ? 'true' : 'false');
    });

    const nav = body.querySelector('.map-nav');
    if(nav){
      let cityButton = nav.querySelector('.vps-map-city-toggle');
      if(!cityButton){
        cityButton = document.createElement('button');
        cityButton.type = 'button';
        cityButton.className = 'vps-map-city-toggle';
        cityButton.dataset.vpsCityToggle = '1';
        cityButton.addEventListener('pointerdown', event => {
          event.stopPropagation();
        });
        cityButton.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          if(cityButton.disabled){
            return;
          }
          state.cityMode = !state.cityMode;
          renderMapTraffic();
        });
        const world = nav.querySelector('.map-world-btn');
        if(world){
          world.insertAdjacentElement('afterend',cityButton);
        }else{
          nav.prepend(cityButton);
        }
      }

      const geo = activeGeography();
      const cities = geo && state.selectedCountryKey
        ? (geo.cities.get(state.selectedCountryKey) || [])
        : [];
      const resolved = cities.filter(city =>
        city.lat !== null && city.lng !== null
      );
      const enabled = body.classList.contains('is-detail') && resolved.length > 0;
      cityButton.disabled = !enabled;
      cityButton.classList.toggle('active',state.cityMode && enabled);
      cityButton.textContent = state.cityMode && enabled ? 'COUNTRY' : 'CITIES';
      cityButton.title = enabled
        ? (state.cityMode ? 'Return to country traffic' : 'Show city traffic')
        : 'No mapped city data for this country and period';
    }

    let note = body.querySelector('.vps-map-delay-note');
    if(!note){
      note = document.createElement('div');
      note.className = 'vps-map-delay-note';
      note.textContent = 'Geography is delayed · city data may be incomplete';
      body.appendChild(note);
    }
  }

  function projectCity(lat,lng){
    const width = 1036.8;
    const clampedLat = Math.max(-85.05112878,Math.min(85.05112878,lat));
    const latRad = clampedLat * Math.PI / 180;
    return {
      x:(lng + 180) / 360 * width,
      y:(1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * width
    };
  }

  function svgPointInside(hit,x,y){
    if(!hit || typeof hit.isPointInFill !== 'function'){
      return null;
    }

    try{
      const svg = hit.ownerSVGElement;
      if(!svg || typeof svg.createSVGPoint !== 'function'){
        return null;
      }

      const point = svg.createSVGPoint();
      point.x = x;
      point.y = y;
      return !!hit.isPointInFill(point);
    }catch(_){
      return null;
    }
  }

  function visualCityPoint(svg,mapName,point){
    const hit = findMapHit(svg,mapName);
    if(!hit){
      return point;
    }

    const inside = svgPointInside(hit,point.x,point.y);
    if(inside !== false){
      return point;
    }

    const centerRaw = hit.dataset.detailCenter || '';
    const center = centerRaw.split(/[ ,]+/).map(Number);
    if(
      center.length < 2 ||
      !Number.isFinite(center[0]) ||
      !Number.isFinite(center[1])
    ){
      return point;
    }

    const dx = center[0] - point.x;
    const dy = center[1] - point.y;
    const distance = Math.hypot(dx,dy);
    if(!distance){
      return point;
    }

    // The map deliberately uses simplified country outlines. Coastal cities can
    // therefore project a few SVG units outside the drawn land polygon even when
    // the real lat/lng is correct. Keep the real coordinates untouched and nudge
    // only the visual marker, by at most 10 SVG units, toward the country centre.
    const maxNudge = Math.min(10,distance);
    for(let moved = .5; moved <= maxNudge; moved += .5){
      const ratio = moved / distance;
      const candidate = {
        x:point.x + dx * ratio,
        y:point.y + dy * ratio
      };
      if(svgPointInside(hit,candidate.x,candidate.y) === true){
        return candidate;
      }
    }

    return point;
  }

  function showCityHover(event,node){
    const body = node && node.closest ? node.closest('.mapbody') : null;
    if(!body){
      return;
    }

    const label = body.querySelector('.map-hover-label');
    if(!label){
      return;
    }

    const rect = body.getBoundingClientRect();
    const text = String(node.dataset.vpsCityLabel || '').trim();
    if(!text){
      return;
    }

    label.textContent = text;
    label.classList.add('vps-city-hover');
    label.style.left = Math.min(
      Math.max(8,rect.width - 190),
      Math.max(8,event.clientX - rect.left + 14)
    ) + 'px';
    label.style.top = Math.min(
      Math.max(8,rect.height - 44),
      Math.max(8,event.clientY - rect.top + 14)
    ) + 'px';
    label.style.display = 'block';
  }

  function hideCityHover(body){
    if(!body){
      return;
    }

    const label = body.querySelector('.map-hover-label');
    if(!label){
      return;
    }

    label.classList.remove('vps-city-hover');
    label.style.display = 'none';
  }

  function renderCityTraffic(body){
    body.querySelectorAll('.vps-city-nodes').forEach(el => el.remove());
    body.classList.toggle(
      'vps-city-mode',
      !!state.cityMode && body.classList.contains('is-detail')
    );

    if(!state.cityMode || !body.classList.contains('is-detail')){
      return;
    }

    const geo = activeGeography();
    if(!geo || !state.selectedCountryKey){
      return;
    }

    const cities = (geo.cities.get(state.selectedCountryKey) || [])
      .filter(city => city.lat !== null && city.lng !== null);

    if(!cities.length){
      return;
    }

    const svg = body.querySelector('.detail-layer');
    if(!svg){
      return;
    }

    const maxViews = Math.max(1,...cities.map(city => city.views || 0));
    const group = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g'
    );
    group.setAttribute('class','vps-city-nodes');

    const selectedCountry = geo.countries.find(
      country => country.key === state.selectedCountryKey
    );
    const mapName = selectedCountry ? selectedCountry.mapName : '';

    cities.forEach(city => {
      const projected = projectCity(Number(city.lat),Number(city.lng));
      const point = mapName
        ? visualCityPoint(svg,mapName,projected)
        : projected;
      const t = Math.max(.18,Math.min(1,(city.views || 0) / maxViews));
      const g = document.createElementNS('http://www.w3.org/2000/svg','g');
      g.setAttribute('class','vps-city-node');
      g.dataset.vpsCityLabel = city.name + (
        city.views === null
          ? ''
          : ' · ' + fmtNumber(city.views) + ' views'
      );

      // Handle city hover on the marker itself and stop the map's older
      // country-hover handler from immediately hiding the same label.
      g.addEventListener('mousemove', event => {
        event.stopPropagation();
        showCityHover(event,g);
      });
      g.addEventListener('mouseenter', event => {
        event.stopPropagation();
        showCityHover(event,g);
      });
      g.addEventListener('mouseleave', event => {
        event.stopPropagation();
        hideCityHover(body);
      });

      const halo = document.createElementNS('http://www.w3.org/2000/svg','circle');
      halo.setAttribute('class','vps-city-halo');
      halo.setAttribute('cx',point.x.toFixed(3));
      halo.setAttribute('cy',point.y.toFixed(3));
      halo.setAttribute('r',(.70 + .80 * t).toFixed(2));

      const core = document.createElementNS('http://www.w3.org/2000/svg','circle');
      core.setAttribute('class','vps-city-core');
      core.setAttribute('cx',point.x.toFixed(3));
      core.setAttribute('cy',point.y.toFixed(3));
      core.setAttribute('r',(.28 + .34 * t).toFixed(2));

      g.append(halo,core);
      group.appendChild(g);
    });

    // Keep city markers above the transparent country hit-zones so the city
    // points themselves receive pointer events and can show readable labels.
    svg.appendChild(group);
  }

  function renderMapTraffic(){
    if(!state.geography){
      return;
    }

    ensureGeoStyle();

    const geo = activeGeography();
    if(!geo){
      return;
    }

    const countries =
      geo.countries;

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
      ensureMapControls(body);

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

      renderCityTraffic(body);
      ensureMapControls(body);
    });
  }

  function renderGeoOverview(panel){
    const geo = activeGeography();
    if(!geo){
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

    if(geo.endDate){
      const period = geo.startDate
        ? fmtDate(geo.startDate) + ' → ' + fmtDate(geo.endDate)
        : fmtDate(geo.endDate);
      date.textContent = String(state.geographyWindowKey || '2d').toUpperCase() +
        ' · YouTube Analytics · ' + period;
    }else{
      date.textContent = 'Latest available YouTube Analytics geography';
    }

    geolist.replaceChildren();

    const maxShare = Math.max(
      1,
      ...geo.countries.map(
        c => c.share || 0
      )
    );

    geo.countries
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
    const geo = activeGeography();
    if(!geo){
      return;
    }

    const latest = geo.endDate
      ? 'LATEST AVAILABLE · ' + fmtDate(geo.endDate)
      : 'LATEST AVAILABLE';
    const period = String(state.geographyWindowKey || '2d').toUpperCase();

    document.querySelectorAll('.map-scope-badge').forEach(badge => {
      badge.textContent = countryDisplay
        ? countryDisplay + ' · ' + period + ' · ' + latest
        : period + ' · ' + latest;
    });
  }

  function renderGeoDetails(countryValue){
    const geo = activeGeography();
    if(!geo){
      return;
    }

    const key =
      countryKey(countryValue);

    const country =
      geo.countries
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
            geo.videos
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
            geo.cities
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

    renderMapTraffic();
  }

  function renderGeography(payload){
    const geo =
      normalizeGeography(payload);

    if(!geo){
      return false;
    }

    state.geography = geo;

    const requestedWindow = String(
      state.geographyWindowKey ||
      geo.defaultWindow ||
      '2d'
    ).toLowerCase();
    state.geographyWindowKey = geo.windows && geo.windows[requestedWindow]
      ? requestedWindow
      : String(geo.defaultWindow || '2d').toLowerCase();

    // Share the already-normalized Analytics geography with the YouTube console.
    // Same backend response, no extra YouTube/Analytics polling.
    window.SkyrScoutGeographyState = geo;
    document.dispatchEvent(
      new CustomEvent(
        'controlroom:geographydata',
        {detail:geo}
      )
    );

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
        const active = activeGeography();
        badge.textContent = active && active.endDate
          ? String(state.geographyWindowKey || '2d').toUpperCase() + ' · ' + fmtDate(active.endDate)
          : String(state.geographyWindowKey || '2d').toUpperCase();
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
    'mousemove',
    event => {
      const cityNode =
        event.target && event.target.closest
          ? event.target.closest('.vps-city-node')
          : null;

      if(cityNode){
        showCityHover(event,cityNode);
      }
    }
  );

  document.addEventListener(
    'mouseout',
    event => {
      const cityNode =
        event.target && event.target.closest
          ? event.target.closest('.vps-city-node')
          : null;

      if(!cityNode){
        return;
      }

      const related = event.relatedTarget;
      if(related && cityNode.contains(related)){
        return;
      }

      hideCityHover(cityNode.closest('.mapbody'));
    }
  );

  document.addEventListener(
    'click',
    event => {
      const realtimeButton =
        event.target && event.target.closest
          ? event.target.closest('[data-realtime-window]')
          : null;

      if(realtimeButton){
        const key = realtimeButton.dataset.realtimeWindow === '60m' ? '60m' : '48h';
        state.realtimeWindowKey = key;
        renderRealtimeMonitor();
        return;
      }

      const windowButton =
        event.target && event.target.closest
          ? event.target.closest('[data-vps-geo-window]')
          : null;

      if(windowButton){
        event.preventDefault();
        event.stopPropagation();
        setGeographyWindow(windowButton.dataset.vpsGeoWindow);
        return;
      }

      const cityButton =
        event.target && event.target.closest
          ? event.target.closest('[data-vps-city-toggle]')
          : null;

      if(cityButton){
        event.preventDefault();
        event.stopPropagation();
        if(!cityButton.disabled){
          state.cityMode = !state.cityMode;
          renderMapTraffic();
        }
        return;
      }

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
          state.cityMode = false;
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
          state.cityMode = false;
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
        state.cityMode = false;
        renderMapTraffic();

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
