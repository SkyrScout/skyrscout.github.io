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

  function hasGeoShape(obj){
    if(!obj || typeof obj !== 'object' || Array.isArray(obj)){
      return false;
    }

    const keys = Object.keys(obj).map(k => k.toLowerCase());

    const hasCountryKey = keys.some(k => k.includes('countr'));
    const hasGeoKey = keys.some(k => k.includes('geograph'));
    const hasRows = Object.values(obj).some(
      v => Array.isArray(v) && v.length
    );

    return (hasCountryKey || hasGeoKey) && hasRows;
  }

  function findGeographyRoot(payload){
    const preferred = [
      payload && payload.geography,
      payload && payload.geographySnapshot,
      payload && payload.youtubeAnalyticsGeography,
      payload && payload.analyticsGeography,
      payload &&
        payload.analytics &&
        payload.analytics.geography,
      payload &&
        payload.youtubeAnalytics &&
        payload.youtubeAnalytics.geography
    ].filter(Boolean);

    for(const candidate of preferred){
      if(candidate && typeof candidate === 'object'){
        return candidate;
      }
    }

    const seen = new Set();

    function walk(value, depth){
      if(
        !value ||
        typeof value !== 'object' ||
        depth > 4 ||
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

        if(/geograph|countr|audience|analytics/i.test(key)){
          const hit = walk(child, depth + 1);
          if(hit) return hit;
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
    let rows = arrayFrom(root, [
      'countries',
      'countryRows',
      'geographyRows',
      'countryData',
      'topCountries',
      'latestCountryRows',
      'geographyCountryRows'
    ]);

    let schema = schemaFrom(root, [
      'countrySchema',
      'countryRowSchema',
      'geographySchema',
      'countryColumns',
      'geographyColumns',
      'countryColumnHeaders'
    ]);

    if(
      !rows.length &&
      root.country &&
      typeof root.country === 'object'
    ){
      rows = Array.isArray(root.country.rows)
        ? root.country.rows
        : [];

      schema = schema.length
        ? schema
        : (
            root.country.schema ||
            root.country.columns ||
            root.country.columnHeaders ||
            []
          );
    }

    if(
      !rows.length &&
      root.countries &&
      root.countries.rows
    ){
      rows = root.countries.rows;

      schema = schema.length
        ? schema
        : (
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
        'country',
        'countryCode',
        'country_code',
        'code',
        'iso',
        'iso2',
        'name',
        'countryName',
        'country_name'
      ]);

      let views = numberOrNull(
        firstValue(obj, [
          'views',
          'viewCount',
          'view_count',
          'count',
          'value',
          'traffic'
        ])
      );

      let share = numberOrNull(
        firstValue(obj, [
          'share',
          'percentage',
          'percent',
          'pct',
          'ratio'
        ])
      );

      let display = firstValue(obj, [
        'display',
        'displayName',
        'countryName',
        'country_name',
        'label'
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
        display: displayCountryName(
          mapName,
          display
        ),
        views,
        share
      });
    });

    const totalViews = normalized.reduce(
      (sum, x) => sum + (x.views || 0),
      0
    );

    normalized.forEach(item => {
      if(item.share !== null){
        if(item.share > 0 && item.share <= 1){
          item.share *= 100;
        }
      }else if(
        totalViews > 0 &&
        item.views !== null
      ){
        item.share =
          item.views / totalViews * 100;
      }
    });

    normalized.sort(
      (a,b) =>
        (b.views || b.share || 0) -
        (a.views || a.share || 0)
    );

    return normalized;
  }

  function normalizeBreakdownRows(root, kind){
    const isVideo = kind === 'video';

    const rowNames = isVideo
      ? [
          'countryVideoRows',
          'videoCountryRows',
          'videosByCountryRows',
          'topVideoRows',
          'geographyVideoRows'
        ]
      : [
          'countryCityRows',
          'cityCountryRows',
          'citiesByCountryRows',
          'cityRows',
          'geographyCityRows'
        ];

    const schemaNames = isVideo
      ? [
          'countryVideoSchema',
          'videoCountrySchema',
          'videoSchema',
          'videoColumns',
          'countryVideoColumns'
        ]
      : [
          'countryCitySchema',
          'cityCountrySchema',
          'citySchema',
          'cityColumns',
          'countryCityColumns'
        ];

    const rows = arrayFrom(root, rowNames);
    const schema = schemaFrom(root, schemaNames);
    const out = new Map();

    rows.forEach(row => {
      const obj = rowObject(row, schema);

      let c = firstValue(obj, [
        'country',
        'countryCode',
        'country_code',
        'code',
        'iso',
        'countryName'
      ]);

      let views = numberOrNull(
        firstValue(obj, [
          'views',
          'viewCount',
          'view_count',
          'count',
          'value'
        ])
      );

      let name = firstValue(
        obj,
        isVideo
          ? [
              'title',
              'videoTitle',
              'video_title',
              'name',
              'videoId',
              'video_id'
            ]
          : [
              'city',
              'cityName',
              'city_name',
              'name',
              'label'
            ]
      );

      let videoId = isVideo
        ? firstValue(obj, [
            'videoId',
            'video_id',
            'id'
          ])
        : null;

      if(Array.isArray(row) && !schema.length){
        c = row[0];

        if(isVideo){
          videoId = row[1];
          name = row[2] || row[1];

          views = numberOrNull(
            row[3] !== undefined
              ? row[3]
              : row[2]
          );
        }else{
          name = row[1];
          views = numberOrNull(row[2]);
        }
      }

      if(!c || !name){
        return;
      }

      const key = countryKey(c);

      if(!out.has(key)){
        out.set(key, []);
      }

      out.get(key).push({
        name: String(name),
        videoId: videoId
          ? String(videoId)
          : '',
        views
      });
    });

    const objectNames = isVideo
      ? [
          'videosByCountry',
          'topVideosByCountry',
          'countryVideos'
        ]
      : [
          'citiesByCountry',
          'countryCities',
          'cityBreakdownByCountry'
        ];

    objectNames.forEach(name => {
      const obj = root && root[name];

      if(
        !obj ||
        typeof obj !== 'object' ||
        Array.isArray(obj)
      ){
        return;
      }

      Object.entries(obj).forEach(
        ([country, list]) => {
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
              target.push({
                name: item,
                videoId: '',
                views: null
              });
            }else if(Array.isArray(item)){
              target.push({
                name: String(
                  item[isVideo ? 1 : 0] ||
                  item[0] ||
                  ''
                ),
                videoId: isVideo
                  ? String(item[0] || '')
                  : '',
                views: numberOrNull(
                  item[isVideo ? 2 : 1]
                )
              });
            }else if(typeof item === 'object'){
              target.push({
                name: String(
                  firstValue(
                    item,
                    isVideo
                      ? [
                          'title',
                          'videoTitle',
                          'name',
                          'videoId'
                        ]
                      : [
                          'city',
                          'cityName',
                          'name'
                        ]
                  ) || ''
                ),
                videoId: isVideo
                  ? String(
                      firstValue(
                        item,
                        ['videoId','id']
                      ) || ''
                    )
                  : '',
                views: numberOrNull(
                  firstValue(
                    item,
                    [
                      'views',
                      'viewCount',
                      'count',
                      'value'
                    ]
                  )
                )
              });
            }
          });

          out.set(key, target);
        }
      );
    });

    out.forEach(list =>
      list.sort(
        (a,b) =>
          (b.views || 0) -
          (a.views || 0)
      )
    );

    return out;
  }

  function latestGeoDate(root){
    return firstValue(root || {}, [
      'latestAvailableDate',
      'latestDate',
      'dataThrough',
      'availableThrough',
      'throughDate',
      'countryDate',
      'geographyDate',
      'reportDate',
      'date'
    ]) || '';
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

    const style =
      document.createElement('style');

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
        pointer-events:none
      }

      .vps-geo-node .vps-geo-halo{
        fill:#ffb830;
        opacity:.14
      }

      .vps-geo-node .vps-geo-core{
        fill:#ffbd3f;
        stroke:#ffe0a0;
        stroke-width:.34;
        vector-effect:non-scaling-stroke
      }

      .vps-geo-node .vps-geo-ring{
        fill:none;
        stroke:#ffb830;
        stroke-width:.42;
        opacity:.45;
        vector-effect:non-scaling-stroke
      }

      .map-country-hit.vps-geo-country{
        fill:transparent!important;
        stroke:rgba(255,184,48,.16)!important;
        stroke-width:.28!important;
        vector-effect:non-scaling-stroke
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
        ).forEach(
          el =>
            el.classList.remove(
              'vps-geo-country'
            )
        );

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

          const weight =
            (
              country.views !== null
                ? country.views
                : (country.share || 0)
            ) / max;

          const t = Math.max(
            .12,
            Math.min(1, weight)
          );

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
              (2.6 + 4.7 * t) *
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
              (1.35 + 1.8 * t) *
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
              (.70 + 1.08 * t) *
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

    date.textContent =
      state.geography.date
        ? (
            'Latest available data: ' +
            fmtDate(
              state.geography.date
            )
          )
        : (
            'Latest available ' +
            'YouTube Analytics geography'
          );

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
        badge.textContent =
          'LATEST AVAILABLE';
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

    const mapBadge =
      document.querySelector(
        '[data-screen="overview"] ' +
        '.map-scope-badge'
      );

    if(mapBadge){
      mapBadge.textContent =
        geo.date
          ? (
              'LATEST AVAILABLE · ' +
              fmtDate(geo.date)
            )
          : 'LATEST AVAILABLE';
    }

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
        () => {
          if(!state.geography){
            return;
          }

          window.setTimeout(
            () => {
              geographyBodies()
                .forEach(
                  renderGeoOverview
                );

              renderMapTraffic();

              if(
                state.selectedCountryKey
              ){
                renderGeoDetails(
                  state.selectedCountryKey
                );
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
