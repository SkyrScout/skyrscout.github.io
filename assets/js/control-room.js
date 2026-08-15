
function snapRows(){const s=document.getElementById('playerScroll');if(!s)return;const toolbar=s.querySelector('.toolbar');const rowH=52;const usable=s.clientHeight-(toolbar?toolbar.offsetHeight:0);const count=Math.max(1,Math.floor(usable/rowH));const exact=(toolbar?toolbar.offsetHeight:0)+count*rowH;s.style.height=exact+'px';}
window.addEventListener('load',snapRows);window.addEventListener('resize',snapRows);

window.controlRoomSnapRows=snapRows;


(function(){
  const overlay = document.getElementById('consoleFocusOverlay');
  const shell = document.getElementById('consoleFocusShell');
  const closeBtn = document.getElementById('consoleFocusClose');
  const panels = Array.from(document.querySelectorAll('.dashboard .panel'));
  let lastTrigger = null;

  const scrollSelectors = ['.rtlist','.geolist','.player-scroll','.trafficbody'];

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
    header.appendChild(btn);

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

    const focusTitle = (panel.querySelector('.pt')?.textContent || '').trim().toLowerCase();
    if(focusTitle.includes('realtime monitor')) shell.classList.add('realtime-focus');
    if(focusTitle.includes('geography')) shell.classList.add('geo-focus');
    if(focusTitle.includes('traffic / audience')) shell.classList.add('traffic-focus');
    if(focusTitle.includes('all player videos')) shell.classList.add('players-focus');
    if(focusTitle.includes('selected player')) shell.classList.add('selected-focus');

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
  const shares={"Norway":"24.8%","United States of America":"18.6%","Brazil":"6.7%","India":"4.9%"};
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
        detail.querySelector('.geo-country-share').textContent=shares[country]?shares[country]+' of tracked geography':'Selected country';
      }else{
        overview.hidden=false;detail.hidden=true;
      }
    });
  }

  function syncBadge(country,display){
    document.querySelectorAll('.map-scope-badge').forEach(el=>{
      el.textContent=country?display+' · demo geography':'Demo traffic · 48 H';
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
  /*
    Temporary visual traffic layer.
    Values below are demo weights so we can judge the map treatment before
    the real YouTube Analytics geography feed is connected.
  */
  const DEMO_TRAFFIC = {
    "Norway": 100,
    "United States of America": 75,
    "Brazil": 34,
    "India": 25,
    "United Kingdom": 18,
    "Germany": 14,
    "Sweden": 12,
    "Canada": 10,
    "France": 8,
    "Netherlands": 7,
    "Australia": 6,
    "Japan": 5
  };

  function intensityStyle(weight){
    const t = Math.max(.05, Math.min(1, weight / 100));
    return {
      edge: (.025 + t * .075).toFixed(3),
      strokeWidth: (.16 + t * .20).toFixed(2),
      nodeOpacity: (.58 + t * .42).toFixed(3)
    };
  }

  function makeNode(svg, hit, weight, mode){
    const centerAttr = mode === 'world' ? hit.dataset.worldCenter : hit.dataset.detailCenter;
    if(!centerAttr) return null;
    const [cx, cy] = centerAttr.split(/[ ,]+/).map(Number);
    if(!Number.isFinite(cx) || !Number.isFinite(cy)) return null;

    const t = Math.max(.05, Math.min(1, weight / 100));
    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('class','traffic-node');
    g.style.setProperty('--traffic-delay', (-2.4 * t).toFixed(2) + 's');

    const halo = document.createElementNS('http://www.w3.org/2000/svg','circle');
    halo.setAttribute('class','traffic-halo');
    halo.setAttribute('cx',cx);
    halo.setAttribute('cy',cy);
    halo.setAttribute('r',(mode === 'world' ? 2.8 + t*4.6 : 3.2 + t*4.8).toFixed(2));

    const spark1 = document.createElementNS('http://www.w3.org/2000/svg','line');
    spark1.setAttribute('class','traffic-spark');
    spark1.setAttribute('x1',cx - (1.8+t*1.8)); spark1.setAttribute('x2',cx + (1.8+t*1.8));
    spark1.setAttribute('y1',cy); spark1.setAttribute('y2',cy);
    const spark2 = document.createElementNS('http://www.w3.org/2000/svg','line');
    spark2.setAttribute('class','traffic-spark');
    spark2.setAttribute('x1',cx); spark2.setAttribute('x2',cx);
    spark2.setAttribute('y1',cy - (1.8+t*1.8)); spark2.setAttribute('y2',cy + (1.8+t*1.8));

    const core = document.createElementNS('http://www.w3.org/2000/svg','circle');
    core.setAttribute('class','traffic-core');
    core.setAttribute('cx',cx);
    core.setAttribute('cy',cy);
    core.setAttribute('r',(mode === 'world' ? .72 + t*1.18 : .86 + t*1.25).toFixed(2));

    g.appendChild(halo);
    g.appendChild(spark1);
    g.appendChild(spark2);
    g.appendChild(core);
    return g;
  }

  function applyTrafficToMap(body){
    body.querySelectorAll('.map-layer').forEach(svg => {
      const mode = svg.classList.contains('world-layer') ? 'world' : 'detail';

      let nodes = svg.querySelector('.traffic-nodes');
      if(nodes) nodes.remove();
      nodes = document.createElementNS('http://www.w3.org/2000/svg','g');
      nodes.setAttribute('class','traffic-nodes');

      const hits = Array.from(svg.querySelectorAll('.map-country-hit'));
      Object.entries(DEMO_TRAFFIC).forEach(([country, weight]) => {
        const hit = hits.find(el => el.dataset.country === country);
        if(!hit) return;

        const s = intensityStyle(weight);
        hit.classList.add('traffic-country');
        hit.style.setProperty('--traffic-edge',s.edge);
        hit.style.setProperty('--traffic-stroke-width',s.strokeWidth);

        const node = makeNode(svg, hit, weight, mode);
        if(node){
          node.style.setProperty('--traffic-node-opacity',s.nodeOpacity);
          nodes.appendChild(node);
        }
      });

      // Put visual nodes under invisible click hit-zones, so interaction stays unchanged.
      const hitGroup = svg.querySelector('.world-hit-zones, .detail-hit-zones');
      if(hitGroup) svg.insertBefore(nodes, hitGroup);
      else svg.appendChild(nodes);
    });
  }

  function applyAll(){
    document.querySelectorAll('.mapbody.map-interactive').forEach(applyTrafficToMap);

    // Make clear that this is a temporary visualization, not live geography.
    document.querySelectorAll('.map-scope-badge').forEach(badge => {
      if((badge.textContent || '').trim() === 'All traffic · 48 H'){
        badge.textContent = 'Demo traffic · 48 H';
      }
    });
  }

  applyAll();

  // Focus Mode clones a console, so ensure the cloned map gets the visual layer too.
  const observer = new MutationObserver(() => {
    document.querySelectorAll('#consoleFocusShell .mapbody.map-interactive').forEach(body => {
      if(!body.dataset.trafficDemoApplied){
        applyTrafficToMap(body);
        body.dataset.trafficDemoApplied = '1';
      }
    });
  });
  const shell = document.getElementById('consoleFocusShell');
  if(shell) observer.observe(shell,{childList:true,subtree:true});
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

  function parseDMY(value){
    const m = String(value || '').trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if(!m) return 0;
    return Date.UTC(Number(m[3]), Number(m[2])-1, Number(m[1]));
  }

  function sortPlayerRows(){
    const scroller = document.getElementById('playerScroll');
    if(!scroller) return;
    const rows = Array.from(scroller.querySelectorAll('[data-player-row]'));
    rows.sort((a,b) => {
      const d = parseDMY(b.dataset.siteAdded) - parseDMY(a.dataset.siteAdded);
      return d || String(a.dataset.playerDisplay || '').localeCompare(String(b.dataset.playerDisplay || ''), 'en');
    });
    rows.forEach(row => scroller.appendChild(row));
  }

  const coltonReference = {
    youtubeId: 'zPDOV79nRE4',
    metrics: {views:'163',likes:'8',ctr:'7.5%',avgViewDuration:'6:21',watchTime:'17.1 h',uniqueViewers:'35'}
  };

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

    const badge = document.getElementById('selectedPlayerBadge');
    const thumb = document.getElementById('selectedPlayerThumb');
    const title = document.getElementById('selectedPlayerName');
    const meta = document.getElementById('selectedPlayerMeta');
    const trafficTitle = document.getElementById('selectedTrafficTitle');
    const panel = document.getElementById('selectedPlayerPanel');

    if(badge) badge.textContent = name.replace(/\s*\(\d{4}\)\s*$/, '');
    if(thumb && videoId) thumb.src = 'https://i.ytimg.com/vi/' + encodeURIComponent(videoId) + '/mqdefault.jpg';
    if(title) title.textContent = name;
    if(meta) meta.innerHTML = (club ? escapeHtml(club) + '<br>' : '') + 'Report ' + escapeHtml(formatReportDate(reportDate));
    if(trafficTitle) trafficTitle.textContent = name.replace(/\s*\(\d{4}\)\s*$/, '') + ' // Traffic / Audience';

    const isColton = videoId === coltonReference.youtubeId;
    if(panel) panel.classList.toggle('selected-data-pending', !isColton);

    document.querySelectorAll('[data-selected-metric]').forEach(el => {
      const key = el.dataset.selectedMetric;
      el.textContent = isColton && coltonReference.metrics[key] ? coltonReference.metrics[key] : '—';
    });

    const trafficBody = document.getElementById('selectedTrafficBody');
    if(trafficBody){
      trafficBody.querySelectorAll('strong').forEach(el => {
        if(!el.dataset.referenceValue) el.dataset.referenceValue = el.textContent;
        if(!isColton) el.textContent = '—';
        else el.textContent = el.dataset.referenceValue;
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

  sortPlayerRows();
  const defaultRow = Array.from(document.querySelectorAll('[data-player-row]')).find(row => row.dataset.youtubeId === coltonReference.youtubeId);
  if(defaultRow) updateSelectedPlayer(defaultRow);

  // Expose only the small internal hooks needed by other Control Room modules.
  window.SkyrScoutControlRoom = Object.freeze({switchScreen, updateSelectedPlayer});
})();
