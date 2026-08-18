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

  function setFormat(format){
    const next = format === 'short' ? 'short' : 'long';
    qa('[data-yt-format-tab]').forEach(btn => {
      const active = btn.dataset.ytFormatTab === next;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    qa('[data-yt-video-pane]').forEach(pane => {
      pane.hidden = pane.dataset.ytVideoPane !== next;
    });
    const type = q('[data-yt-selected-type]');
    if(type) type.textContent = next === 'short' ? 'SHORT' : 'LONG VIDEO';

    const selectedInPane = q('[data-yt-video-pane="' + next + '"] [data-yt-video-row].selected');
    const firstInPane = q('[data-yt-video-pane="' + next + '"] [data-yt-video-row]');
    selectVideo(selectedInPane || firstInPane);
  }

  function selectVideo(row){
    if(!row) return;
    qa('[data-yt-video-row]').forEach(item => item.classList.remove('selected'));
    row.classList.add('selected');

    const id = String(row.dataset.ytVideoId || '');
    const title = String(row.dataset.ytVideoTitle || row.dataset.ytVideoName || 'Selected video');
    const meta = String(row.dataset.ytVideoMeta || '');
    const date = String(row.dataset.ytVideoDate || '');
    const format = row.dataset.ytVideoFormat === 'short' ? 'short' : 'long';

    qa('[data-yt-selected-title]').forEach(el => { el.textContent = title; });
    qa('[data-yt-selected-meta]').forEach(el => {
      el.textContent = [meta, date ? 'Added ' + date : ''].filter(Boolean).join(' · ');
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

  document.addEventListener('click', event => {
    const formatTab = event.target.closest('[data-yt-format-tab]');
    if(formatTab && isYouTubeUi(formatTab)){
      event.preventDefault();
      event.stopPropagation();
      setFormat(formatTab.dataset.ytFormatTab);
      const clonePanel = formatTab.closest('#consoleFocusShell .youtube-panel');
      if(clonePanel){
        clonePanel.querySelectorAll('[data-yt-format-tab]').forEach(btn => {
          const active = btn.dataset.ytFormatTab === (formatTab.dataset.ytFormatTab === 'short' ? 'short' : 'long');
          btn.classList.toggle('active', active);
          btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        clonePanel.querySelectorAll('[data-yt-video-pane]').forEach(pane => {
          pane.hidden = pane.dataset.ytVideoPane !== (formatTab.dataset.ytFormatTab === 'short' ? 'short' : 'long');
        });
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

  renderDetail('external');
  setFormat('long');
})();
