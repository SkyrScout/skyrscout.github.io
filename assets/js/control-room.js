
function snapRows(){
  document.querySelectorAll('.video-library-panel .player-scroll').forEach(scroller => {
    scroller.style.removeProperty('height');
  });
}
window.addEventListener('load',snapRows);window.addEventListener('resize',snapRows);

window.controlRoomSnapRows=snapRows;


(function(){
  const overlay = document.getElementById('consoleFocusOverlay');
  const shell = document.getElementById('consoleFocusShell');
  const closeBtn = document.getElementById('consoleFocusClose');
  const panels = Array.from(document.querySelectorAll('.dashboard .panel, .youtube-screen .panel'));
  let lastTrigger = null;

  const scrollSelectors = ['.rtlist','.geolist','.player-scroll','.trafficbody','.yt-video-list','.yt-panel-body'];

  function addFocusButton(panel){
    panel.classList.add('console-focusable');
    const header = panel.querySelector(':scope > .ph');
    if(!header) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'console-focus-btn';
    btn.innerHTML = '⛶';
    btn.title = 'Open console in Focus Mode';
    btn.setAttribute('aria-label','Open console in Focus Mode');
    const buttonHost = panel.classList.contains('youtube-panel')
      ? (header.querySelector('.yt-header-tools') || header)
      : header;
    buttonHost.appendChild(btn);

    btn.addEventListener('click', function(e){
      e.stopPropagation();
      openFocus(panel, btn);
    });

    header.addEventListener('click', function(e){
      if(e.target.closest('button')) return;
      openFocus(panel, header);
    });
  }

  function copyScrollPositions(original, clone){
    scrollSelectors.forEach(sel => {
      const originals = Array.from(original.querySelectorAll(sel));
      const clones = Array.from(clone.querySelectorAll(sel));
      originals.forEach((node, idx) => {
        if(clones[idx]) clones[idx].scrollTop = node.scrollTop;
      });
    });
  }

  function openFocus(panel, trigger){
    if(overlay.classList.contains('open')) return;
    lastTrigger = trigger || null;

    shell.className = 'console-focus-shell';
    if(panel.classList.contains('mappanel')) shell.classList.add('map-focus');
    if(panel.classList.contains('sidepanel')) shell.classList.add('side-focus');

    // YouTube Focus Mode uses content-aware shell heights instead of stretching
    // every console to the same near-fullscreen canvas.
    if(panel.classList.contains('youtube-panel')) {
      shell.classList.add('youtube-focus');
      if(panel.classList.contains('yt-video-selector-panel')) {
        shell.classList.add('youtube-focus-tall');
      } else if(panel.classList.contains('yt-performance-panel') || panel.classList.contains('yt-realtime-panel')) {
        shell.classList.add('youtube-focus-medium');
      } else {
        shell.classList.add('youtube-focus-compact');
      }
    }

    const focusTitle = (panel.querySelector('.pt')?.textContent || '').trim().toLowerCase();
    if(focusTitle.includes('realtime monitor')) shell.classList.add('realtime-focus');
    if(focusTitle.includes('geography')) shell.classList.add('geo-focus');
    if(focusTitle.includes('traffic / audience')) shell.classList.add('traffic-focus');
    if(focusTitle.includes('video library')) shell.classList.add('players-focus');
    if(focusTitle.includes('selected video')) shell.classList.add('selected-focus');

    const clone = panel.cloneNode(true);
    clone.classList.remove('console-focusable');
    clone.querySelectorAll('.console-focus-btn').forEach(el => el.remove());

    shell.querySelectorAll('.panel').forEach(el => el.remove());
    shell.appendChild(clone);

    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden','false');
    document.body.classList.add('console-focus-open');

    requestAnimationFrame(() => {
      copyScrollPositions(panel, clone);
      closeBtn.focus();
    });
  }

  function closeFocus(){
    if(!overlay.classList.contains('open')) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden','true');
    document.body.classList.remove('console-focus-open');
    shell.querySelectorAll('.panel').forEach(el => el.remove());
    if(lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus();
    lastTrigger = null;
  }

  panels.forEach(addFocusButton);

  closeBtn.addEventListener('click', closeFocus);
  document.addEventListener('controlroom:closefocus', closeFocus);
  overlay.addEventListener('click', function(e){
    if(e.target === overlay) closeFocus();
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape') closeFocus();
  });
})();



(function(){
  const VIEW_ASPECT=2.4827586207;
  const DETAIL_WORLD=[0,0,1036.8,734.0155];
  const shares={};
  let selectedCountry=null;
  let selectedDisplay=null;
  const dragState=new WeakMap();

  const mapBodies=()=>Array.from(document.querySelectorAll('.mapbody.map-interactive'));
  const geoBodies=()=>Array.from(document.querySelectorAll('.geography-panel-body'));
  const nums=s=>String(s).split(/[ ,]+/).filter(Boolean).map(Number);

  function findHit(body,country,layerSelector='.world-layer'){
    return Array.from(body.querySelectorAll(layerSelector+' .map-country-hit')).find(el=>el.dataset.country===country);
  }

  function countryInfo(country){
    for(const body of mapBodies()){
      const el=findHit(body,country,'.world-layer');
      if(el) return el.dataset;
    }
    return null;
  }

  function adjustedTarget(raw){
    let [x,y,w,h]=raw;
    // breathing room
    x-=w*.28;y-=h*.28;w*=1.56;h*=1.56;

    // Keep tiny states/territories in regional context rather than magnifying crude geometry.
    const minW=82;
    if(w<minW){const c=x+w/2;x=c-minW/2;w=minW;}

    // Large countries still get useful context.
    const maxW=560;
    if(w>maxW){const c=x+w/2;x=c-maxW/2;w=maxW;}

    if(w/h>VIEW_ASPECT){
      const nh=w/VIEW_ASPECT, c=y+h/2;
      y=c-nh/2;h=nh;
    }else{
      const nw=h*VIEW_ASPECT, c=x+w/2;
      x=c-nw/2;w=nw;
    }

    const [, , worldW, worldH]=DETAIL_WORLD;
    if(w>worldW)w=worldW;
    if(h>worldH)h=worldH;
    x=Math.max(0,Math.min(x,worldW-w));
    y=Math.max(0,Math.min(y,worldH-h));
    return [x,y,w,h];
  }

  function clampVB(v){
    let [x,y,w,h]=v;
    const [, , worldW, worldH]=DETAIL_WORLD;
    const minW=34, maxW=worldW;
    w=Math.max(minW,Math.min(maxW,w));
    h=w/VIEW_ASPECT;
    if(h>worldH){h=worldH;w=h*VIEW_ASPECT;}
    x=Math.max(0,Math.min(x,worldW-w));
    y=Math.max(0,Math.min(y,worldH-h));
    return [x,y,w,h];
  }

  function setVB(svg,v){
    svg.setAttribute('viewBox',v.map(n=>Number(n).toFixed(3)).join(' '));
    svg.dataset.currentVb=v.join(',');
  }

  function getVB(svg){
    const s=svg.getAttribute('viewBox');
    return nums(s);
  }

  function animateVB(svg,dest,duration=620){
    const startVB=getVB(svg);
    const start=performance.now();
    const ease=t=>1-Math.pow(1-t,3);
    svg._mapAnimToken=(svg._mapAnimToken||0)+1;
    const token=svg._mapAnimToken;
    function frame(now){
      if(svg._mapAnimToken!==token)return;
      const t=Math.min(1,(now-start)/duration), k=ease(t);
      const cur=startVB.map((n,i)=>n+(dest[i]-n)*k);
      setVB(svg,cur);
      if(t<1)requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function expandedStart(target){
    let [x,y,w,h]=target;
    const cX=x+w/2,cY=y+h/2;
    w=Math.min(DETAIL_WORLD[2],w*2.2);
    h=w/VIEW_ASPECT;
    if(h>DETAIL_WORLD[3]){h=DETAIL_WORLD[3];w=h*VIEW_ASPECT;}
    return clampVB([cX-w/2,cY-h/2,w,h]);
  }

  function flashTarget(body,display){
    const el=body.querySelector('.map-target-lock');
    if(!el)return;
    el.textContent=display.toUpperCase();
    el.classList.remove('show');
    void el.getBoundingClientRect();
    el.classList.add('show');
  }

  function syncGeography(country,display){
    geoBodies().forEach(panel=>{
      const overview=panel.querySelector('.geo-overview-state');
      const detail=panel.querySelector('.geo-country-state');
      if(!overview||!detail)return;
      if(country){
        overview.hidden=true;detail.hidden=false;
        detail.querySelector('.geo-country-title').textContent=display;
        detail.querySelector('.geo-country-share').textContent=shares[country]?shares[country]+' of tracked geography':'Geography data pending';
      }else{
        overview.hidden=false;detail.hidden=true;
      }
    });
  }

  function syncBadge(country,display){
    document.querySelectorAll('.map-scope-badge').forEach(el=>{
      el.textContent=country?display+' · geography pending':'Map ready · data pending';
    });
  }

  function selectCountry(country,display){
    const info=countryInfo(country);
    if(!info)return;
    selectedCountry=country;selectedDisplay=display||info.display||country;
    const target=adjustedTarget(nums(info.detailBox));

    mapBodies().forEach(body=>{
      const detail=body.querySelector('.detail-layer');
      if(!detail)return;
      body.classList.add('is-detail');
      body.dataset.mapMode='detail';
      const start=expandedStart(target);
      setVB(detail,start);
      requestAnimationFrame(()=>requestAnimationFrame(()=>animateVB(detail,target,650)));
      flashTarget(body,selectedDisplay);
    });
    syncGeography(country,selectedDisplay);
    syncBadge(country,selectedDisplay);
  }

  function resetWorld(){
    selectedCountry=null;selectedDisplay=null;
    mapBodies().forEach(body=>{
      body.classList.remove('is-detail','is-dragging');
      body.dataset.mapMode='world';
    });
    syncGeography(null,null);
    syncBadge(null,null);
  }

  function zoomBody(body,factor,clientX=null,clientY=null){
    const svg=body.querySelector('.detail-layer');
    if(!svg||!body.classList.contains('is-detail'))return;
    const vb=getVB(svg), rect=svg.getBoundingClientRect();
    const mx=clientX==null?0.5:Math.max(0,Math.min(1,(clientX-rect.left)/rect.width));
    const my=clientY==null?0.5:Math.max(0,Math.min(1,(clientY-rect.top)/rect.height));
    const newW=vb[2]*factor, newH=newW/VIEW_ASPECT;
    const anchorX=vb[0]+vb[2]*mx, anchorY=vb[1]+vb[3]*my;
    const nv=clampVB([anchorX-newW*mx,anchorY-newH*my,newW,newH]);
    animateVB(svg,nv,220);
  }

  document.addEventListener('click',e=>{
    if(e.target.closest('.map-nav')){
      const world=e.target.closest('.map-world-btn');
      if(world){resetWorld();return;}
      const z=e.target.closest('[data-map-zoom]');
      if(z){
        const body=z.closest('.mapbody');
        zoomBody(body,z.dataset.mapZoom==='in'?.72:1.38);
        return;
      }
    }
    if(e.target.closest('.geo-world-view')){resetWorld();return;}

    const geo=e.target.closest('[data-map-country]');
    if(geo){
      const info=countryInfo(geo.dataset.mapCountry);
      if(info)selectCountry(geo.dataset.mapCountry,info.display);
      return;
    }

    const hit=e.target.closest('.map-country-hit,.map-country-dot');
    if(hit){
      const body=hit.closest('.mapbody');
      if(body?.dataset.ignoreClick==='1')return;
      selectCountry(hit.dataset.country,hit.dataset.display);
    }
  });

  document.addEventListener('keydown',e=>{
    const hit=e.target.closest&&e.target.closest('.map-country-hit,.map-country-dot');
    if(hit&&(e.key==='Enter'||e.key===' ')){
      e.preventDefault();selectCountry(hit.dataset.country,hit.dataset.display);return;
    }
    if(e.key==='Escape'&&selectedCountry){
      const overlay=document.getElementById('consoleFocusOverlay');
      if(!overlay?.classList.contains('open'))resetWorld();
    }
  });

  document.addEventListener('mousemove',e=>{
    const hit=e.target.closest&&e.target.closest('.map-country-hit,.map-country-dot');
    document.querySelectorAll('.map-hover-label').forEach(label=>{
      const body=label.closest('.mapbody');
      if(!hit||!body.contains(hit)){label.style.display='none';return;}
      const r=body.getBoundingClientRect();
      label.textContent=hit.dataset.display;
      label.style.left=Math.min(r.width-130,Math.max(8,e.clientX-r.left+12))+'px';
      label.style.top=Math.min(r.height-36,Math.max(8,e.clientY-r.top+12))+'px';
      label.style.display='block';
    });
  });
  document.addEventListener('mouseout',e=>{
    if(e.target.closest&&e.target.closest('.map-country-hit,.map-country-dot')){
      document.querySelectorAll('.map-hover-label').forEach(el=>el.style.display='none');
    }
  });

  document.addEventListener('pointerdown',e=>{
    const body=e.target.closest&&e.target.closest('.mapbody.is-detail');
    if(!body||e.target.closest('.map-nav'))return;
    const svg=body.querySelector('.detail-layer');
    if(!svg)return;
    body.classList.add('is-dragging');
    body.dataset.ignoreClick='0';
    dragState.set(body,{id:e.pointerId,x:e.clientX,y:e.clientY,vb:getVB(svg),moved:false});
    try{svg.setPointerCapture(e.pointerId)}catch(_e){}
  });

  document.addEventListener('pointermove',e=>{
    const body=e.target.closest&&e.target.closest('.mapbody.is-detail');
    if(!body)return;
    const st=dragState.get(body);
    if(!st||st.id!==e.pointerId)return;
    const svg=body.querySelector('.detail-layer'), rect=svg.getBoundingClientRect();
    const dx=e.clientX-st.x,dy=e.clientY-st.y;
    if(Math.abs(dx)+Math.abs(dy)>4)st.moved=true;
    const scaleX=st.vb[2]/rect.width, scaleY=st.vb[3]/rect.height;
    const nv=clampVB([st.vb[0]-dx*scaleX,st.vb[1]-dy*scaleY,st.vb[2],st.vb[3]]);
    setVB(svg,nv);
  });

  function endDrag(e){
    mapBodies().forEach(body=>{
      const st=dragState.get(body);
      if(!st||st.id!==e.pointerId)return;
      body.classList.remove('is-dragging');
      if(st.moved){
        body.dataset.ignoreClick='1';
        setTimeout(()=>{body.dataset.ignoreClick='0'},80);
      }
      dragState.delete(body);
    });
  }
  document.addEventListener('pointerup',endDrag);
  document.addEventListener('pointercancel',endDrag);

  document.addEventListener('wheel',e=>{
    const body=e.target.closest&&e.target.closest('.mapbody.is-detail');
    if(!body)return;
    e.preventDefault();
    zoomBody(body,e.deltaY<0?.84:1.19,e.clientX,e.clientY);
  },{passive:false});
})();



(function(){
  // No synthetic traffic data. Keep the map clean until a real Analytics geography feed is connected.
  function clearSyntheticTraffic(root){
    (root || document).querySelectorAll('.traffic-nodes').forEach(el => el.remove());
    (root || document).querySelectorAll('.traffic-country').forEach(el => {
      el.classList.remove('traffic-country');
      el.style.removeProperty('--traffic-edge');
      el.style.removeProperty('--traffic-stroke-width');
    });
  }
  clearSyntheticTraffic(document);

  const shell = document.getElementById('consoleFocusShell');
  if(shell){
    new MutationObserver(() => clearSyntheticTraffic(shell)).observe(shell,{childList:true,subtree:true});
  }
})();


(function(){
  'use strict';

  const subtitles = {
    overview: 'POV workstation. Overview screen.',
    youtube: 'YouTube intelligence. Private Analytics connection pending.',
    website: 'Website intelligence. Connection pending.',
    'hese-fredrik': 'Live movement monitor. Public YouTube-derived backend feed.'
  };

  function switchScreen(name){
    document.querySelectorAll('.control-screen').forEach(screen => {
      const active = screen.dataset.screen === name;
      screen.hidden = !active;
      screen.classList.toggle('active', active);
    });
    document.querySelectorAll('[data-screen-target]').forEach(tab => {
      const active = tab.dataset.screenTarget === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const subtitle = document.getElementById('controlRoomScreenSubtitle');
    if(subtitle) subtitle.textContent = subtitles[name] || subtitles.overview;
    if(name === 'overview') requestAnimationFrame(() => { if(window.controlRoomSnapRows) window.controlRoomSnapRows(); });
    document.dispatchEvent(new CustomEvent('controlroom:screenchange',{detail:{screen:name}}));
  }

  document.addEventListener('click', event => {
    const tab = event.target.closest('[data-screen-target]');
    if(tab){ switchScreen(tab.dataset.screenTarget); }
  });



  function formatReportDate(value){
    const m = String(value || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if(!m) return value || '—';
    const dt = new Date(Date.UTC(Number(m[3]),Number(m[2])-1,Number(m[1])));
    return dt.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  }

  function updateSelectedPlayer(row){
    if(!row) return;
    document.querySelectorAll('[data-player-row].selected').forEach(el => el.classList.remove('selected'));
    row.classList.add('selected');

    const name = row.dataset.playerName || row.dataset.playerDisplay || 'Selected player';
    const club = row.dataset.playerClub || '';
    const videoId = row.dataset.youtubeId || '';
    const reportDate = row.dataset.reportDate || '';
    const publishedAtMs = Number(row.dataset.youtubePublishedAt || 0);
    const publishedText = Number.isFinite(publishedAtMs) && publishedAtMs > 0
      ? new Date(publishedAtMs).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})
      : '';

    const badge = document.getElementById('selectedPlayerBadge');
    const thumb = document.getElementById('selectedPlayerThumb');
    const title = document.getElementById('selectedPlayerName');
    const meta = document.getElementById('selectedPlayerMeta');
    const trafficTitle = document.getElementById('selectedTrafficTitle');
    const panel = document.getElementById('selectedPlayerPanel');

    if(badge) badge.textContent = name.replace(/\s*\(\d{4}\)\s*$/, '');
    if(thumb && videoId) thumb.src = 'https://i.ytimg.com/vi/' + encodeURIComponent(videoId) + '/mqdefault.jpg';
    if(title) title.textContent = name;
    if(meta){
      const dateLine = publishedText
        ? 'Published ' + escapeHtml(publishedText)
        : 'Report ' + escapeHtml(formatReportDate(reportDate));
      meta.innerHTML = (club ? escapeHtml(club) + '<br>' : '') + dateLine;
    }
    if(trafficTitle) trafficTitle.textContent = name.replace(/\s*\(\d{4}\)\s*$/, '') + ' // Traffic / Audience';

    if(panel){
      panel.classList.add('selected-data-pending');
      panel.dataset.selectedYoutubeId = videoId;
    }

    document.querySelectorAll('[data-selected-metric]').forEach(el => {
      el.textContent = '—';
    });

    const trafficBody = document.getElementById('selectedTrafficBody');
    if(trafficBody){
      trafficBody.querySelectorAll('strong').forEach(el => {
        el.textContent = '—';
      });
    }
  }

  function escapeHtml(value){
    return String(value || '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  document.addEventListener('click', event => {
    const row = event.target.closest('[data-player-row]');
    if(row) updateSelectedPlayer(row);
  });

  let initialOverviewSelectionResolved = false;
  document.addEventListener('controlroom:videometadataupdated', () => {
    if(initialOverviewSelectionResolved) return;
    window.setTimeout(() => {
      if(initialOverviewSelectionResolved) return;
      const alreadySelected = document.querySelector('.video-library-panel [data-video-library-row].selected');
      if(alreadySelected){
        initialOverviewSelectionResolved = true;
        return;
      }
      const first = document.querySelector('.video-library-panel [data-video-library-pane="long"] [data-video-library-row]:not([hidden])');
      if(!first) return;
      initialOverviewSelectionResolved = true;
      document.querySelectorAll('[data-video-library-row].selected').forEach(el => el.classList.remove('selected'));
      first.classList.add('selected');
      updateSelectedPlayer(first);
      document.dispatchEvent(new CustomEvent('controlroom:videoselected',{
        detail:{
          videoId:String(first.dataset.youtubeId || ''),
          format:'long',
          title:String(first.dataset.playerDisplay || first.dataset.playerName || ''),
          publishedAtMs:Number(first.dataset.youtubePublishedAt || 0) || null,
          url:String(first.dataset.playerUrl || '')
        }
      }));
    },0);
  });

  // Expose only the small internal hooks needed by other Control Room modules.
  window.SkyrScoutControlRoom = Object.freeze({switchScreen, updateSelectedPlayer});
})();
