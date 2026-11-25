function framePatch({zoomIn=false}={}){
  if(!WIREMODE||!WZ)return;
  const host=$('wires');
  const items=[...host.querySelectorAll('.wframe,.wwin')].filter(item=>item.getClientRects().length);
  if(!items.length)return;
  const frame=appFrame(), canvas=host.getBoundingClientRect();
  const dock=$('zoomc').getBoundingClientRect();
  const left=Math.max(frame.left,canvas.left), right=Math.min(frame.right,canvas.right);
  const topControls=[...document.querySelectorAll('.topbar,#sceneStrip')]
    .filter(control=>control.getClientRects().length);
  const top=Math.max(frame.top,canvas.top,...topControls.map(control=>control.getBoundingClientRect().bottom));
  const bottom=Math.min(frame.bottom,canvas.bottom,dock.height?dock.top:Infinity);
  const padding=16*frameScale();
  if(right-left<=2*padding||bottom-top<=2*padding)return;
  const bounds=()=>{
    const rects=items.map(item=>item.getBoundingClientRect());
    return {
      left:Math.min(...rects.map(rect=>rect.left)),right:Math.max(...rects.map(rect=>rect.right)),
      top:Math.min(...rects.map(rect=>rect.top)),bottom:Math.max(...rects.map(rect=>rect.bottom))
    };
  };
  let patch=bounds();
  const scale=Math.min((right-left-2*padding)/(patch.right-patch.left),
    (bottom-top-2*padding)/(patch.bottom-patch.top));
  const fitZoom=Math.floor(ZOOM*scale*100)/100;
  if(fitZoom<ZOOM||zoomIn){
    setZoom(fitZoom);
    patch=bounds();
  }
  PAN.x+=(left+right-patch.left-patch.right)/(2*frameScale());
  PAN.y+=(top+bottom-patch.top-patch.bottom)/(2*frameScale());
  applyPan();
}
function centerPatch(){framePatch();}
$('centerb').onclick=centerPatch;
$('fitPatch').onclick=()=>{
  if(!WIREMODE||WINDRAG)return;
  renderPatch({grid:true});
  framePatch({zoomIn:true});
};
/* Keep secondary controls in the menu at every app size. */
let videoRecording=null,videoCapturePending=false;
async function startVideoRecording(button){
  if(videoRecording||videoCapturePending)return;
  const patch=PATCH;
  const idle=button.dataset.label||'Record video';
  const canvas=document.createElement('canvas');
  if(!window.MediaRecorder||!navigator.mediaDevices?.getDisplayMedia){
    button.textContent='Recording unavailable';
    return;
  }
  const mp4='video/mp4;codecs="avc1,mp4a.40.2"';
  const mimeType=[mp4,'video/webm;codecs=vp8,opus','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));
  if(!mimeType){
    button.textContent='Recording format unavailable';
    return;
  }
  if(patch.recordCanvas)return startCanvasRecording(button,patch,mimeType,idle);
  const video=document.createElement('video');
  video.muted=true;
  video.playsInline=true;
  const drawing=canvas.getContext('2d',{alpha:false});
  const chunks=[];
  let stream,audioTap,tabStream,frameRequest,pointer,restoreLoop,watch,finish;
  const root=document.documentElement;
  const movePointer=event=>{
    pointer.hidden=event.pointerType==='touch';
    pointer.style.transform=`translate(${event.clientX}px,${event.clientY}px)`;
  };
  const hidePointer=()=>{pointer.hidden=true;};
  const cleanup=()=>{
    clearInterval(watch);
    clearTimeout(finish);
    root.classList.remove('capture-app');
    if(pointer){
      window.removeEventListener('pointermove',movePointer);
      window.removeEventListener('blur',hidePointer);
      root.removeEventListener('pointerleave',hidePointer);
      pointer.remove();
    }
    if(frameRequest!=null)video.cancelVideoFrameCallback(frameRequest);
    if(audioTap){try{MST.trim.disconnect(audioTap);}catch(e){}}
    tabStream?.getTracks().forEach(track=>track.stop());
    video.srcObject=null;
    stream?.getTracks().forEach(track=>track.stop());
    audioTap?.stream.getTracks().forEach(track=>track.stop());
    videoRecording=null;
    videoCapturePending=false;
    if(restoreLoop&&PATCH===patch)restoreLoop();
  };
  videoCapturePending=true;
  button.disabled=true;
  button.textContent='Choose this tab…';
  try{
    tabStream=await navigator.mediaDevices.getDisplayMedia({
      video:{frameRate:{ideal:60,max:60},displaySurface:'browser',cursor:'never'},
      audio:false,preferCurrentTab:true
    });
    const track=tabStream.getVideoTracks()[0];
    const surface=track.getSettings().displaySurface;
    if(surface&&surface!=='browser')throw new Error('Choose the app tab');
    let restricted=false;
    if(track.getSettings().cursor!=='never'&&navigator.mediaDevices.getSupportedConstraints?.().cursor){
      try{await track.applyConstraints({cursor:{exact:'never'},frameRate:{ideal:60,max:60}});}catch(e){}
    }
    if(track.getSettings().cursor!=='never'){
      if(!window.RestrictionTarget?.fromElement||!track.restrictTo){
        const error=new Error('Cursor-free tab capture unavailable');
        error.name='CursorCaptureUnavailable';
        throw error;
      }
      // Keep the live pointer outside the body subtree included in the recording.
      root.classList.add('capture-app');
      await track.restrictTo(await window.RestrictionTarget.fromElement(document.body));
      restricted=true;
      pointer=document.createElement('div');
      pointer.className='capture-pointer';
      pointer.hidden=true;
      pointer.setAttribute('aria-hidden','true');
      pointer.innerHTML='<svg viewBox="0 0 18 24"><path d="M1 1L1 19L6 14L10 22L13 20L9 12L16 12Z" fill="white" stroke="black" stroke-linejoin="round"/></svg>';
      root.appendChild(pointer);
      window.addEventListener('pointermove',movePointer);
      window.addEventListener('blur',hidePointer);
      root.addEventListener('pointerleave',hidePointer);
    }
    video.srcObject=tabStream;
    await video.play();
    if(PATCH!==patch||track.readyState==='ended')throw new DOMException('Recording cancelled','AbortError');
    if(!$('library').hidden||!$('midiView').hidden)go(patch.id);
    // Let the app repaint before recording.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if(PATCH!==patch||track.readyState==='ended')throw new DOMException('Recording cancelled','AbortError');
    const frame=document.documentElement.dataset.frame;
    const outputSize=frame==='portrait'?[1080,1920]:frame==='landscape'?[1920,1080]:null;
    if(!restricted&&!outputSize){
      stream=new MediaStream([track]);
    }else{
      const sourceRect=()=>{
        if(restricted)return {x:0,y:0,width:video.videoWidth,height:video.videoHeight};
        const bounds=appFrame();
        const sx=video.videoWidth/innerWidth,sy=video.videoHeight/innerHeight;
        return {x:bounds.left*sx,y:bounds.top*sy,width:bounds.width*sx,height:bounds.height*sy};
      };
      const source=sourceRect();
      const even=value=>Math.max(2,Math.round(value/2)*2);
      const scale=Math.min(1,1920/Math.max(source.width,source.height));
      [canvas.width,canvas.height]=outputSize??[even(source.width*scale),even(source.height*scale)];
      const drawFrame=()=>{
        const {x,y,width,height}=sourceRect();
        const scale=Math.min(canvas.width/width,canvas.height/height);
        const w=width*scale,h=height*scale;
        drawing.fillStyle='#000';
        drawing.fillRect(0,0,canvas.width,canvas.height);
        drawing.drawImage(video,x,y,width,height,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
        frameRequest=video.requestVideoFrameCallback(drawFrame);
      };
      drawFrame();
      stream=canvas.captureStream(60);
    }
    initAudio();
    ctx.resume().catch(()=>{});
    audioTap=ctx.createMediaStreamDestination();
    MST.trim.connect(audioTap);
    audioTap.stream.getAudioTracks().forEach(track=>stream.addTrack(track));
    const recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:20_000_000,audioBitsPerSecond:192_000});
    const title=PATCH.title.toLowerCase();
    let failed=false;
    recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
    recorder.onerror=()=>{failed=true;};
    recorder.onstop=()=>{
      cleanup();
      button.disabled=false;
      button.textContent=failed||!chunks.length?'Recording failed · retry':idle;
      if(failed||!chunks.length)return;
      const type=recorder.mimeType||chunks[0].type||'video/webm';
      const url=URL.createObjectURL(new Blob(chunks,{type}));
      const link=document.createElement('a');
      link.href=url;
      link.download=title+'-'+Date.now()+(type.startsWith('video/mp4')?'.mp4':'.webm');
      link.click();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
    };
    const previousLoop=LOOPSI;
    restoreLoop=()=>{LOOPSI=previousLoop;paintLoop();};
    LOOPSI=null;
    paintLoop();
    if(playing)stop();
    stepIdx=0;
    patch.reset?.();

    recorder.start(1000);
    track.addEventListener('ended',()=>{if(recorder.state!=='inactive')recorder.stop();},{once:true});
    videoRecording={recorder};
    videoCapturePending=false;
    button.disabled=false;
    button.textContent='Stop recording';
    start();
    watch=setInterval(()=>{
      if(playing)return;
      clearInterval(watch);
      finish=setTimeout(()=>{
        if(recorder.state!=='inactive')recorder.stop();
      },1500);
    },200);
  }catch(e){
    if(videoRecording?.recorder.state==='recording'){
      videoRecording.recorder.onstop=null;
      videoRecording.recorder.stop();
    }
    cleanup();
    button.disabled=false;
    button.textContent=e.name==='NotAllowedError'||e.name==='AbortError'?idle:e.name==='CursorCaptureUnavailable'?'Cursor-free recording unavailable':'Recording failed · choose this tab';
  }
}
// a patch that composes its own frame (e.g. a 9:16 lockup) is recorded straight from that canvas: no tab capture, exact size
async function startCanvasRecording(button,patch,mimeType,idle){
  videoCapturePending=true;button.disabled=true;
  const canvas=patch.recordCanvas(true),chunks=[];let watch,finish,failed=false,audioTap,stream;
  const previousLoop=LOOPSI;
  const cleanup=()=>{clearInterval(watch);clearTimeout(finish);if(audioTap){try{MST.trim.disconnect(audioTap);}catch(e){}}stream?.getTracks().forEach(t=>t.stop());
    patch.recordCanvas(false);videoRecording=null;videoCapturePending=false;if(PATCH===patch){LOOPSI=previousLoop;paintLoop();}};
  try{
    if(!$('library').hidden||!$('midiView').hidden)go(patch.id);
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    stream=canvas.captureStream(60);
    initAudio();ctx.resume().catch(()=>{});
    audioTap=ctx.createMediaStreamDestination();MST.trim.connect(audioTap);audioTap.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
    const recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:20_000_000,audioBitsPerSecond:192_000});
    const title=patch.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-+$/,'');
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    recorder.onerror=()=>{failed=true;};
    recorder.onstop=()=>{cleanup();button.disabled=false;button.textContent=failed||!chunks.length?'Recording failed · retry':idle;if(failed||!chunks.length)return;
      const type=recorder.mimeType||chunks[0].type||'video/webm',url=URL.createObjectURL(new Blob(chunks,{type})),link=document.createElement('a');
      link.href=url;link.download=title+(canvas.width>canvas.height?'-16x9-':'-9x16-')+Date.now()+(type.startsWith('video/mp4')?'.mp4':'.webm');link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);};
    LOOPSI=null;paintLoop();if(playing)stop();stepIdx=0;patch.reset?.();
    videoRecording={recorder};videoCapturePending=false;button.disabled=false;button.textContent='Stop recording';
    // the patch can hold its opening picture (e.g. the close-up) before the music starts, so the very first frame is that picture
    const frames=n=>new Promise(resolve=>{let k=0;const f=()=>++k>=n?resolve():requestAnimationFrame(f);requestAnimationFrame(f);});
    patch.recordHold?.(true);await frames(4);
    recorder.start(1000);
    await new Promise(resolve=>setTimeout(resolve,patch.recordHold?250:0));patch.recordHold?.(false);start();
    watch=setInterval(()=>{if(playing)return;clearInterval(watch);finish=setTimeout(()=>{if(recorder.state!=='inactive')recorder.stop();},3500);},200);
  }catch(e){cleanup();button.disabled=false;button.textContent='Recording failed · retry';}
}
function patchSettingsText(){
  const channels=[...mixIds(),'rret','dret','vinylNoise','master'];
  const mixer=Object.fromEntries(channels.map(id=>{
    const state=id==='rret'||id==='dret'?returnSettings(id):mixState(id);
    return [id,{...state,label:MIXNAME[id],...(id==='master'?{}:{eq:channelEqState(id)})}];
  }));
  const mutedModules=canvasModules().filter(module=>module.voice&&MUTE[module.voice]).map(module=>module.id);
  return JSON.stringify({
    patch:PATCH.title,
    bpm:PATCH.bpm,
    seed:PATCH.seed,
    mixer,
    masterEffects:mstState(),
    mutedModules,
    overrides:{...HOLDS[PATCH.id]},
    layout:{
      view:VIEW,
      mixerGrid:VIEW==='mixer'&&!WIREMODE,
      frame:document.documentElement.dataset.frame||'fit',
      zoom:ZOOM,
      pan:{x:PAN.x,y:PAN.y},
      modules:{...PATCH.layoutDef?.modules,...MPOS[PATCH.id]},
      video:videoLayouts[PATCH.id]??PATCH.layoutDef?.video??null
    }
  },null,2);
}
{
  const menu=$('menup'),button=$('menub');
  document.body.append(menu);
  menu.hidden=false;
  menu.inert=true;
  const closeMenu=document.createElement('button');
  closeMenu.type='button';
  closeMenu.className='fld menu-close';
  closeMenu.setAttribute('aria-label','Close menu');
  closeMenu.title='Close menu';
  closeMenu.innerHTML='<i data-ic="X" aria-hidden="true">×</i>';
  closeMenu.onclick=()=>setMenu(false);
  menu.prepend(closeMenu);
  $('frameSize').hidden=true;   // App size removed from the menu: the app always fits the window
  for(const id of ['viewseg','pos','bpmgrp','skinb']){
    const control=$(id);
    const row=document.createElement('div');
    row.className='mrow';
    row.innerHTML=`<span>${control.dataset.label}</span>`;
    row.appendChild(control);
    menu.appendChild(row);
  }
  function setMenu(open){
    const hadFocus=menu.contains(document.activeElement);
    menu.inert=!open;
    menu.classList.toggle('open',open);
    button.setAttribute('aria-expanded',String(open));
    if(open)closeMenu.focus();
    else if(hadFocus&&button.getClientRects().length)button.focus();
  }
  const copySettings=document.createElement('button');
  copySettings.type='button';
  copySettings.className='fld';
  copySettings.textContent='Copy patch';
  copySettings.setAttribute('aria-live','polite');
  let copyFeedbackTimer;
  copySettings.onclick=async()=>{
    const settings=patchSettingsText();
    try{
      await navigator.clipboard.writeText(settings);
      copySettings.textContent='Patch copied';
      clearTimeout(copyFeedbackTimer);
      copyFeedbackTimer=setTimeout(()=>{copySettings.textContent='Copy patch';},1800);
    }catch(e){
      window.prompt('Copy patch',settings);
    }
  };
  menu.appendChild(copySettings);
  bindPatchFiles(menu,setMenu);
  const recordButton=document.createElement('button');
  recordButton.type='button';
  recordButton.hidden=true;
  recordButton.className='fld';
  recordButton.dataset.label=recordButton.textContent='Record sequence';
  recordButton.dataset.record='sequence';
  recordButton.setAttribute('aria-live','polite');
  recordButton.onclick=()=>{
    if(!videoRecording){
      setMenu(false);
      startVideoRecording(recordButton);
    }else if(videoRecording.recorder.state!=='inactive'){
      recordButton.disabled=true;
      recordButton.textContent='Saving video…';
      videoRecording.recorder.stop();
    }
  };
  menu.appendChild(recordButton);
  if(typeof PORTABLE_PATCH==='undefined'&&!exportFrame){
    const exportButton=document.createElement('button');
    exportButton.type='button';
    exportButton.className='fld';
    exportButton.textContent='Export MP4 (R)';
    exportButton.onclick=async()=>{
      setMenu(false);
      exportButton.disabled=true;
      try{
        if(PATCH.frameExport){const {showFrameExport}=await import('./frame-export.js?v=1');showFrameExport(PATCH);} // frame by frame at exactly 60 fps
        else{const {showPalindromeExport}=await import('./video-export.js?v=8');
        showPalindromeExport();}
      }catch(error){
        alert('Could not open video export: '+error.message);
      }finally{
        exportButton.disabled=false;
      }
    };
    menu.appendChild(exportButton);
    button.addEventListener('click',()=>{exportButton.hidden=PATCH.id!=='two-ways'&&!PATCH.frameExport;exportButton.textContent='Export MP4 (R)';});
  }
  const allVisuals=document.createElement('button');
  allVisuals.type='button';
  allVisuals.className='fld';
  allVisuals.id='openVisuals';
  allVisuals.textContent='Pop out visuals';
  allVisuals.onclick=()=>{
    if($('patchView').hidden)go(PATCH.id);
    openAllVisuals();
    setMenu(false);
  };
  menu.append(allVisuals,$('midib'));
  const frameSize=$('frameSize');
  frameSize.value=document.documentElement.dataset.frame||'';
  frameSize.onchange=e=>{
    const root=document.documentElement;
    if(e.target.value)root.dataset.frame=e.target.value;else delete root.dataset.frame;
    savedFrame=e.target.value;
    try{localStorage.setItem('ff-app-frame',savedFrame);}catch(e){}
    document.body.scrollTop=0;
    setMenu(false);
    dispatchEvent(new Event('resize'));
    button.focus();
  };
  button.onclick=()=>setMenu(menu.inert);
  menu.addEventListener('click',e=>{
    if(e.target.closest('#skinb,#vSongs,#midib,#viewseg button'))setMenu(false);
  });
  addEventListener('pointerdown',e=>{
    if(!menu.inert&&!e.target.closest('.menuw,#menup,.numtype'))setMenu(false);
  });
  menu.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false);});
}
/* the scene strip scrolls sideways when it doesn't fit (phones swipe it). With a mouse: drag it, or use the wheel. */
{const nav=$('sections');let st=null,moved=false;
  nav.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.button!==0||nav.scrollWidth<=nav.clientWidth)return;st={x:e.clientX,l:nav.scrollLeft};moved=false;});
  addEventListener('pointermove',e=>{if(!st)return;const dx=e.clientX-st.x;if(Math.abs(dx)>4){moved=true;nav.classList.add('dragging');}if(moved)nav.scrollLeft=st.l-dx;});
  addEventListener('pointerup',()=>{if(!st)return;st=null;setTimeout(()=>{moved=false;nav.classList.remove('dragging');},0);});
  nav.addEventListener('click',e=>{if(moved){e.stopPropagation();e.preventDefault();}},true);
  nav.addEventListener('wheel',e=>{if(nav.scrollWidth<=nav.clientWidth||e.ctrlKey)return;const d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;if(!d)return;e.preventDefault();nav.scrollLeft+=d;},{passive:false});}
/* MIDI input. Default controller map:
   pads: notes 36.. (Move drum track in standalone, MIDI send on) or 68.. (Move pads in Control mode) → scene 1, 2, 3 ...
   encoders: CC 71–78 (eight encoders; relative 1/127 or absolute 0–127 both work) → this song's editable
   numbers in order, then 7 = master drive, 8 = master volume. Play: CC 85, or MIDI Start / Stop. Any CC can be
   re-learned per parameter in the panel. */
let MIDI=null,MIDION=false,LEARN=null;let MIDIMAP={};try{MIDIMAP=JSON.parse(localStorage.getItem('ff-midimap')||'{}')||{};}catch(e){}
/* the 8 encoders map themselves to each song: first the song's own maths (its editable numbers), then the level of
   each mixer channel, then mastering (saturate, width, glue) to fill up to six; 7 = master drive, 8 = master volume */
const midiParams=()=>{const L=Object.keys(PATCH.edit||{}).slice(0,3).map(k=>({id:k,name:({'logistic.rn':'logistic r','euclid.kn':'euclid hits k','euclid.nn':'euclid steps n','lfo.cn':'acid cutoff','lfo.rn':'acid resonance','lfo.en':'acid envelope','coh.cn':'cohesion','mut.mn':'mutation','riff.n':'riffles'})[k]||k,kind:'num'}));
  mixIds().forEach(id=>{if(L.length<6)L.push({id:'ch.'+id,ch:id,name:(MIXNAME[id]||id).toLowerCase(),kind:'ch'});});
  [['sat','drv','saturate'],['width','w','width'],['glue','thr','glue'],['eq','lo','low eq'],['eq','hi','high eq']].forEach(([d,k,n])=>{if(L.length<6)L.push({id:'mst.'+d+'.'+k,d,k,name:n,kind:'mst'});});
  L.push({id:'master.drv',name:'master drive',kind:'mix'},{id:'master.vol',name:'master volume',kind:'mix'});return L;};
const mstP=p=>MST_DEV.find(x=>x.id===p.d).p.find(q=>q[0]===p.k);
const ccFor=(p,i)=>{const m=MIDIMAP[PATCH.id];if(m&&m[p.id]!=null)return m[p.id];return p.id==='master.drv'?77:p.id==='master.vol'?78:71+i;};
function midiApply(p,val,rel){if(p.kind==='num'){const e=PATCH.edit[p.id],h=holds()[p.id];const cur=h!=null?h:parseFloat(nodeEls[p.id]?.querySelector('text').textContent)||e.min;
    setHold(p.id,rel!=null?cur+rel*e.step:e.min+(e.max-e.min)*val/127);}
  else if(p.kind==='ch'){const st=mixState(p.ch);st.vol=Math.max(0,Math.min(1.5,rel!=null?st.vol+rel*.015:1.5*val/127));if(ctx&&STR[p.ch])applyStrip(p.ch);saveMix();if(VIEW==='mixer')renderMixer();}
  else if(p.kind==='mst'){const S=mstState(),[,,mn,mx]=mstP(p);S[p.d][p.k]=Math.max(mn,Math.min(mx,rel!=null?S[p.d][p.k]+rel*(mx-mn)/100:mn+(mx-mn)*val/127));MST.apply();saveMix();if(VIEW==='mixer')syncChain();}
  else{const st=mixState('master'),k=p.id.split('.')[1],mx=k==='vol'?1.5:1;st[k]=Math.max(0,Math.min(mx,rel!=null?st[k]+rel*.01*mx:mx*val/127));applyMaster();saveMix();if(VIEW==='mixer')renderMixer();}
  flashMidi();}
let mfT=0;function flashMidi(){const b=$('midib');b.classList.add('rx');clearTimeout(mfT);mfT=setTimeout(()=>b.classList.remove('rx'),80);}
function onMidi(ev){const [st,d1,d2]=ev.data,cmd=st&0xf0;if(nodeEls['move.mi'])flash('move.mi');
  if(cmd===0x90&&d2>0&&nodeEls['move.nt']){flash('move.nt');flash('move.sc');const i=padOf(d1);moveHit('pad',i);moveSay('pad '+(i+1));}
  if(cmd===0xB0&&nodeEls['move.cc']){flash('move.cc');setNum('move.n',String(d2));if(d1===85){flash('move.pl');moveHit('btn','mvplay');}else if(d1===71)flash('move.k1');else if(d1>71&&d1<=78)flash('move.k8');if(d1>=71&&d1<=78)moveHit('knob',d1-71);setTimeout(()=>moveUI(),0);}
  if((st===0xFA||st===0xFC)&&nodeEls['move.pl'])flash('move.pl');
  if(st===0xFA){if(!playing)toggleplay();return;}if(st===0xFC){if(playing)toggleplay();return;}
  if(cmd===0x90&&d2>0){const n=PATCH.sections.length,i=padOf(d1);if(i>=0&&i<n){jumpTo(i);if(!playing)toggleplay();flashMidi();}return;}
  if(cmd!==0xB0)return;
  if(LEARN){const m=MIDIMAP[PATCH.id]||(MIDIMAP[PATCH.id]={});m[LEARN]=d1;LEARN=null;try{localStorage.setItem('ff-midimap',JSON.stringify(MIDIMAP));}catch(e){}renderMidi();return;}
  if(d1===85&&d2>0){toggleplay();return;}
  midiParams().forEach((p,i)=>{if(ccFor(p,i)!==d1)return;
    // Relative encoders use signed steps: 1..63 = up, 65..127 = down. Absolute knobs send any 0..127.
    const rel=(d1>=71&&d1<=79&&(d2<16||d2>112))?(d2<64?d2:d2-128):null;midiApply(p,d2,rel);});}
function renderMidi(){const P=$('midip');if(!P)return;
  if(!MIDION){P.innerHTML=`<p>Connect a MIDI controller by USB, then turn MIDI on.</p><button class="fld" id="midiOn"><i data-ic="Plug">ON</i> MIDI on</button><p class="mut" id="midiErr"></p>`;fillIcons(P);$('midiOn').onclick=midiStart;return;}
  const ins=[...MIDI.inputs.values()].map(x=>x.name);
  P.innerHTML=`<p>${ins.length?'Listening to: '+ins.join(', '):'No MIDI inputs found yet. Connect a MIDI controller by USB.'}</p>
  <h4>Scenes</h4><p class="mut">Pads / notes 36–${35+PATCH.sections.length} (or 68+ on compatible controllers) jump to scene 1–${PATCH.sections.length}. CC 85 or MIDI Start / Stop plays.</p>
  <h4>Encoders</h4><table>${midiParams().map((p,i)=>`<tr><td>${p.name}</td><td>CC ${ccFor(p,i)}</td><td><button class="fld lrn${LEARN===p.id?' on':''}" data-p="${p.id}">${LEARN===p.id?'move a knob…':'learn'}</button></td></tr>`).join('')}</table>`;
  P.querySelectorAll('.lrn').forEach(b=>b.onclick=()=>{LEARN=LEARN===b.dataset.p?null:b.dataset.p;renderMidi();});}
async function midiStart(){const er=$('midiErr');try{if(!navigator.requestMIDIAccess)throw new Error('This browser has no Web MIDI. Try Chrome or Edge.');
    MIDI=await navigator.requestMIDIAccess({sysex:false});const hook=()=>MIDI.inputs.forEach(i=>{i.onmidimessage=onMidi;});hook();MIDI.onstatechange=()=>{hook();renderMidi();};MIDION=true;renderMidi();}
  catch(e){if(er)er.textContent=(e&&e.message)||'MIDI was refused here. Open the page in Chrome directly to use MIDI.';}}
$('midib').onclick=()=>go('midi/'+PATCH.id);
$('midiBack').onclick=()=>{
  if(typeof PORTABLE_PATCH==='undefined'&&history.state?.sonomikaNavigation)history.back();
  else go(PATCH.id);
};
function setSkin(light){if(light)document.documentElement.dataset.skin='light';else delete document.documentElement.dataset.skin;try{localStorage.setItem('ff-skin',light?'light':'dark');}catch(e){}
  const b=$('skinb');b.setAttribute('aria-label',light?'Switch to dark theme':'Switch to light theme');b.innerHTML=`<i data-ic="${light?'Moon':'Sun'}">${light?'DARK':'LIGHT'}</i>`;fillIcons(b);}
$('skinb').onclick=()=>setSkin(document.documentElement.dataset.skin!=='light');
document.addEventListener('keydown',e=>{if(e.target.matches('input,select'))return;
  if((e.key==='r'||e.key==='R')&&!e.ctrlKey&&!e.metaKey){ // R: the 60 fps frame-by-frame export where the patch has it, otherwise record video; works with the top bar hidden
    if(PATCH.frameExport){if(!document.querySelector('dialog.export-dialog[open]'))import('./frame-export.js?v=1').then(m=>m.showFrameExport(PATCH));}
    else document.querySelector('button[data-record="sequence"]')?.click();
  }
  if(e.key==='l'||e.key==='L')toggleLoop();
  if((e.key==='c'||e.key==='C')&&!e.ctrlKey&&!e.metaKey)centerPatch();
  if((e.key==='t'||e.key==='T')&&!e.ctrlKey&&!e.metaKey)setSkin(document.documentElement.dataset.skin!=='light');
  if((e.ctrlKey||e.metaKey)&&(e.key==='='||e.key==='+')){e.preventDefault();setZoom(ZOOM*1.2);}
  if((e.ctrlKey||e.metaKey)&&e.key==='-'){e.preventDefault();setZoom(ZOOM/1.2);}
  if((e.ctrlKey||e.metaKey)&&e.key==='0'){e.preventDefault();setZoom(1);}});
// zoom around the pointer: in WIRES the plain mouse wheel zooms (Shift + wheel or a
// sideways swipe pans instead); trackpad pinch (ctrl + wheel) and two-finger pinch zoom in both patch views
['wires','patch'].forEach(id=>{const el=$(id);
  el.addEventListener('wheel',e=>{const side=Math.abs(e.deltaX)>Math.abs(e.deltaY);if(!e.ctrlKey&&(id!=='wires'||e.shiftKey||side))return;e.preventDefault();
    const dy=e.deltaY*(e.deltaMode===1?33:e.deltaMode===2?400:1),r=el.getBoundingClientRect();setZoom(ZOOM*Math.exp(-dy*(e.ctrlKey?.01:.0015)),e.clientX-r.left,e.clientY);},{passive:false});
  const pts=new Map();let d0=0,z0=1;
  el.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;pts.set(e.pointerId,[e.clientX,e.clientY]);if(pts.size===2){const [a,b]=[...pts.values()];d0=Math.hypot(a[0]-b[0],a[1]-b[1]);z0=ZOOM;}});
  el.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,[e.clientX,e.clientY]);if(pts.size===2&&d0&&!WINDRAG){const [a,b]=[...pts.values()],r=el.getBoundingClientRect();
    setZoom(z0*Math.hypot(a[0]-b[0],a[1]-b[1])/d0,(a[0]+b[0])/2-r.left,(a[1]+b[1])/2);}});
  const end=e=>{pts.delete(e.pointerId);if(pts.size<2)d0=0;};el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);});
$('play').onclick=()=>{toggleplay();};
$('stopb').onclick=()=>{stop();stepIdx=0;PATCH.reset&&PATCH.reset();uiStep(0,0,0,PATCH.sections[0],[]);};
$('reseed').onclick=()=>{$('seedv').textContent=PATCH.reseed();};fillIcons();setSkin(document.documentElement.dataset.skin==='light');
$('bpm').onchange=e=>{if(PATCH.stepSeconds)return;PATCH.bpm=Math.max(100,Math.min(150,+e.target.value||PATCH.bpm));e.target.value=PATCH.bpm;paintTransportTime();renderList();if(SEL)renderDetail();};
document.addEventListener('keydown',e=>{if(e.code!=='Space'||!(e.target===document.body||e.target.classList.contains('row')||e.target.closest('.wires')))return;e.preventDefault();
  if(!panMode()){if(!e.repeat)toggleplay();return;}if(!SPACE){SPACE=true;SPACED=false;$('wires').classList.add('grab');}});
document.addEventListener('keyup',e=>{if(e.code!=='Space'||!SPACE)return;SPACE=false;$('wires').classList.remove('grab');if(!SPACED)toggleplay();});
// Drag the empty canvas or hold Space to pan. Ctrl + wheel zooms.
{const host=$('wires');
  host.addEventListener('pointerdown',e=>{if(!WIREMODE||e.button>1)return;const onWin=e.target.closest('.wwin,.wmod');if(onWin&&!SPACE&&e.button!==1)return;
    if(e.pointerType==='touch'&&e.isPrimary===false)return;
    e.preventDefault();e.stopPropagation();SPACED=true;const pm=panMode(),st={x:e.clientX,y:e.clientY,px:PAN.x,py:PAN.y,sl:host.scrollLeft,sy:scrollY};host.classList.add('panning');
    const mv=ev=>{if(pm){PAN.x=st.px+(ev.clientX-st.x)/frameScale();PAN.y=st.py+(ev.clientY-st.y)/frameScale();applyPan();}else{host.scrollLeft=st.sl-(ev.clientX-st.x);scrollTo(scrollX,st.sy-(ev.clientY-st.y));}};
    const up=()=>{host.classList.remove('panning');removeEventListener('pointermove',mv);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);};
    addEventListener('pointermove',mv);addEventListener('pointerup',up);addEventListener('pointercancel',up);},true);
  host.addEventListener('wheel',e=>{const side=Math.abs(e.deltaX)>Math.abs(e.deltaY);if(e.ctrlKey||!(e.shiftKey||side))return;e.preventDefault();
    // Shift + wheel pans sideways (Windows sends it as vertical delta); a sideways swipe pans as it goes
    const dx=e.shiftKey&&!side?e.deltaY:e.deltaX,dy=e.shiftKey&&!side?0:e.deltaY;if(panMode()){PAN.x-=dx/frameScale();PAN.y-=dy/frameScale();applyPan();}else{host.scrollLeft+=dx;scrollBy(0,dy);}},{passive:false});}
window.addEventListener('hashchange',route);
window.addEventListener('popstate',route);
if(typeof PORTABLE_PATCH!=='undefined'){
  const bundledPatch=PATCHES.find(p=>p.id===PORTABLE_PATCH.patchId);
  PATCHES.splice(0,PATCHES.length,bundledPatch);
  applyPatchSnapshot(JSON.stringify(PORTABLE_PATCH));
}else{
const initialRoute=pageRoute();
loadPatch(PATCHES.find(p=>p.id===initialRoute.replace(/^((?:songs|midi)\/)|-(wires|patch|mixer)$/g,''))||P1);
SEL=PATCH;renderList();renderDetail();
if(location.hash)go(initialRoute,true);else route();
}
scopeLoop();visLoop();meterLoop();
if(exportFrame){
  window.preparePalindromeVideo=(...args)=>import('./video-export.js?v=8')
    .then(({preparePalindromeVideo})=>preparePalindromeVideo(...args));
}
