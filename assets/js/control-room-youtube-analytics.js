(function(){
  'use strict';

  const backend = window.SkyrScoutStaffBackend;
  if(!backend || typeof backend.fetchYouTubeAnalytics !== 'function'){
    console.warn('Control Room YouTube Analytics: staff backend is unavailable.');
    return;
  }

  const overview = {
    videoId: '',
    requestToken: 0,
    result: null,
    publicRow: null,
    checkedAt: null
  };

  const youtube = {
    videoId: '',
    requestToken: 0,
    result: null,
    publicRows: new Map(),
    checkedAt: null,
    activeDetail: 'external'
  };

  const SOURCE_KEYS = {
    external: ['EXT_URL'],
    search: ['YT_SEARCH'],
    channel: ['YT_CHANNEL'],
    suggested: ['RELATED_VIDEO'],
    direct: ['NO_LINK_OTHER']
  };

  const SOURCE_LABELS = {
    external: 'External',
    search: 'YouTube Search',
    channel: 'Channel pages',
    suggested: 'Suggested videos',
    direct: 'Direct or unknown'
  };

  function numberOrNull(value){
    if(value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function formatNumber(value){
    const n = numberOrNull(value);
    return n === null ? '—' : Math.round(n).toLocaleString('en-US');
  }

  function formatHours(value){
    const n = numberOrNull(value);
    if(n === null) return '—';
    return n.toLocaleString('en-US',{maximumFractionDigits:n < 10 ? 2 : 1}) + ' h';
  }

  function formatDuration(seconds){
    const n = numberOrNull(seconds);
    if(n === null) return '—';
    const whole = Math.max(0,Math.round(n));
    const h = Math.floor(whole / 3600);
    const m = Math.floor((whole % 3600) / 60);
    const s = whole % 60;
    return h > 0
      ? h + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0')
      : m + ':' + String(s).padStart(2,'0');
  }

  function formatSigned(value){
    const n = numberOrNull(value);
    if(n === null) return '—';
    const rounded = Math.round(n);
    return (rounded > 0 ? '+' : '') + rounded.toLocaleString('en-US');
  }

  function formatDate(value){
    const clean = String(value || '').trim();
    const m = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m) return clean || '';
    return m[3] + '.' + m[2] + '.' + m[1];
  }

  function countryName(code){
    const clean = String(code || '').trim().toUpperCase();
    if(!clean) return 'Unknown';
    try{
      if(typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'){
        const names = new Intl.DisplayNames(['en'],{type:'region'});
        return names.of(clean) || clean;
      }
    }catch(_error){}
    return clean;
  }

  function availability(result, key){
    return result?.payload?.analytics?.availability?.[key] || {status:'not_available'};
  }

  function statusLabel(status){
    switch(String(status || '')){
      case 'exact': return 'LATEST AVAILABLE';
      case 'partial': return 'PARTIAL';
      case 'pending': return 'PENDING';
      case 'incomplete': return 'INCOMPLETE';
      case 'not_available': return 'NOT AVAILABLE';
      default: return 'NOT AVAILABLE';
    }
  }

  function valueForAvailability(status, exactValue){
    if(status === 'exact' || status === 'partial') return exactValue;
    if(status === 'pending') return 'Pending';
    if(status === 'incomplete') return 'Incomplete';
    return 'Not available';
  }

  function analyticsThrough(result){
    return result?.meta?.analyticsDataThrough || result?.payload?.analytics?.availability?.performance?.dataThrough || '';
  }

  function setSelectedVideoBadge(text){
    const badge = document.querySelector('#selectedPlayerPanel .ph .badge');
    if(badge && text) badge.textContent = text;
  }

  function setOverviewMetric(key, label, value){
    const card = document.querySelector('[data-selected-metric-card="' + key + '"]');
    if(!card) return;
    const labelEl = card.querySelector('span');
    const valueEl = card.querySelector('[data-selected-metric]');
    if(labelEl) labelEl.textContent = label;
    if(valueEl) valueEl.textContent = value;
  }

  function trafficEntry(analytics, type){
    return (Array.isArray(analytics?.trafficSources) ? analytics.trafficSources : [])
      .find(item => String(item?.type || '') === type) || null;
  }

  function trafficEntryForKey(analytics, key){
    const accepted = SOURCE_KEYS[key] || [];
    const rows = Array.isArray(analytics?.trafficSources) ? analytics.trafficSources : [];
    const matches = rows.filter(item => accepted.includes(String(item?.type || '')));
    if(!matches.length) return null;
    return matches.reduce((acc,item) => ({
      views:(acc.views || 0) + (numberOrNull(item.views) || 0),
      estimatedMinutesWatched:(acc.estimatedMinutesWatched || 0) + (numberOrNull(item.estimatedMinutesWatched) || 0)
    }), {views:0,estimatedMinutesWatched:0});
  }

  function clampPercent(value){
    const n = numberOrNull(value);
    return n === null ? null : Math.max(0,Math.min(100,n));
  }

  function setBarPercent(element, value){
    if(!element) return;
    const pct = clampPercent(value);
    element.style.setProperty('--yt-bar-pct',(pct === null ? 0 : pct) + '%');
  }

  function trafficSharePercent(item, analytics){
    if(!item) return null;
    const total = numberOrNull(analytics?.performance?.views);
    const views = numberOrNull(item.views);
    if(total === null || total <= 0 || views === null) return null;
    return views / total * 100;
  }

  function trafficShareText(item, analytics){
    if(!item) return 'Not reported';
    const views = numberOrNull(item.views);
    if(views === null) return '—';
    const pct = trafficSharePercent(item,analytics);
    return (pct === null ? '—' : pct.toFixed(1) + '%') + ' · ' + formatNumber(views);
  }

  function percentageNumber(value, collection){
    const n = numberOrNull(value);
    if(n === null) return null;
    const vals = (Array.isArray(collection) ? collection : []).map(x => numberOrNull(x?.viewerPercentage)).filter(x => x !== null);
    const sum = vals.reduce((a,b) => a + b,0);
    return sum > 0 && sum <= 1.5 ? n * 100 : n;
  }

  function formatPercentValue(value, collection){
    const n = percentageNumber(value, collection);
    return n === null ? '—' : n.toFixed(1) + '%';
  }

  function ageLabel(value){
    const raw = String(value || '');
    const m = raw.match(/(\d{2})[-_](\d{2})/);
    if(m) return m[1] + '–' + m[2];
    const plus = raw.match(/(\d{2}).*plus/i);
    if(plus) return plus[1] + '+';
    return raw.replace(/^age/i,'').replace(/_/g,'–') || 'Unknown';
  }

  function genderLabel(value){
    const raw = String(value || '').toLowerCase();
    if(raw === 'male') return 'Male';
    if(raw === 'female') return 'Female';
    if(raw === 'user_specified') return 'User specified';
    return raw ? raw.replace(/_/g,' ') : 'Unknown';
  }

  function countryLabel(code){
    const clean = String(code || '').trim().toUpperCase();
    if(!clean) return '—';
    try{
      return new Intl.DisplayNames(['en'],{type:'region'}).of(clean) || clean;
    }catch(_error){
      return clean;
    }
  }

  function topDemographic(rows, labelFn){
    const list = Array.isArray(rows) ? rows : [];
    if(!list.length) return null;
    const best = list.slice().sort((a,b) => (numberOrNull(b.viewerPercentage) || 0) - (numberOrNull(a.viewerPercentage) || 0))[0];
    return labelFn(best) + ' · ' + formatPercentValue(best.viewerPercentage, list);
  }

  function createLineChart(rows, status, dataThrough){
    const host = document.createElement('div');
    host.className = 'analytics-line-chart';

    if(status !== 'exact' && status !== 'partial'){
      host.classList.add('analytics-empty');
      host.textContent = status === 'pending' ? 'Analytics processing pending.' : status === 'incomplete' ? 'Analytics series incomplete.' : 'Analytics series not available.';
      return host;
    }

    const series = Array.isArray(rows) ? rows : [];
    if(!series.length){
      host.classList.add('analytics-empty');
      host.textContent = 'Analytics series not available.';
      return host;
    }

    let cumulative = 0;
    const values = series.map(row => {
      cumulative += numberOrNull(row?.views) || 0;
      return {day:String(row?.day || ''), value:cumulative};
    });
    const max = Math.max(1,...values.map(item => item.value));
    const width = 1000;
    const height = 220;
    const padX = 28;
    const padTop = 18;
    const padBottom = 28;
    const innerW = width - padX * 2;
    const innerH = height - padTop - padBottom;
    const points = values.map((item,index) => {
      const x = padX + (values.length === 1 ? innerW : index / (values.length - 1) * innerW);
      const y = padTop + innerH - item.value / max * innerH;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');

    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 1000 220');
    svg.setAttribute('preserveAspectRatio','none');
    svg.setAttribute('aria-label','Cumulative views since publishing');
    svg.innerHTML = '<line x1="28" y1="192" x2="972" y2="192" class="analytics-axis"></line>' +
      '<line x1="28" y1="18" x2="28" y2="192" class="analytics-axis"></line>' +
      '<polyline points="' + points + '" class="analytics-line"></polyline>';

    const labels = document.createElement('div');
    labels.className = 'analytics-chart-labels';
    labels.innerHTML = '<span>' + escapeHtml(formatDate(values[0].day)) + '</span><strong>' + escapeHtml(formatNumber(cumulative)) + ' processed views</strong><span>' + escapeHtml(formatDate(dataThrough || values[values.length-1].day)) + '</span>';
    host.append(svg,labels);
    return host;
  }

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function renderOverview(){
    if(!overview.videoId) return;
    const result = overview.result;
    if(!result || String(result?.payload?.videoId || '') !== overview.videoId) return;

    const analytics = result.payload.analytics || {};
    const perf = analytics.performance || {};
    const publicLikes = result.payload.publicLikes || {};
    const reachStatus = availability(result,'reach').status;
    const reach = analytics.reach || null;

    const viewCard = document.querySelector('[data-selected-metric-card="views"]');
    const currentViewText = viewCard?.querySelector('[data-selected-metric]')?.textContent || '—';
    setOverviewMetric('views','Views',overview.publicRow ? formatNumber(overview.publicRow.totalViews) : currentViewText);
    setOverviewMetric('likes','Likes',publicLikes.status === 'exact' ? formatNumber(publicLikes.likes) : valueForAvailability(publicLikes.status,null));
    setOverviewMetric('ctr','CTR',valueForAvailability(reachStatus,formatCtr(reach?.impressionsCtr)));
    setOverviewMetric('avgViewDuration','Avg view duration',valueForAvailability(availability(result,'performance').status,formatDuration(perf.averageViewDurationSeconds)));
    setOverviewMetric('watchTime','Watch time',valueForAvailability(availability(result,'performance').status,formatHours(perf.watchTimeHours)));

    const panel = document.getElementById('selectedPlayerPanel');
    if(panel) panel.classList.remove('selected-data-pending');

    const charts = document.getElementById('selectedPlayerCharts');
    if(charts){
      charts.replaceChildren();
      const head = document.createElement('div');
      head.className = 'analytics-chart-head';
      const chartStatus = availability(result,'performanceByDay');
      head.innerHTML = '<span>Performance since publishing</span><b>' + escapeHtml(statusLabel(chartStatus.status)) + (chartStatus.dataThrough ? ' · ' + escapeHtml(formatDate(chartStatus.dataThrough)) : '') + '</b>';
      charts.append(head,createLineChart(analytics.performanceByDay,chartStatus.status,chartStatus.dataThrough));
    }

    renderOverviewTraffic(result);
  }

  function renderOverviewTraffic(result){
    const panel = document.getElementById('selectedTrafficPanel');
    const body = document.getElementById('selectedTrafficBody');
    if(!panel || !body) return;

    const analytics = result.payload.analytics || {};
    const badge = panel.querySelector('.ph .badge');
    if(badge){
      const through = analyticsThrough(result);
      badge.textContent = through ? 'LATEST · ' + formatDate(through) : 'ANALYTICS';
    }

    body.replaceChildren();
    const addSection = text => {
      const el = document.createElement('div');
      el.className = 'sec';
      el.textContent = text;
      body.appendChild(el);
    };
    const addKv = (label,value) => {
      const row = document.createElement('div');
      row.className = 'kv';
      const a = document.createElement('span');
      const b = document.createElement('strong');
      a.textContent = label;
      b.textContent = value;
      row.append(a,b);
      body.appendChild(row);
    };

    addSection('PUBLIC / RECENT');
    addKv('Views · last 48 h',overview.publicRow ? formatNumber(overview.publicRow.last48hViews) : '—');

    addSection('TRAFFIC SOURCES · SINCE PUBLISHING');
    const trafficStatus = availability(result,'trafficSources').status;
    ['channel','search','external','suggested'].forEach(key => {
      const item = trafficEntryForKey(analytics,key);
      addKv(SOURCE_LABELS[key],valueForAvailability(trafficStatus,trafficShareText(item,analytics)));
    });
    const other = trafficEntry(analytics,'YT_OTHER_PAGE');
    addKv('Other YouTube features',valueForAvailability(trafficStatus,trafficShareText(other,analytics)));

    addSection('AUDIENCE');
    const regionStatus = availability(result,'topRegion').status;
    const top = analytics.topRegion;
    let region = 'Not available';
    if((regionStatus === 'exact' || regionStatus === 'partial') && top){
      const total = numberOrNull(analytics.performance?.views);
      const views = numberOrNull(top.views);
      if(total !== null && total > 0 && views !== null && views > 0){
        region = countryLabel(top.country) + ' · ' + (views / total * 100).toFixed(1) + '%';
      }
    }else{
      region = valueForAvailability(regionStatus,'—');
    }
    addKv('Top region',region);

    const demoStatus = availability(result,'demographics').status;
    const age = topDemographic(analytics.audience?.age,item => ageLabel(item.ageGroup));
    const gender = topDemographic(analytics.audience?.gender,item => genderLabel(item.gender));
    addKv('Age',valueForAvailability(demoStatus,age || 'Not available'));
    addKv('Gender',valueForAvailability(demoStatus,gender || 'Not available'));
  }

  function formatCtr(value){
    const n = numberOrNull(value);
    if(n === null) return '—';
    const pct = n <= 1 ? n * 100 : n;
    return pct.toFixed(1) + '%';
  }

  function setPanelFreshness(panelSelector, availabilityItem){
    const panel = document.querySelector(panelSelector);
    const badge = panel?.querySelector('[data-yt-latest-label]');
    if(!badge) return;
    const status = String(availabilityItem?.status || 'not_available');
    const date = availabilityItem?.dataThrough || '';
    badge.textContent = statusLabel(status) + ((status === 'exact' || status === 'partial') && date ? ' · ' + formatDate(date) : '');
  }

  function renderYouTube(){
    if(!youtube.videoId) return;
    const result = youtube.result;
    if(!result || String(result?.payload?.videoId || '') !== youtube.videoId) return;
    const analytics = result.payload.analytics || {};
    const perf = analytics.performance || {};

    const publicRow = youtube.publicRows.get(youtube.videoId) || null;
    const views = document.querySelector('[data-yt-performance-views]');
    if(views && publicRow) views.textContent = formatNumber(publicRow.totalViews);

    const watchTime = document.querySelector('[data-yt-performance-watch-time]');
    const avg = document.querySelector('[data-yt-performance-avg-duration]');
    const subs = document.querySelector('[data-yt-performance-subscribers]');
    const subsGained = document.querySelector('[data-yt-performance-subscribers-gained]');
    const subsLost = document.querySelector('[data-yt-performance-subscribers-lost]');
    const perfStatus = availability(result,'performance').status;
    if(watchTime) watchTime.textContent = valueForAvailability(perfStatus,formatHours(perf.watchTimeHours));
    if(avg) avg.textContent = valueForAvailability(perfStatus,formatDuration(perf.averageViewDurationSeconds));
    if(subs) subs.textContent = valueForAvailability(perfStatus,formatSigned(perf.subscriberNet));
    if(subsGained) subsGained.textContent = valueForAvailability(perfStatus,formatNumber(perf.subscribersGained));
    if(subsLost) subsLost.textContent = valueForAvailability(perfStatus,formatNumber(perf.subscribersLost));
    setPanelFreshness('.yt-performance-panel',availability(result,'performance'));

    renderYouTubePerformanceChart(result);
    renderYouTubeReach(result);
    renderYouTubeTraffic(result);
    renderYouTubeAudience(result);
    renderYouTubeGeography(result);
    renderYouTubeDetail(result,youtube.activeDetail);
  }

  function renderYouTubePerformanceChart(result){
    const analytics = result.payload.analytics || {};
    const shell = document.querySelector('.yt-performance-panel .yt-chart-shell');
    if(!shell) return;
    const status = availability(result,'performanceByDay');
    shell.replaceChildren();
    const head = document.createElement('div');
    head.className = 'yt-chart-head';
    head.innerHTML = '<span>Performance since publishing</span><b>' + escapeHtml(statusLabel(status.status)) + (status.dataThrough ? ' · ' + escapeHtml(formatDate(status.dataThrough)) : '') + '</b>';
    shell.append(head,createLineChart(analytics.performanceByDay,status.status,status.dataThrough));
  }

  function renderYouTubeReach(result){
    const analytics = result.payload.analytics || {};
    const reachStatus = availability(result,'reach');
    const reach = analytics.reach || {};
    const impressions = document.querySelector('[data-yt-reach-impressions]');
    const ctr = document.querySelector('[data-yt-reach-ctr]');
    if(impressions) impressions.textContent = valueForAvailability(reachStatus.status,formatNumber(reach.impressions));
    if(ctr) ctr.textContent = valueForAvailability(reachStatus.status,formatCtr(reach.impressionsCtr));
    setPanelFreshness('.yt-reach-panel',reachStatus);

    const trafficStatus = availability(result,'trafficSources').status;
    document.querySelectorAll('[data-yt-reach-source]').forEach(row => {
      const key = row.dataset.ytReachSource;
      const strong = row.querySelector('strong');
      if(!strong) return;
      const item = trafficEntryForKey(analytics,key);
      strong.textContent = valueForAvailability(trafficStatus,trafficShareText(item,analytics));
      setBarPercent(row,(trafficStatus === 'exact' || trafficStatus === 'partial') ? trafficSharePercent(item,analytics) : null);
    });

    const stack = document.querySelector('.yt-reach-panel .yt-source-stack');
    if(stack){
      const keys = ['external','search','channel','direct','suggested'];
      Array.from(stack.querySelectorAll('i')).forEach((segment,index) => {
        const item = trafficEntryForKey(analytics,keys[index]);
        const pct = (trafficStatus === 'exact' || trafficStatus === 'partial') ? trafficSharePercent(item,analytics) : null;
        segment.style.setProperty('--yt-stack-pct',(clampPercent(pct) || 0) + '%');
      });
    }
  }

  function renderYouTubeTraffic(result){
    const analytics = result.payload.analytics || {};
    const status = availability(result,'trafficSources');
    setPanelFreshness('.yt-traffic-panel',status);
    document.querySelectorAll('.yt-traffic-panel [data-yt-source]').forEach(button => {
      const strong = button.querySelector('strong');
      if(!strong) return;
      const key = button.dataset.ytSource;
      const item = trafficEntryForKey(analytics,key);
      strong.textContent = valueForAvailability(status.status,trafficShareText(item,analytics));
      setBarPercent(button,(status.status === 'exact' || status.status === 'partial') ? trafficSharePercent(item,analytics) : null);
    });
  }

  function renderYouTubeDetail(result,key){
    const body = document.getElementById('ytDetailBody');
    const title = document.getElementById('ytDetailTitle');
    if(!body || !title) return;
    const analytics = result.payload.analytics || {};
    const status = availability(result,'trafficDetails');
    setPanelFreshness('.yt-detail-panel',status);

    youtube.activeDetail = SOURCE_KEYS[key] ? key : 'external';
    title.textContent = detailTitle(youtube.activeDetail);
    body.replaceChildren();

    const context = document.createElement('div');
    context.className = 'yt-detail-context';
    context.innerHTML = '<strong>' + escapeHtml(SOURCE_LABELS[youtube.activeDetail]) + '</strong><span>Detailed attribution for the selected video.</span>';
    body.appendChild(context);

    if(status.status !== 'exact' && status.status !== 'partial'){
      const note = document.createElement('div');
      note.className = 'yt-panel-note';
      note.textContent = status.status === 'pending'
        ? 'YouTube Reporting detail is still processing.'
        : status.status === 'incomplete'
          ? 'Traffic detail is incomplete.'
          : 'Detailed attribution is not available for this video.';
      body.appendChild(note);
      return;
    }

    const type = (SOURCE_KEYS[youtube.activeDetail] || [])[0];
    const rows = Array.isArray(analytics.trafficDetails?.[type]) ? analytics.trafficDetails[type].slice() : [];
    rows.sort((a,b) => (numberOrNull(b.views) || 0) - (numberOrNull(a.views) || 0));
    const list = document.createElement('div');
    list.className = 'yt-detail-list';

    if(!rows.length){
      const note = document.createElement('div');
      note.className = 'yt-panel-note';
      note.textContent = 'No detailed rows were returned for this traffic source.';
      body.appendChild(note);
      return;
    }

    const detailTotalViews = rows.reduce((sum,item) => sum + (numberOrNull(item.views) || 0),0);
    rows.slice(0,10).forEach(item => {
      const row = document.createElement('div');
      row.className = 'yt-detail-row';
      const name = document.createElement('span');
      const value = document.createElement('strong');
      const views = numberOrNull(item.views);
      name.textContent = item.detail || (item.meaning === 'unattributed_or_privacy_thresholded' ? 'Unattributed / privacy thresholded' : SOURCE_LABELS[youtube.activeDetail]);
      value.textContent = formatNumber(views);
      setBarPercent(row,detailTotalViews > 0 && views !== null ? views / detailTotalViews * 100 : null);
      row.append(name,value);
      list.appendChild(row);
    });
    body.appendChild(list);
  }

  function detailTitle(key){
    if(key === 'external') return 'External sites / apps';
    if(key === 'search') return 'YouTube search terms';
    if(key === 'channel') return 'Channel-page traffic';
    if(key === 'suggested') return 'Suggested-video traffic';
    return 'Direct / unknown';
  }

  function renderYouTubeGeography(result){
    const body = document.querySelector('.yt-geography-panel [data-yt-selected-geography-body]');
    const list = document.querySelector('.yt-geography-panel [data-yt-selected-geography-list]');
    const videoTitle = document.querySelector('[data-yt-geo-video-title]');
    const topRegion = document.querySelector('[data-yt-geo-top-region]');
    const note = document.querySelector('[data-yt-geo-note]');
    if(!body || !list) return;

    const analytics = result.payload.analytics || {};
    const meta = analytics.metadata || {};
    const perf = analytics.performance || {};
    const status = availability(result,'geography');
    const rows = Array.isArray(analytics.geography) ? analytics.geography.slice() : [];
    const residual = analytics.geographyResidual || null;
    const totalViews = numberOrNull(perf.views);

    setPanelFreshness('.yt-geography-panel',status);
    if(videoTitle) videoTitle.textContent = meta.title || youtube.videoId || 'Selected video';

    const top = analytics.topRegion || (rows.length ? rows[0] : null);
    if(topRegion){
      topRegion.textContent = (status.status === 'exact' || status.status === 'partial')
        ? (top && top.country ? countryName(top.country) + ' · ' + formatNumber(top.views) : 'Not available')
        : valueForAvailability(status.status,'—');
    }

    list.replaceChildren();
    if(status.status !== 'exact' && status.status !== 'partial'){
      const empty = document.createElement('div');
      empty.className = 'yt-panel-note';
      empty.textContent = status.status === 'pending'
        ? 'Selected-video geography is still processing.'
        : status.status === 'incomplete'
          ? 'Selected-video geography is incomplete.'
          : 'YouTube did not return country-level geography for this video.';
      list.appendChild(empty);
      if(note) note.textContent = 'Missing geography is never displayed as zero.';
      return;
    }

    rows.sort((a,b) => (numberOrNull(b.views) || 0) - (numberOrNull(a.views) || 0));
    const reportedViews = rows.reduce((sum,item) => sum + (numberOrNull(item.views) || 0),0);
    const denominator = totalViews !== null && totalViews > 0 ? totalViews : reportedViews;

    function addRow(label,sub,views,share,residualRow){
      const row = document.createElement('div');
      row.className = 'yt-selected-geo-row' + (residualRow ? ' yt-selected-geo-residual' : '');
      const left = document.createElement('div');
      const name = document.createElement('strong');
      const metaLine = document.createElement('span');
      name.textContent = label;
      metaLine.textContent = sub;
      left.append(name,metaLine);
      const right = document.createElement('div');
      const value = document.createElement('b');
      const pct = document.createElement('span');
      value.textContent = formatNumber(views);
      pct.textContent = share === null ? '—' : share.toFixed(1) + '%';
      right.append(value,pct);
      const bar = document.createElement('i');
      bar.style.setProperty('--yt-geo-share',Math.max(0,Math.min(100,share || 0)) + '%');
      row.append(left,right,bar);
      list.appendChild(row);
    }

    rows.slice(0,20).forEach(item => {
      const views = numberOrNull(item.views) || 0;
      const share = denominator > 0 ? views / denominator * 100 : null;
      const minutes = numberOrNull(item.estimatedMinutesWatched);
      addRow(
        countryName(item.country),
        minutes === null
          ? String(item.country || '').toUpperCase()
          : String(item.country || '').toUpperCase() + ' · ' + formatHours(minutes / 60),
        views,
        share,
        false
      );
    });

    const residualViews = residual ? numberOrNull(residual.views) : null;
    if(residualViews !== null && residualViews > 0){
      const share = denominator > 0 ? residualViews / denominator * 100 : null;
      addRow('Unreported geography','Privacy-thresholded / unattributed',residualViews,share,true);
    }

    if(!rows.length && !(residualViews > 0)){
      const empty = document.createElement('div');
      empty.className = 'yt-panel-note';
      empty.textContent = 'No selected-video country rows were returned.';
      list.appendChild(empty);
    }

    if(note){
      note.textContent = 'Shares use processed since-publishing views. Unreported geography remains explicit instead of being redistributed.';
    }
  }

  function renderYouTubeAudience(result){
    const body = document.querySelector('.yt-audience-panel .yt-audience-body');
    if(!body) return;
    const analytics = result.payload.analytics || {};
    const audience = analytics.audience || {};
    const subStatus = availability(result,'subscribedStatus');
    const demoStatus = availability(result,'demographics');
    setPanelFreshness('.yt-audience-panel',demoStatus.status === 'exact' || demoStatus.status === 'partial' ? demoStatus : subStatus);

    body.replaceChildren();
    const split = document.createElement('div');
    split.className = 'yt-audience-split analytics-audience-grid';

    split.appendChild(audienceCard('Watch time from subscribers',subscriberRows(audience.subscribedStatus,subStatus.status)));
    split.appendChild(audienceCard('Age',demographicRows(audience.age,'ageGroup',ageLabel,demoStatus.status)));
    split.appendChild(audienceCard('Gender',demographicRows(audience.gender,'gender',genderLabel,demoStatus.status)));
    body.appendChild(split);

    const note = document.createElement('div');
    note.className = 'yt-panel-note';
    note.textContent = 'Audience data is shown only where YouTube clears its privacy thresholds.';
    body.appendChild(note);
  }

  function audienceCard(title, rows){
    const card = document.createElement('div');
    card.className = 'yt-audience-card';
    const head = document.createElement('span');
    head.textContent = title;
    card.appendChild(head);
    rows.forEach(item => {
      const row = document.createElement('div');
      const label = document.createElement('strong');
      const value = document.createElement('b');
      label.textContent = item.label;
      value.textContent = item.value;
      setBarPercent(row,item.percent);
      row.append(label,value);
      card.appendChild(row);
    });
    return card;
  }

  function subscriberRows(rows,status){
    if(status !== 'exact' && status !== 'partial') return [{label:statusLabel(status),value:'—',percent:null}];
    const list = Array.isArray(rows) ? rows : [];
    if(!list.length) return [{label:'Not available',value:'—',percent:null}];
    const total = list.reduce((sum,item) => sum + (numberOrNull(item.estimatedMinutesWatched) || 0),0);
    return list.map(item => {
      const raw = String(item.status || '').toLowerCase();
      const label = raw.includes('unsub') || raw.includes('not') ? 'Not subscribed' : raw.includes('sub') ? 'Subscribed' : (item.status || 'Unknown');
      const minutes = numberOrNull(item.estimatedMinutesWatched) || 0;
      const pct = total > 0 ? minutes / total * 100 : null;
      return {label:String(label),value:pct === null ? '—' : pct.toFixed(1) + '%',percent:pct};
    });
  }

  function demographicRows(rows,key,labelFn,status){
    if(status !== 'exact' && status !== 'partial') return [{label:statusLabel(status),value:'—',percent:null}];
    const list = Array.isArray(rows) ? rows : [];
    if(!list.length) return [{label:'Not available',value:'—',percent:null}];
    return list.map(item => {
      const pct = percentageNumber(item.viewerPercentage,list);
      return {
        label:labelFn(item[key]),
        value:pct === null ? '—' : pct.toFixed(1) + '%',
        percent:pct
      };
    });
  }

  async function loadOverview(videoId){
    const id = String(videoId || '').trim();
    if(!id) return;
    overview.videoId = id;
    overview.result = null;
    const token = ++overview.requestToken;
    setOverviewPending();
    try{
      const result = await backend.fetchYouTubeAnalytics(id);
      if(token !== overview.requestToken || overview.videoId !== id) return;
      overview.result = result;
      renderOverview();
    }catch(error){
      if(token !== overview.requestToken) return;
      console.warn('Control Room Overview Analytics:',error);
      setOverviewError();
    }
  }

  async function loadYouTube(videoId){
    const id = String(videoId || '').trim();
    if(!id) return;
    youtube.videoId = id;
    youtube.result = null;
    const token = ++youtube.requestToken;
    setYouTubePending();
    try{
      const result = await backend.fetchYouTubeAnalytics(id);
      if(token !== youtube.requestToken || youtube.videoId !== id) return;
      youtube.result = result;
      renderYouTube();
    }catch(error){
      if(token !== youtube.requestToken) return;
      console.warn('Control Room YouTube Analytics:',error);
      setYouTubeError();
    }
  }

  function setOverviewPending(){
    setOverviewMetric('likes','Likes','…');
    setOverviewMetric('ctr','CTR','…');
    setOverviewMetric('avgViewDuration','Avg view duration','…');
    setOverviewMetric('watchTime','Watch time','…');
    const badge = document.querySelector('#selectedTrafficPanel .ph .badge');
    if(badge) badge.textContent = 'LOADING ANALYTICS';
  }

  function setOverviewError(){
    setOverviewMetric('likes','Likes','Unavailable');
    setOverviewMetric('ctr','CTR','Unavailable');
    setOverviewMetric('avgViewDuration','Avg view duration','Unavailable');
    setOverviewMetric('watchTime','Watch time','Unavailable');
    const badge = document.querySelector('#selectedTrafficPanel .ph .badge');
    if(badge) badge.textContent = 'ANALYTICS UNAVAILABLE';
  }

  function setYouTubePending(){
    const geoTitle = document.querySelector('[data-yt-geo-video-title]');
    const geoTop = document.querySelector('[data-yt-geo-top-region]');
    const geoList = document.querySelector('[data-yt-selected-geography-list]');
    if(geoTitle) geoTitle.textContent = 'Loading selected-video geography…';
    if(geoTop) geoTop.textContent = '…';
    if(geoList) geoList.innerHTML = '<div class="yt-panel-note">Loading selected-video geography…</div>';
    ['[data-yt-performance-watch-time]','[data-yt-performance-avg-duration]','[data-yt-performance-subscribers]','[data-yt-performance-subscribers-gained]','[data-yt-performance-subscribers-lost]','[data-yt-reach-impressions]','[data-yt-reach-ctr]'].forEach(sel => {
      const el = document.querySelector(sel);
      if(el) el.textContent = '…';
    });
  }

  function setYouTubeError(){
    ['.yt-performance-panel','.yt-reach-panel','.yt-traffic-panel','.yt-detail-panel','.yt-audience-panel','.yt-geography-panel'].forEach(sel => {
      const badge = document.querySelector(sel + ' [data-yt-latest-label]');
      if(badge) badge.textContent = 'UNAVAILABLE';
    });
  }

  function ingestPublicSnapshot(detail){
    const schema = Array.isArray(detail?.videoSnapshotSchema) ? detail.videoSnapshotSchema : [];
    const rows = Array.isArray(detail?.videoSnapshotRows) ? detail.videoSnapshotRows : [];
    const map = new Map();
    rows.forEach(raw => {
      if(!Array.isArray(raw)) return;
      const item = {};
      schema.forEach((key,index) => { item[String(key)] = raw[index]; });
      const id = String(item.videoId || '').trim();
      if(id) map.set(id,item);
    });
    youtube.publicRows = map;
    youtube.checkedAt = detail?.checkedAt || null;
    if(youtube.result) renderYouTube();
  }

  function ensureStyle(){
    if(document.getElementById('controlRoomYouTubeAnalyticsStyle')) return;
    const style = document.createElement('style');
    style.id = 'controlRoomYouTubeAnalyticsStyle';
    style.textContent = `
      #selectedPlayerCharts{grid-template-columns:1fr!important;grid-template-rows:auto minmax(0,1fr)!important}
      .yt-performance-panel .yt-metric-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
      @media(max-width:1100px){.yt-performance-panel .yt-metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      .analytics-chart-head{display:flex;justify-content:space-between;gap:8px;align-items:center;color:#7f9aa8;font-size:7px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
      .analytics-chart-head b{color:#c6d9e1;font-size:6px;white-space:nowrap}
      .analytics-line-chart{min-height:72px;display:grid;grid-template-rows:minmax(55px,1fr) auto;gap:3px}
      .analytics-line-chart svg{width:100%;height:100%;min-height:55px;overflow:visible}
      .analytics-axis{stroke:#183948;stroke-width:1;vector-effect:non-scaling-stroke}
      .analytics-line{fill:none;stroke:#19baf2;stroke-width:2.2;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
      .analytics-chart-labels{display:grid;grid-template-columns:1fr auto 1fr;gap:7px;align-items:center;color:#607987;font-size:6px}
      .analytics-chart-labels strong{color:#bcd3dd;font-size:7px;text-align:center}
      .analytics-chart-labels span:last-child{text-align:right}
      .analytics-empty{min-height:62px;display:grid;place-items:center;color:#667d89;font-size:7px;text-align:center;border:1px dashed #17323e;border-radius:5px;padding:8px}
      .yt-reach-ctr-inline{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:7px;padding-top:7px;border-top:1px solid #241010}
      .yt-reach-ctr-inline span{display:inline!important;font-size:8px!important;color:#91706f!important}
      .yt-reach-ctr-inline b{font-size:13px;color:#f4f1f1}
      .console-focus-shell .youtube-panel .yt-reach-ctr-inline{margin-top:14px;padding-top:14px}
      .console-focus-shell .youtube-panel .yt-reach-ctr-inline span{font-size:13px!important}
      .console-focus-shell .youtube-panel .yt-reach-ctr-inline b{font-size:24px}
      .analytics-audience-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      @media(max-width:1100px){.analytics-audience-grid{grid-template-columns:1fr!important}}
      .yt-selected-geography-body{display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:7px;overflow:hidden}
      .yt-selected-geo-summary{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;border-bottom:1px solid #251111;padding-bottom:7px}
      .yt-selected-geo-summary>div{min-width:0}.yt-selected-geo-summary span{display:block;color:#926f6f;font-size:6px;font-weight:800;letter-spacing:.08em}
      .yt-selected-geo-summary strong{display:block;color:#f1e8e8;font-size:9px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.yt-selected-geo-top{text-align:right;flex:0 0 auto}
      .yt-selected-geo-list{min-height:0;overflow:auto;display:grid;align-content:start;gap:2px;padding-right:3px}.yt-selected-geo-row{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:6px 0 7px;border-bottom:1px solid #1d1111}
      .yt-selected-geo-row>div:first-child{min-width:0}.yt-selected-geo-row strong{display:block;color:#eee5e5;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.yt-selected-geo-row span{display:block;color:#806f70;font-size:6px;margin-top:2px}.yt-selected-geo-row>div:nth-child(2){text-align:right}.yt-selected-geo-row b{display:block;color:#fff;font-size:9px}
      .yt-selected-geo-row i{position:absolute;left:0;bottom:0;width:var(--yt-geo-share,0%);height:1px;background:#ff655c;opacity:.72}.yt-selected-geo-residual strong,.yt-selected-geo-residual b{color:#b99a9a}.yt-selected-geo-residual i{opacity:.28}
      .console-focus-shell .yt-selected-geo-summary span{font-size:10px}.console-focus-shell .yt-selected-geo-summary strong{font-size:16px}.console-focus-shell .yt-selected-geo-row{padding:10px 0 12px}.console-focus-shell .yt-selected-geo-row strong{font-size:13px}.console-focus-shell .yt-selected-geo-row span{font-size:10px}.console-focus-shell .yt-selected-geo-row b{font-size:14px}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('controlroom:videoselected',event => {
    const id = String(event?.detail?.videoId || '').trim();
    if(id) loadOverview(id);
  });

  document.addEventListener('controlroom:overviewpublicselected',event => {
    const id = String(event?.detail?.videoId || '').trim();
    if(!id) return;
    if(overview.videoId && overview.videoId !== id) return;
    overview.videoId = id;
    overview.publicRow = event?.detail?.row || null;
    overview.checkedAt = event?.detail?.checkedAt || null;
    if(overview.result) renderOverview();
  });

  document.addEventListener('controlroom:vpsfeedupdated',event => {
    ingestPublicSnapshot(event.detail || {});
  });

  const ytScreen = document.querySelector('[data-screen="youtube"]');
  if(ytScreen){
    ytScreen.addEventListener('youtubeanalytics:videoselected',event => {
      const id = String(event?.detail?.videoId || '').trim();
      if(id) loadYouTube(id);
    });
  }

  document.addEventListener('click',event => {
    const source = event.target.closest && event.target.closest('.yt-traffic-panel [data-yt-source]');
    if(!source) return;
    youtube.activeDetail = SOURCE_KEYS[source.dataset.ytSource] ? source.dataset.ytSource : 'external';
    if(youtube.result) window.setTimeout(() => renderYouTubeDetail(youtube.result,youtube.activeDetail),0);
  });

  ensureStyle();

  const overviewSelected = document.querySelector('[data-video-library-row].selected');
  if(overviewSelected?.dataset?.youtubeId) loadOverview(overviewSelected.dataset.youtubeId);

  const youtubeSelected = document.querySelector('[data-screen="youtube"] [data-yt-video-row].selected');
  if(youtubeSelected?.dataset?.ytVideoId) loadYouTube(youtubeSelected.dataset.ytVideoId);

  window.SkyrScoutYouTubeAnalytics = Object.freeze({
    refreshOverview:() => overview.videoId && loadOverview(overview.videoId),
    refreshYouTube:() => youtube.videoId && loadYouTube(youtube.videoId)
  });
})();
