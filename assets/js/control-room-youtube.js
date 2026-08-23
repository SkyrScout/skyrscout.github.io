/* YouTube 09 Most Likes runtime injector
   Ensures console 09 exists before authenticated Control Room scripts load.
   24H is the default view; 7D and Lifetime are available in-console.
*/
(function ensureMostLikesPanel(){
  const styleId = 'ytMostLikesRuntimeStyle';
  if(!document.getElementById(styleId)){
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .yt-screen-grid > .yt-most-liked-panel{grid-column:3;grid-row:3;display:grid!important;visibility:visible!important;opacity:1!important}
      .yt-most-liked-body{display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:6px;overflow:hidden}
      .yt-like-tabs{display:flex;align-items:center;gap:5px}
      .yt-like-tab{appearance:none;border:1px solid #3a1715;border-radius:999px;background:#080707;color:#9d8381;padding:3px 8px;font:800 7px/1 inherit;letter-spacing:.04em;cursor:pointer}
      .yt-like-tab:hover{border-color:#80413d;color:#f2dddd}
      .yt-like-tab.active{border-color:#d75f58;background:#29100f;color:#fff}
      .yt-most-liked-list{min-height:0;display:grid;align-content:start;gap:3px;overflow-y:auto;padding-right:4px;scrollbar-gutter:stable}
      .yt-most-liked-row{min-width:0;display:grid;grid-template-columns:22px minmax(0,1fr) auto;grid-template-rows:auto auto;column-gap:7px;row-gap:3px;align-items:center;padding:5px 3px 6px;border-bottom:1px solid #1e0d0d}
      .yt-most-liked-rank{grid-row:1/3;align-self:center;color:#d66d68;font-size:9px;font-weight:900;text-align:center}
      .yt-most-liked-title{min-width:0;color:#f0eeee;font-size:8px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .yt-most-liked-count{color:#fff;font-size:10px;font-weight:900;white-space:nowrap}
      .yt-most-liked-meta{min-width:0;display:flex;align-items:center;gap:6px}
      .yt-most-liked-type{flex:0 0 auto;color:#8d7372;font-size:6px;font-weight:900;letter-spacing:.05em}
      .yt-most-liked-bar{min-width:0;flex:1;height:5px;overflow:hidden;border-radius:999px;background:#1a0c0c}
      .yt-most-liked-bar>i{display:block;height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,#80302d,#e2645e)}
      .yt-most-liked-empty{padding:10px 4px;color:#6f5b5a;font-size:8px;line-height:1.4}
      @media(max-width:900px){.yt-screen-grid>.yt-most-liked-panel{grid-column:auto;grid-row:auto}}
    `;
    document.head.appendChild(style);
  }

  const screen = document.querySelector('.control-screen[data-screen="youtube"], .youtube-screen');
  const grid = screen && screen.querySelector('.yt-screen-grid');
  if(!grid || grid.querySelector('.yt-most-liked-panel')) return;

  const panel = document.createElement('section');
  panel.className = 'panel youtube-panel yt-most-liked-panel';
  panel.dataset.console = '09';
  panel.dataset.youtubeConsole = '09';

  panel.innerHTML = `
    <div class="ph">
      <div class="yt-panel-heading"><span class="yt-step">09</span><div class="pt">Most Likes</div></div>
      <div class="yt-header-tools">
        <span class="badge yt-freshness yt-freshness-live">LIVE</span>
        <div class="yt-info-control" data-yt-info-control>
          <button class="yt-info-button" type="button" aria-label="About Most Likes data" aria-expanded="false" data-yt-info-button>i</button>
          <div class="yt-info-popover" role="tooltip">
            <div><strong>Source</strong><span>VPS collector / YouTube Data API</span></div>
            <div><strong>Freshness</strong><span>Current like totals use the normal VPS poll. 24H and 7D baselines use one local snapshot per hour.</span></div>
            <div><strong>Meaning</strong><span>24H and 7D rank net likes gained. Lifetime ranks the current public like total.</span></div>
            <div><strong>Rule</strong><span>No extra YouTube poll is made for like history.</span></div>
          </div>
        </div>
      </div>
    </div>
    <div class="yt-panel-body yt-most-liked-body">
      <div class="yt-like-tabs" role="tablist" aria-label="Most Likes time range">
        <button class="yt-like-tab active" type="button" role="tab" aria-selected="true" data-yt-like-window="24h">24H</button>
        <button class="yt-like-tab" type="button" role="tab" aria-selected="false" data-yt-like-window="7d">7D</button>
        <button class="yt-like-tab" type="button" role="tab" aria-selected="false" data-yt-like-window="lifetime">LIFETIME</button>
      </div>
      <div class="yt-most-liked-list" id="ytMostLikedList" data-yt-most-liked-list>
        <div class="yt-most-liked-empty">Building like history…</div>
      </div>
      <div class="yt-panel-note" data-yt-most-liked-note>BUILDING HISTORY · 0H / 24H</div>
    </div>`;
  grid.appendChild(panel);
})();

(function(){
  'use strict';

  const screen = document.querySelector('[data-screen="youtube"]');
  if(!screen) return;

  const detailDefinitions = {
    external: {
      title: 'External sites / apps',
      context: 'External traffic',
      note: 'Shows the websites and apps sending viewers to the selected video. Time ranges can later switch between 48 H, since publishing and other supported windows.',
      rows: ['Website / app','Website / app','Website / app','Website / app','Website / app']
    },
    search: {
      title: 'YouTube search terms',
      context: 'YouTube Search',
      note: 'Shows the actual search terms viewers used before watching the selected video.',
      rows: ['Search term','Search term','Search term','Search term','Search term']
    },
    channel: {
      title: 'Channel-page traffic',
      context: 'Channel pages',
      note: 'Expands traffic that arrived through YouTube channel pages.',
      rows: ['Channel page','Channel page','Channel page','Channel page']
    },
    suggested: {
      title: 'Suggested-video traffic',
      context: 'Suggested videos',
      note: 'Shows which videos or recommendation surfaces are sending suggested traffic when YouTube returns that detail.',
      rows: ['Suggested source','Suggested source','Suggested source','Suggested source']
    },
    direct: {
      title: 'Direct / unknown',
      context: 'Direct or unknown',
      note: 'YouTube groups traffic here when a more specific referrer is not available.',
      rows: ['Direct / unknown traffic']
    }
  };

  function q(sel, root){ return (root || screen).querySelector(sel); }
  function qa(sel, root){ return Array.from((root || screen).querySelectorAll(sel)); }
  function isYouTubeUi(node){ return !!(node && (screen.contains(node) || node.closest('#consoleFocusShell'))); }


  function publishedMs(row){
    const n = Number(row && row.dataset ? row.dataset.youtubePublishedAt : NaN);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function publishedLabel(row){
    const small = row && row.querySelector ? row.querySelector('[data-video-published-date]') : null;
    return small ? String(small.textContent || '') : '';
  }

  function selectorSearchText(row){
    return [
      row.dataset.ytVideoTitle,
      row.dataset.ytVideoName,
      row.dataset.ytVideoMeta,
      publishedLabel(row)
    ].filter(Boolean).join(' ').toLocaleLowerCase('en');
  }

  function selectorPanels(){
    return Array.from(document.querySelectorAll('.yt-video-selector-panel'));
  }

  function activeSelectorFormat(panel){
    const active = panel && panel.querySelector('[data-yt-format-tab].active');
    return active && active.dataset.ytFormatTab === 'short' ? 'short' : 'long';
  }

  function applySelectorPanel(panel){
    if(!panel) return;
    const format = activeSelectorFormat(panel);
    const pane = panel.querySelector('[data-yt-video-pane="' + format + '"]');
    if(!pane) return;

    const direction = panel.dataset.ytVideoSort === 'oldest' ? 'oldest' : 'newest';
    const query = String(panel.dataset.ytVideoQuery || '').trim().toLocaleLowerCase('en');
    const list = pane.querySelector('.yt-video-list');
    const rows = Array.from(pane.querySelectorAll('[data-yt-video-row]'));

    rows.sort((a,b) => {
      const aDate = publishedMs(a);
      const bDate = publishedMs(b);
      if(aDate === null && bDate !== null) return 1;
      if(aDate !== null && bDate === null) return -1;
      if(aDate !== null && bDate !== null && aDate !== bDate){
        return direction === 'oldest' ? aDate - bDate : bDate - aDate;
      }
      return String(a.dataset.ytVideoTitle || '').localeCompare(String(b.dataset.ytVideoTitle || ''), 'en');
    });
    if(list) rows.forEach(row => list.appendChild(row));

    let shown = 0;
    rows.forEach(row => {
      const match = !query || selectorSearchText(row).includes(query);
      row.hidden = !match;
      if(match) shown += 1;
    });

    const count = panel.querySelector('[data-yt-video-count]');
    if(count){
      const noun = format === 'short' ? 'SHORTS' : 'VIDEOS';
      count.textContent = query ? (shown + ' / ' + rows.length) : (rows.length + ' ' + noun);
    }

    const sortButton = panel.querySelector('[data-yt-video-sort]');
    if(sortButton){
      sortButton.textContent = direction === 'oldest' ? 'OLDEST' : 'NEWEST';
      sortButton.setAttribute('aria-label', direction === 'oldest'
        ? 'Sort Video Selector newest first'
        : 'Sort Video Selector oldest first');
      sortButton.title = 'Sort by YouTube publication time';
    }
  }

  function setSelectorState(sourcePanel, patch){
    if(!sourcePanel) sourcePanel = selectorPanels()[0] || null;
    if(!sourcePanel) return;
    const format = patch.format || activeSelectorFormat(sourcePanel) || 'long';
    const sort = patch.sort || sourcePanel.dataset.ytVideoSort || 'newest';
    const query = patch.query !== undefined ? patch.query : (sourcePanel.dataset.ytVideoQuery || '');

    selectorPanels().forEach(panel => {
      panel.dataset.ytVideoSort = sort === 'oldest' ? 'oldest' : 'newest';
      panel.dataset.ytVideoQuery = query;
      panel.querySelectorAll('[data-yt-format-tab]').forEach(btn => {
        const active = btn.dataset.ytFormatTab === format;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      panel.querySelectorAll('[data-yt-video-pane]').forEach(pane => {
        pane.hidden = pane.dataset.ytVideoPane !== format;
      });
      const input = panel.querySelector('[data-yt-video-search]');
      if(input && input.value !== query) input.value = query;
      applySelectorPanel(panel);
    });
  }

  function setFormat(format){
    const next = format === 'short' ? 'short' : 'long';
    setSelectorState(selectorPanels()[0] || null,{format:next});

    const type = q('[data-yt-selected-type]');
    if(type) type.textContent = next === 'short' ? 'SHORT' : 'LONG VIDEO';

    const selectedInPane = q('[data-yt-video-pane="' + next + '"] [data-yt-video-row].selected');
    const firstInPane = q('[data-yt-video-pane="' + next + '"] [data-yt-video-row]:not([hidden])');
    selectVideo(selectedInPane || firstInPane);
  }

  function selectVideo(row){
    if(!row) return;
    qa('[data-yt-video-row]').forEach(item => item.classList.remove('selected'));
    row.classList.add('selected');

    const id = String(row.dataset.ytVideoId || '');
    const title = String(row.dataset.ytVideoTitle || row.dataset.ytVideoName || 'Selected video');
    const meta = String(row.dataset.ytVideoMeta || '');
    const publishText = publishedLabel(row);
    const format = row.dataset.ytVideoFormat === 'short' ? 'short' : 'long';

    qa('[data-yt-selected-title]').forEach(el => { el.textContent = title; });
    qa('[data-yt-selected-meta]').forEach(el => {
      el.textContent = [meta, publishText].filter(Boolean).join(' · ');
    });
    qa('[data-yt-selected-type]').forEach(el => { el.textContent = format === 'short' ? 'SHORT' : 'LONG VIDEO'; });
    qa('[data-yt-selected-thumb]').forEach(img => {
      if(!id) return;
      img.onerror = function(){ this.onerror = null; this.src = 'https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/mqdefault.jpg'; };
      img.src = format === 'short'
        ? 'https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/maxresdefault.jpg'
        : 'https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/mqdefault.jpg';
      img.alt = title + ' thumbnail';
    });

    screen.dataset.selectedYoutubeId = id;
    screen.dataset.selectedVideoFormat = format;
    screen.dispatchEvent(new CustomEvent('youtubeanalytics:videoselected', {detail:{videoId:id, title:title, format:format}}));
  }

  function renderDetail(key){
    const def = detailDefinitions[key] || detailDefinitions.external;
    qa('[data-yt-source]').forEach(btn => btn.classList.toggle('active', btn.dataset.ytSource === key));

    const title = document.getElementById('ytDetailTitle');
    const body = document.getElementById('ytDetailBody');
    if(title) title.textContent = def.title;
    if(!body) return;

    body.replaceChildren();

    const context = document.createElement('div');
    context.className = 'yt-detail-context';
    const strong = document.createElement('strong');
    strong.textContent = def.context;
    const text = document.createElement('span');
    text.textContent = def.note;
    context.append(strong, text);

    const list = document.createElement('div');
    list.className = 'yt-detail-list';
    def.rows.forEach(label => {
      const row = document.createElement('div');
      row.className = 'yt-detail-row';
      const name = document.createElement('span');
      name.textContent = label;
      const value = document.createElement('strong');
      value.textContent = '—';
      row.append(name, value);
      list.appendChild(row);
    });

    const pending = document.createElement('div');
    pending.className = 'yt-panel-note';
    pending.textContent = 'Analytics data pending. No placeholder values are shown.';

    body.append(context, list, pending);
  }

  function closeInfoControls(except){
    document.querySelectorAll('[data-yt-info-control].open').forEach(control => {
      if(control === except) return;
      control.classList.remove('open');
      const button = control.querySelector('[data-yt-info-button]');
      if(button) button.setAttribute('aria-expanded','false');
    });
  }

  function toggleInfoControl(button){
    const control = button && button.closest('[data-yt-info-control]');
    if(!control) return;
    const willOpen = !control.classList.contains('open');
    closeInfoControls(control);
    control.classList.toggle('open', willOpen);
    button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  }

  function setLatestAvailableLabel(dateText){
    const clean = String(dateText || '').trim();
    const label = clean ? 'LATEST AVAILABLE · ' + clean : 'LATEST AVAILABLE';
    document.querySelectorAll('[data-yt-latest-label]').forEach(el => { el.textContent = label; });
  }

  document.addEventListener('click', event => {
    const infoButton = event.target.closest('[data-yt-info-button]');
    if(infoButton && isYouTubeUi(infoButton)){
      event.preventDefault();
      event.stopPropagation();
      toggleInfoControl(infoButton);
      return;
    }
    if(!event.target.closest('[data-yt-info-control]')) closeInfoControls();

    const formatTab = event.target.closest('[data-yt-format-tab]');
    if(formatTab && isYouTubeUi(formatTab)){
      event.preventDefault();
      event.stopPropagation();
      setFormat(formatTab.dataset.ytFormatTab);
      return;
    }

    const clearButton = event.target.closest('[data-yt-video-clear]');
    if(clearButton && isYouTubeUi(clearButton)){
      event.preventDefault();
      event.stopPropagation();
      const panel = clearButton.closest('.yt-video-selector-panel');
      if(panel){
        setSelectorState(panel,{query:''});
        const input = panel.querySelector('[data-yt-video-search]');
        if(input) input.focus();
      }
      return;
    }

    const sortButton = event.target.closest('[data-yt-video-sort]');
    if(sortButton && isYouTubeUi(sortButton)){
      event.preventDefault();
      event.stopPropagation();
      const panel = sortButton.closest('.yt-video-selector-panel');
      if(panel){
        const sort = panel.dataset.ytVideoSort === 'oldest' ? 'newest' : 'oldest';
        setSelectorState(panel,{sort});
      }
      return;
    }

    const video = event.target.closest('[data-yt-video-row]');
    if(video && isYouTubeUi(video)){
      event.preventDefault();
      const id = String(video.dataset.ytVideoId || '');
      const format = video.dataset.ytVideoFormat === 'short' ? 'short' : 'long';
      const original = q('[data-yt-video-row][data-yt-video-format="' + format + '"][data-yt-video-id="' + CSS.escape(id) + '"]');
      selectVideo(original || video);
      const clonePanel = video.closest('#consoleFocusShell .youtube-panel');
      if(clonePanel){
        clonePanel.querySelectorAll('[data-yt-video-row]').forEach(item => item.classList.toggle('selected', item.dataset.ytVideoId === id));
      }
      return;
    }

    const source = event.target.closest('[data-yt-source]');
    if(source && isYouTubeUi(source)){
      event.preventDefault();
      renderDetail(source.dataset.ytSource);
      const clonePanel = source.closest('#consoleFocusShell .youtube-panel');
      if(clonePanel){
        clonePanel.querySelectorAll('[data-yt-source]').forEach(btn => btn.classList.toggle('active', btn.dataset.ytSource === source.dataset.ytSource));
      }
    }
  });


  document.addEventListener('input', event => {
    const search = event.target.closest && event.target.closest('[data-yt-video-search]');
    if(!search || !isYouTubeUi(search)) return;
    const panel = search.closest('.yt-video-selector-panel');
    if(panel) setSelectorState(panel,{query:search.value || ''});
  });

  document.addEventListener('controlroom:videometadataupdated', () => {
    selectorPanels().forEach(applySelectorPanel);
    const selected = q('[data-yt-video-row].selected');
    if(selected) selectVideo(selected);
  });

  window.SkyrScoutYouTubeUi = Object.freeze({
    setLatestAvailable: setLatestAvailableLabel
  });

  selectorPanels().forEach(panel => { panel.dataset.ytVideoSort = 'newest'; panel.dataset.ytVideoQuery = ''; });
  renderDetail('external');
  setFormat('long');
})();
