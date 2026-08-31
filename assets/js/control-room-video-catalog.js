(function(){
  'use strict';

  const backend = window.SkyrScoutStaffBackend;
  if(!backend || typeof backend.fetchYouTubeCatalog !== 'function') return;

  function cleanId(value){
    const id = String(value || '').trim();
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
  }

  function fmtPublished(value){
    const ms = Number(value || 0);
    if(!Number.isFinite(ms) || ms <= 0) return 'Publish date unavailable';
    try{
      return 'Published ' + new Intl.DateTimeFormat('en-GB',{
        day:'numeric',month:'short',year:'numeric',timeZone:'UTC'
      }).format(new Date(ms));
    }catch(_){
      return 'Published ' + new Date(ms).toISOString().slice(0,10);
    }
  }

  function fmtNumber(value){
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
  }

  function siteOverviewMetadata(){
    const map = new Map();
    document.querySelectorAll('[data-video-library-row][data-youtube-id]').forEach(row => {
      const id = cleanId(row.dataset.youtubeId);
      if(!id || map.has(id)) return;
      map.set(id,{
        format:String(row.dataset.videoFormat || ''),
        playerName:String(row.dataset.playerName || ''),
        playerDisplay:String(row.dataset.playerDisplay || ''),
        playerClub:String(row.dataset.playerClub || ''),
        playerUrl:String(row.dataset.playerUrl || ''),
        videoUrl:String(row.dataset.videoUrl || ''),
        reportDate:String(row.dataset.reportDate || ''),
        siteAdded:String(row.dataset.siteAdded || '')
      });
    });
    return map;
  }

  function siteYoutubeMetadata(){
    const map = new Map();
    document.querySelectorAll('[data-yt-video-row][data-yt-video-id]').forEach(row => {
      const id = cleanId(row.dataset.ytVideoId);
      if(!id || map.has(id)) return;
      map.set(id,{
        format:String(row.dataset.ytVideoFormat || ''),
        title:String(row.dataset.ytVideoTitle || ''),
        name:String(row.dataset.ytVideoName || ''),
        meta:String(row.dataset.ytVideoMeta || '')
      });
    });
    return map;
  }

  const overviewKnown = siteOverviewMetadata();
  const youtubeKnown = siteYoutubeMetadata();

  function resolvedFormat(item){
    const id = cleanId(item && item.videoId);
    const known = overviewKnown.get(id) || youtubeKnown.get(id);
    if(known && (known.format === 'long' || known.format === 'short')) return known.format;
    return item && item.videoType === 'short' ? 'short' : 'long';
  }

  function makeOverviewRow(item){
    const id = cleanId(item.videoId);
    const format = resolvedFormat(item);
    const known = overviewKnown.get(id) || {};
    const title = String(known.playerDisplay || item.title || id);
    const row = document.createElement('div');
    row.className = 'video-row';
    row.dataset.videoLibraryRow = '';
    row.dataset.youtubeId = id;
    row.dataset.videoFormat = format;
    row.dataset.youtubePublishedAt = String(Number(item.publishedAtMs || 0) || '');
    row.dataset.fullChannelCatalog = '1';

    if(format === 'short'){
      row.dataset.shortRow = '';
      row.dataset.videoTitle = String(item.title || title);
      row.dataset.videoUrl = String(known.videoUrl || '');
    }else{
      row.dataset.playerRow = '';
      row.dataset.playerName = String(known.playerName || title);
      row.dataset.playerDisplay = title;
      row.dataset.playerClub = String(known.playerClub || '');
      row.dataset.playerUrl = String(known.playerUrl || '');
      row.dataset.reportDate = String(known.reportDate || '');
      row.dataset.siteAdded = String(known.siteAdded || '');
    }

    const img = document.createElement('img');
    const fallback = 'https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/mqdefault.jpg';
    img.src = String(item.thumbnail || '') || fallback;
    img.alt = '';
    img.loading = 'lazy';
    img.onerror = function(){ this.onerror = null; this.src = fallback; };

    const meta = document.createElement('div');
    meta.className = 'vmeta';
    const strong = document.createElement('strong');
    strong.textContent = title;
    const small = document.createElement('small');
    small.dataset.videoPublishedDate = '';
    small.textContent = fmtPublished(item.publishedAtMs);
    meta.append(strong,small);

    const value = document.createElement('b');
    if(format === 'short') value.dataset.shortLiveValue = '';
    else value.dataset.playerLiveValue = '';
    value.textContent = fmtNumber(item.totalViews);

    row.append(img,meta,value);
    return row;
  }

  function makeYoutubeRow(item){
    const id = cleanId(item.videoId);
    const format = resolvedFormat(item);
    const known = youtubeKnown.get(id) || {};
    const title = String(known.title || item.title || id);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'yt-video-row' + (format === 'short' ? ' yt-short-row' : '');
    row.dataset.ytVideoRow = '';
    row.dataset.ytVideoFormat = format;
    row.dataset.ytVideoId = id;
    row.dataset.ytVideoTitle = title;
    row.dataset.ytVideoName = String(known.name || title);
    row.dataset.ytVideoMeta = String(known.meta || (format === 'short' ? 'SkyrScout Short' : 'SkyrScout YouTube'));
    row.dataset.youtubePublishedAt = String(Number(item.publishedAtMs || 0) || '');
    row.dataset.fullChannelCatalog = '1';

    const img = document.createElement('img');
    const fallback = 'https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/mqdefault.jpg';
    img.src = String(item.thumbnail || '') || fallback;
    img.alt = '';
    img.loading = 'lazy';
    img.onerror = function(){ this.onerror = null; this.src = fallback; };

    const copy = document.createElement('span');
    copy.className = 'yt-video-copy';
    const strong = document.createElement('strong');
    strong.textContent = title;
    const small = document.createElement('small');
    small.dataset.videoPublishedDate = '';
    small.textContent = fmtPublished(item.publishedAtMs);
    copy.append(strong,small);

    const arrow = document.createElement('span');
    arrow.className = 'yt-row-arrow';
    arrow.textContent = '›';
    row.append(img,copy,arrow);
    return row;
  }

  function addMissingOverviewRows(catalog){
    document.querySelectorAll('.video-library-panel').forEach(panel => {
      const existing = new Set(Array.from(panel.querySelectorAll('[data-video-library-row]'))
        .map(row => cleanId(row.dataset.youtubeId)).filter(Boolean));
      const longList = panel.querySelector('[data-video-library-pane="long"] .player-scroll');
      const shortList = panel.querySelector('[data-video-library-pane="short"] .player-scroll');
      if(!longList || !shortList) return;
      catalog.forEach(item => {
        const id = cleanId(item.videoId);
        if(!id || existing.has(id)) return;
        const row = makeOverviewRow(item);
        (resolvedFormat(item) === 'short' ? shortList : longList).appendChild(row);
        existing.add(id);
      });
    });
  }

  function addMissingYoutubeRows(catalog){
    document.querySelectorAll('.yt-video-selector-panel').forEach(panel => {
      const existing = new Set(Array.from(panel.querySelectorAll('[data-yt-video-row]'))
        .map(row => cleanId(row.dataset.ytVideoId)).filter(Boolean));
      const longList = panel.querySelector('[data-yt-video-pane="long"] .yt-video-list');
      const shortList = panel.querySelector('[data-yt-video-pane="short"] .yt-video-list');
      if(!longList || !shortList) return;
      catalog.forEach(item => {
        const id = cleanId(item.videoId);
        if(!id || existing.has(id)) return;
        const row = makeYoutubeRow(item);
        (resolvedFormat(item) === 'short' ? shortList : longList).appendChild(row);
        existing.add(id);
      });
    });
  }

  async function loadCatalog(){
    try{
      const result = await backend.fetchYouTubeCatalog();
      const catalog = Array.isArray(result && result.catalog) ? result.catalog : [];
      if(!catalog.length) throw new Error('EMPTY_YOUTUBE_CATALOG');
      addMissingOverviewRows(catalog);
      addMissingYoutubeRows(catalog);
      document.dispatchEvent(new CustomEvent('controlroom:videometadataupdated',{
        detail:{source:'youtube-channel-catalog',videoCount:catalog.length}
      }));
      document.dispatchEvent(new CustomEvent('controlroom:channelcatalogloaded',{
        detail:{videoCount:catalog.length,meta:result.meta || {}}
      }));
    }catch(error){
      console.warn('Control Room full YouTube catalog:', error);
    }
  }

  loadCatalog();
})();
