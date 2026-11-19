/* =================== WIRE UP =================== */
/* Song notes for the browser: the patch view only shows the patch itself */
Object.assign(P1,{style:'Folded sine techno · F minor',key:'Logistic map + Fibonacci',
  blurb:'Dark, chaotic techno built from pure sine waves. A wavefolder bends each hit into grit, with the amount locked per step, so no two bars play the same.',
  maths:'Section lengths are Fibonacci numbers: 8, 5, 13, 8, 5, 13 and 3 bars, adding up to 55. Chance comes from the logistic map x → r·x·(1−x), held in its chaotic range. Each section sets r between 3.62 and 3.99, with a calmer period-3 window at 3.83. The song is in F minor: the bass walks the F minor pentatonic by the Fibonacci sequence, and the pad moves through Fm9, D♭maj9, E♭9 and B♭m9, five sines stacked in thirds, choosing its chord by the Fibonacci number of the bar.',
  sound:'Every voice starts as a sine oscillator, then runs through a wavefolder and a tanh drive. Kicks on Fibonacci steps (1, 2, 3, 5, 8, 13) fold hard, the bass folds as the chance value rises, hats arrive in Fibonacci numbers (3, 5, 8, then 13 per bar, with open hats later), the golden ratio picks the percussion notes, the lead follows a Collatz sequence through F minor, and the kick and rumble are tuned to F. Effect sends are locked per hit.'});

const fmtLen=P=>{const sec=Math.round(P.sections.reduce((a,x)=>a+x.bars,0)*16*(P.stepSeconds??60/P.bpm/4));return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');};
const barsOf=P=>P.sections.reduce((a,x)=>a+x.bars,0);
let SEL=null,VIEW='songs';
function patchTag(patch){
  return patch.stepSeconds?'Experimental':/^Ambient/i.test(patch.style)?'Ambient':'Rhythmic';
}
function libraryModuleGroups(){
  const groups=new Map([
    ['Distortion',new Set()],['Dynamics',new Set()],['Sampling and slicing',new Set()],
    ['EQ and stereo',new Set()],['Effects and output',new Set()],
    ['Synths and percussion',new Set()],['Sequencing and control',new Set()]
  ]);
  for(const device of [...MST_DEV,...Object.values(RETURN_DEVICES)]){
    const type={sat:'Distortion',glue:'Dynamics',lim:'Dynamics',eq:'EQ and stereo',width:'EQ and stereo'}[device.id]??'Effects and output';
    groups.get(type).add(device.name);
  }
  groups.get('Effects and output').add('LOUDNESS');
  for(const patch of PATCHES){
    for(const module of patch.modules){
      const name=module.title.replace(/~$/,'');
      let type='Sequencing and control';
      if(/^(SLICER |DECKS$|BREAK$|ONE-SHOTS$|VOX$)/.test(name))type='Sampling and slicing';
      else if(/^(DAC|TAPE ECHO)$/.test(name))type='Effects and output';
      else if(module.voice||/^SINE \d$/.test(name))type='Synths and percussion';
      groups.get(type).add(name);
    }
  }
  return groups;
}
let moduleSort='type',moduleDirection=1;
try{if(localStorage.getItem('ff-module-sort')==='name')moduleSort='name';}catch(e){}
function renderModuleIndex(){
  const modules=[...libraryModuleGroups()].flatMap(([type,names])=>[...names].map(name=>({name,type})));
  const byName=moduleSort==='name';
  modules.sort((a,b)=>moduleDirection*(byName?a.name.localeCompare(b.name):a.type.localeCompare(b.type))||a.name.localeCompare(b.name));
  const index=$('patchGroups');
  const headings=[['name','Name'],['type','Tag']].map(([key,label])=>{
    const active=key===moduleSort;
    const direction=moduleDirection===1?'ascending':'descending';
    return `<th scope="col"${active?` aria-sort="${direction}"`:''}><button type="button" data-module-sort="${key}">${label}${active?` <span aria-hidden="true">${moduleDirection===1?'↑':'↓'}</span>`:''}</button></th>`;
  }).join('');
  index.innerHTML=`<table class="song-table module-table" aria-label="Modules"><thead><tr>${headings}</tr></thead>
    <tbody>${modules.map(({name,type})=>`<tr><td>${name}</td><td><span class="library-tag">${type}</span></td></tr>`).join('')}</tbody></table>`;
}
$('patchGroups').addEventListener('click',event=>{
  const heading=event.target.closest('button[data-module-sort]');
  if(!heading)return;
  const key=heading.dataset.moduleSort;
  moduleDirection=moduleSort===key?-moduleDirection:1;
  moduleSort=key;
  try{localStorage.setItem('ff-module-sort',key);}catch(e){}
  renderModuleIndex();
  $('patchGroups').querySelector(`[data-module-sort="${key}"]`).focus({preventScroll:true});
});
const librarySearch=$('librarySearch');
const libraryResults=$('libraryResults');
$('libraryBack').onclick=()=>{
  if(history.state?.sonomikaNavigation)history.back();
  else if(!$('detail').hidden||VIEW==='index')go('songs');
  else go(PATCH.id);
};
$('libraryUp').onclick=()=>go('songs');
function renderLibrarySearch(){
  const terms=librarySearch.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const searching=terms.length>0;
  libraryResults.hidden=!searching;
  $('librarySearchStatus').hidden=!searching;
  $('libraryContent').classList.toggle('searching',searching);
  if(!searching){libraryResults.replaceChildren();return;}
  const matches=value=>terms.every(term=>value.toLowerCase().includes(term));
  const patches=PATCHES.filter(patch=>matches(`${patch.title} ${patch.style} ${patchTag(patch)} ${patch.key} ${patch.bpm??''} ${patch.stepSeconds?'':'BPM'} ${fmtLen(patch)}`));
  const modules=[...libraryModuleGroups()].flatMap(([type,names])=>[...names]
    .filter(name=>matches(`${name} ${type}`)).map(name=>({name,type})));
  const count=patches.length+modules.length;
  $('librarySearchStatus').textContent=count===0?'No matches':`${count} ${count===1?'result':'results'}`;
  libraryResults.innerHTML=`<ul>${patches.map(patch=>
    `<li class="library-row"><button class="row" data-id="${patch.id}">${patch.title}</button><span class="library-tag">${patchTag(patch)}</span></li>`).join('')}
    ${modules.map(({name,type})=>`<li class="library-row"><span>${name}</span><span class="library-tag">${type}</span></li>`).join('')}</ul>`;
}

librarySearch.addEventListener('input',renderLibrarySearch);
libraryResults.addEventListener('click',event=>{
  const patch=event.target.closest('button[data-id]');
  if(patch)go('songs/'+patch.dataset.id);
});
const songColumns=[
  ['Name',patch=>patch.title],
  ['Style',patch=>patch.style],
  ['Tag',patchTag],
  ['BPM',patch=>patch.stepSeconds?Infinity:patch.bpm],
  ['Duration',patch=>barsOf(patch)*16*(patch.stepSeconds??60/patch.bpm/4)]
];
let songSort=null;
let songDirection=1;
function renderList(){
  const list=$('songList');
  const patches=[...PATCHES];
  if(songSort!==null){
    const value=songColumns[songSort][1];
    patches.sort((a,b)=>{
      const left=value(a),right=value(b);
      return songDirection*(typeof left==='string'?left.localeCompare(right):left===right?0:left-right);
    });
  }
  const headings=songColumns.map(([label],index)=>{
    const active=index===songSort;
    const direction=songDirection===1?'ascending':'descending';
    return `<th scope="col"${active?` aria-sort="${direction}"`:''}><button type="button" data-song-sort="${index}">${label}${active?` <span aria-hidden="true">${songDirection===1?'↑':'↓'}</span>`:''}</button></th>`;
  }).join('');
  const rows=patches.map(P=>`<tr>
    <td><button class="row${P===PATCH&&playing?' loaded':''}" data-id="${P.id}" aria-controls="detail"><span class="live" aria-label="playing">▶ </span>${P.title}</button></td>
    <td>${P.style}</td>
    <td><span class="library-tag">${patchTag(P)}</span></td>
    <td>${P.stepSeconds?'—':P.bpm}</td>
    <td>${fmtLen(P)}</td>
  </tr>`).join('');
  list.innerHTML=`<div class="song-table-scroll"><table class="song-table" aria-label="Patches">
    <colgroup><col class="song-name"><col><col class="song-tag"><col class="song-tempo"><col class="song-duration"></colgroup>
    <thead><tr>${headings}</tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function renderDetail(){const P=SEL,D=$('detail'),tot=barsOf(P);
  D.setAttribute('aria-labelledby','detailTitle');
  D.innerHTML=`<h2 id="detailTitle">${P.title}</h2>
  <div class="meta"><span>PATCH ${P.num}</span>${P.stepSeconds?'':`<span>${P.bpm} BPM</span><span>${tot} BARS</span>`}<span>${fmtLen(P)}</span><span>${P.key.toUpperCase()}</span></div>
  <p class="blurb">${P.blurb}</p>
  <div class="acts">
    <button class="fld on" id="dOpen" aria-label="Open the patch" title="Open the patch">Open</button>
    <button class="fld" id="dPlay" aria-label="${P===PATCH&&playing?'Pause':'Play'}" title="Play / pause"><i data-ic="${P===PATCH&&playing?'Pause':'Play'}" class="fill">${P===PATCH&&playing?'PAUSE':'PLAY'}</i></button>
  </div>
  <h3>STRUCTURE</h3>
  <div class="struct">${P.sections.map((x,i)=>`<button class="sx" data-si="${i}" data-pid="${P.id}" style="flex:${x.bars} 1 0" aria-label="${x.name}, ${x.bars} bars"><i class="bar2"></i></button>`).join('')}</div>
  <ol class="secs">${P.sections.map((x,i)=>`<li data-si="${i}" data-pid="${P.id}">${x.name}<span>${x.bars} bars · ${P.secLabel(x)}</span></li>`).join('')}</ol>
  <h3>THE MATHS</h3><p class="body">${P.maths}</p>
  <h3>THE SOUND</h3><p class="body">${P.sound}</p>`;
  fillIcons(D);$('dPlay').onclick=()=>{if(PATCH!==P)loadPatch(P);toggleplay();};
  $('dOpen').onclick=()=>{if(PATCH!==P)loadPatch(P);go(P.id);};
  D.querySelectorAll('.sx').forEach(b=>b.onclick=()=>{if(PATCH!==P)loadPatch(P);jumpTo(+b.dataset.si);});
  if(P===PATCH)uiStep(Math.floor(stepIdx/16)%TOTAL_BARS,0,secOf(Math.floor(stepIdx/16)%TOTAL_BARS),PATCH.sections[secOf(Math.floor(stepIdx/16)%TOTAL_BARS)],[]);}
function select(P){SEL=P;renderList();renderDetail();}
const mixerPanel = $('mixView');
new ResizeObserver(()=>{
  if(mixerPanel.hidden)return;
  document.body.style.setProperty('--mixer-height',mixerPanel.offsetHeight+'px');
  fitWires();
}).observe(mixerPanel);

function showView(v,showPatchDetails=false,mixerGrid=false){VIEW=v;setTimeout(fitWires,0);
  if(librarySearch.value){
    librarySearch.value='';
    renderLibrarySearch();
  }
  const inLibrary=v==='songs'||v==='index';
  const mixerOpen=v==='mixer';
  const midiOpen=v==='midi';
  if(!midiOpen)LEARN=null;
  $('midiView').hidden=!midiOpen;
  if(midiOpen)renderMidi();
  $('library').hidden=!inLibrary;
  if(inLibrary)$('libraryContent').scrollTop=0;
  $('songList').hidden=showPatchDetails;
  $('detail').hidden=!showPatchDetails;
  if(inLibrary){
    $('libraryPath').textContent=['Library',v==='index'?'Modules':'Patches',showPatchDetails?SEL.title:''].filter(Boolean).join(' / ');
    $('libraryUp').disabled=v==='songs'&&!showPatchDetails;
  }
  for(const [id,current] of [['libraryPatches',v==='songs'],['libraryModules',v==='index']]){
    $(id).classList.toggle('on',current);
    if(current)$(id).setAttribute('aria-current','page');else $(id).removeAttribute('aria-current');
  }
  const wm=v==='wires'||(mixerOpen&&!mixerGrid);
  $('patchIndex').hidden=v!=='index';$('browser').hidden=v!=='songs';
  $('patchView').hidden=inLibrary||midiOpen;$('mixView').hidden=!mixerOpen;
  $('dock').hidden=inLibrary||midiOpen;$('centerb').hidden=!wm;$('fitPatch').hidden=!wm;
  $('dockMixer').classList.toggle('on',mixerOpen);
  $('dockMixer').setAttribute('aria-pressed',mixerOpen);
  if(mixerOpen)renderMixer();
  if(wm!==WIREMODE){WIREMODE=wm;renderPatch();uiStep(Math.floor(stepIdx/16)%TOTAL_BARS,0,secOf(Math.floor(stepIdx/16)%TOTAL_BARS),PATCH.sections[secOf(Math.floor(stepIdx/16)%TOTAL_BARS)],[]);if(PATCH===P1)drawArr();}
  $('vSongs').classList.toggle('on',inLibrary);
  $('vSongs').setAttribute('aria-pressed',String(inLibrary));
  [['vPatch','patch'],['vWires','wires']].forEach(([id,k])=>{$(id).classList.toggle('on',v===k);$(id).setAttribute('aria-selected',v===k);});
  document.title=midiOpen?'Sonomika Patch · MIDI':v==='index'?'Sonomika Patch · modules':v==='songs'?'Sonomika Patch · library':'Sonomika Patch';(document.documentElement.dataset.frame?document.body:window).scrollTo(0,0);}
function pageRoute(){
  const legacy = location.hash.slice(1);
  if (legacy) return legacy;
  const {searchParams} = new URL(location.href);
  const patch = searchParams.get('patch') || '';
  switch (searchParams.get('view')) {
    case 'library': return patch ? 'songs/'+patch : 'songs';
    case 'modules': return 'patches';
    case 'midi': return 'midi/'+patch;
    case 'grid': return patch+'-patch';
    case 'mixer': return patch+'-mixer';
    default: return patch;
  }
}
function go(hash, replace=false, mixerGrid=VIEW==='patch'||(VIEW==='mixer'&&!WIREMODE)){
  const url = new URL(location.href);
  url.hash = '';
  url.searchParams.delete('patch');
  url.searchParams.delete('layout');
  if (hash==='songs'||hash.startsWith('songs/')) {
    url.searchParams.set('view','library');
    if (hash.startsWith('songs/')) url.searchParams.set('patch',hash.slice('songs/'.length));
  } else if (hash==='patches') {
    url.searchParams.set('view','modules');
  } else if(hash.startsWith('midi/')){
    url.searchParams.set('view','midi');
    url.searchParams.set('patch',hash.slice(5));
  } else {
    const view = hash.endsWith('-mixer') ? 'mixer' : hash.endsWith('-patch') ? 'grid' : 'patch';
    url.searchParams.set('view',view);
    if(view==='mixer'&&mixerGrid)url.searchParams.set('layout','grid');
    url.searchParams.set('patch',hash.replace(/-(wires|patch|mixer)$/,''));
  }
  if(typeof PORTABLE_PATCH!=='undefined'){
    const view=url.searchParams.get('view');
    if(view==='modules')renderModuleIndex();
    showView(({library:'songs',modules:'index',grid:'patch',mixer:'mixer',midi:'midi'})[view]??'wires',false,mixerGrid);
    return;
  }
  if (url.href!==location.href) {
    if (replace) history.replaceState(null,'',url);
    else history.pushState({sonomikaNavigation:true},'',url);
  }
  route();
}
function route(){const h=pageRoute().replace(/-wires$/,''),grid=h.endsWith('-patch'),mixv=h.endsWith('-mixer'),P=PATCHES.find(p=>p.id===h.replace(/-(patch|mixer)$/,''));
  if(h.startsWith('midi/')){
    const target=PATCHES.find(p=>p.id===h.slice(5));
    if(target&&target!==PATCH)loadPatch(target);
    showView('midi');
    $('midiBack').focus({preventScroll:true});
    return;
  }
  if(h.startsWith('songs/')){
    const selectedPatch=PATCHES.find(p=>p.id===h.slice('songs/'.length));
    if(!selectedPatch){showView('songs');return;}
    select(selectedPatch);
    showView('songs',true);
    $('detail').focus({preventScroll:true});
    return;
  }
  if(h==='patches'){renderModuleIndex();showView('index');}else if(h==='songs')showView('songs');else{const Q=P||PATCH;if(Q!==PATCH)loadPatch(Q);select(Q);showView(mixv?'mixer':grid?'patch':'wires',false,new URL(location.href).searchParams.get('layout')==='grid');}}
const ARTIST='SONOMIKA';
function loadPatch(P){if(playing)stop();if(LUFS.matching)LUFS.match(false);LUFS.reset();if(P!==PATCH){mixerSelection='master';mixerSolos.clear();}PATCH=P;LEARN=null;setTimeout(renderMidi);$('songTitle').textContent=P.title.charAt(0)+P.title.slice(1).toLowerCase();stepIdx=0;computeSections();P.reset();
  if(bus?.drizzleReverb)bus.drizzleReverb.wet.gain.setTargetAtTime(P===P9?1.8:0,ctx.currentTime,.04);
  const tempo=$('bpm');
  const hasTempo=Number.isFinite(P.bpm);
  const tempoGroup=$('bpmgrp');
  tempoGroup.hidden=!hasTempo;
  const tempoRow=tempoGroup.closest('.mrow');
  if(tempoRow)tempoRow.hidden=!hasTempo;
  tempo.readOnly=Boolean(P.stepSeconds);
  tempo.value=hasTempo?P.bpm:'';
  $('seedv').textContent=P.seed;
  const brand = document.querySelector('.brand');
  brand.dataset.route = P.id;
  brand.href = '?view=patch&patch=' + encodeURIComponent(P.id);
  $('rl').textContent=P.readLabels[0];$('xl').textContent=P.readLabels[1];
  const root=document.documentElement;
  const frame=savedFrame;
  if(frame)root.dataset.frame=frame;else delete root.dataset.frame;
  $('frameSize').value=frame||'';
  ZOOM=savedZoom??P.layoutDef?.zoom??1;
  $('zVal').textContent=Math.round(ZOOM*100)+'%';
  root.style.setProperty('--mz',ZOOM);
  LOOPSI=null;renderSections();paintLoop();renderPatch();if(SEL)renderDetail();if(ctx){[...mixIds(),'rret','dret','vinylNoise'].forEach(applyStrip);applyMaster();}if(VIEW==='mixer')renderMixer();uiStep(0,0,0,P.sections[0],[]);if(P===P1)drawArr();renderList();renderFormats();}
// a patch made in two video formats shows a 16:9 / 9:16 selector beside the time
function renderFormats(){const el=$('fmtSel');if(!el)return;const F=PATCH.formats;el.hidden=!F;if(!F){el.replaceChildren();return;}
  el.replaceChildren(...F.map(f=>{const b=document.createElement('button');b.type='button';b.className='fld fmt-b';b.textContent=f;b.setAttribute('aria-pressed',String(PATCH.format===f));
    b.onclick=()=>{if(PATCH.format===f)return;PATCH.setFormat(f);loadPatch(PATCH);};return b;}));}
$('songList').onclick=e=>{
  const heading=e.target.closest('button[data-song-sort]');
  if(heading){
    const index=Number(heading.dataset.songSort);
    songDirection=songSort===index?-songDirection:1;
    songSort=index;
    renderList();
    $('songList').querySelector(`[data-song-sort="${index}"]`).focus({preventScroll:true});
    return;
  }
  const button=e.target.closest('.row');
  if(!button)return;
  go('songs/'+button.dataset.id);
};
document.querySelectorAll('a[data-route]').forEach(link=>{
  link.addEventListener('click',event=>{
    if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    go(link.dataset.route);
  });
});
$('vSongs').onclick=()=>go('songs');
$('vPatch').onclick=()=>go(PATCH.id+'-patch');
$('vWires').onclick=()=>go(PATCH.id);
$('dockMixer').onclick=()=>go(PATCH.id+(VIEW==='mixer'?(WIREMODE?'':'-patch'):'-mixer'));
$('loopb').onclick=toggleLoop;
$('zIn').onclick=event=>setZoom(event.shiftKey?ZOOM+.01:ZOOM*1.2);
$('zOut').onclick=event=>setZoom(event.shiftKey?ZOOM-.01:ZOOM/1.2);
function enterZoomLevel(){
  const value=prompt('Zoom percentage (1–250)',String(Math.round(ZOOM*100)));
  if(value===null)return;
  const entered=value.trim().replace(/%$/,'').trim();
  const percent=Number(entered);
  if(entered&&Number.isFinite(percent))setZoom(percent/100);
}
$('zVal').ondblclick=enterZoomLevel;
$('zVal').onclick=event=>{if(event.detail===0)enterZoomLevel();};
$('zVal').onkeydown=event=>{
  if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;
  event.preventDefault();
  setZoom(ZOOM+(event.key==='ArrowUp'?.01:-.01));
};
