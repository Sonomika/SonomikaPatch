const fps=30;

export function showPalindromeExport(){
  const root=document.documentElement;
  const frame=root.dataset.frame;
  const layout={
    frame,
    width:frame?document.body.offsetWidth:document.documentElement.clientWidth,
    height:frame?document.body.offsetHeight:window.innerHeight,
    topScale:root.style.getPropertyValue('--top-ui-scale'),
    compact:root.hasAttribute('data-compact-frame'),
    skin:root.dataset.skin,
    wires:WIREMODE,
    scroll:frame?document.body.scrollTop:window.scrollY,
    sceneScroll:$('sections').scrollLeft,
    zoom:ZOOM,
    pan:{...PAN},
    modules:structuredClone(MPOS[P12.id]),
    room:structuredClone(videoLayouts['two-ways:room'])
  };
  const scale=Math.min(1080/Math.min(layout.width,layout.height),1920/Math.max(layout.width,layout.height));
  const width=Math.max(2,2*Math.round(layout.width*scale/2));
  const height=Math.max(2,2*Math.round(layout.height*scale/2));
  const dialog=document.createElement('dialog');
  dialog.className='export-dialog';
  dialog.setAttribute('aria-labelledby','export-title');
  dialog.innerHTML=`
    <form method="dialog">
      <h2 id="export-title">Export Video</h2>
      <p role="status">Preparing ${width} × ${height} video…</p>
      <progress aria-label="Video export progress" max="1"></progress>
      <div class="export-actions"><button class="fld">Cancel</button><a class="fld on" hidden>Download MP4</a></div>
    </form>`;
  const status=dialog.querySelector('[role="status"]');
  const progress=dialog.querySelector('progress');
  const link=dialog.querySelector('a');
  const button=dialog.querySelector('button');
  const controller=new AbortController();
  let url;
  dialog.addEventListener('close',()=>{
    controller.abort();
    if(url)setTimeout(()=>URL.revokeObjectURL(url),1000);
    dialog.remove();
  },{once:true});
  document.body.append(dialog);
  dialog.showModal();
  renderPalindrome(layout,{width,height},controller.signal,(done,total)=>{
    progress.value=done/total;
    status.textContent=done===total?'Finishing MP4…':`Rendering video · ${Math.floor(done/total*100)}%`;
  }).then(blob=>{
    if(controller.signal.aborted)return;
    url=URL.createObjectURL(blob);
    link.href=url;
    link.download=`palindrome-${width}x${height}.mp4`;
    progress.hidden=true;
    link.hidden=false;
    status.textContent='Your video is ready.';
  }).catch(error=>{
    if(controller.signal.aborted)return;
    console.error('Palindrome export failed',error);
    status.textContent=error.message||'Video export failed.';
    progress.hidden=true;
  }).finally(()=>{button.textContent='Close';});
}

async function renderPalindrome(layout,{width,height},signal,report){
  if(!window.VideoEncoder||!window.AudioEncoder){
    throw new Error('This browser cannot encode MP4 video and audio.');
  }
  const {
    Output,Mp4OutputFormat,BufferTarget,CanvasSource,AudioBufferSource,canEncodeVideo,canEncodeAudio
  }=await import('https://cdn.jsdelivr.net/npm/mediabunny@1.65.2/+esm');
  const videoOptions={width,height,bitrate:20e6};
  const audioOptions={numberOfChannels:2,sampleRate:44100,bitrate:192000};
  const [videoSupported,audioSupported]=await Promise.all([
    canEncodeVideo('avc',videoOptions),canEncodeAudio('aac',audioOptions)
  ]);
  if(!videoSupported||!audioSupported){
    throw new Error('This browser cannot encode H.264 video and AAC audio.');
  }
  signal.throwIfAborted();
  const frame=document.createElement('iframe');
  frame.title='Palindrome export renderer';
  frame.setAttribute('aria-hidden','true');
  frame.tabIndex=-1;
  Object.assign(frame.style,{
    position:'fixed',inset:'0 auto auto 0',width:layout.width+'px',height:layout.height+'px',
    opacity:'0',pointerEvents:'none',border:'0'
  });
  frame.src=`?view=${layout.wires?'patch':'grid'}&patch=two-ways&render-video`;
  const loaded=new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));
  document.body.append(frame);
  let output;
  try{
    await loaded;
    signal.throwIfAborted();
    const prepare=frame.contentWindow.preparePalindromeVideo;
    if(!prepare)throw new Error('Could not open the patch for export.');
    const {tape,duration,paint}=await prepare(signal,layout,width/layout.width);
    const audio=new AudioBuffer({...audioOptions,length:Math.round(duration*audioOptions.sampleRate)});
    for(let channel=0;channel<audio.numberOfChannels;channel++){
      audio.copyToChannel(tape.getChannelData(Math.min(channel,tape.numberOfChannels-1)).subarray(0,audio.length),channel);
    }
    const canvas=document.createElement('canvas');
    canvas.width=width;
    canvas.height=height;
    const context=canvas.getContext('2d',{alpha:false});
    context.scale(width/layout.width,height/layout.height);
    const target=new BufferTarget();
    output=new Output({format:new Mp4OutputFormat(),target});
    const video=new CanvasSource(canvas,{codec:'avc',bitrate:videoOptions.bitrate});
    const soundtrack=new AudioBufferSource({codec:'aac',bitrate:audioOptions.bitrate});
    output.addVideoTrack(video,{frameRate:fps});
    output.addAudioTrack(soundtrack);
    await output.start();
    const total=Math.round(duration*fps);
    // Queue audio alongside video so neither track has to buffer the entire export.
    const audioTask=soundtrack.add(audio).then(()=>soundtrack.close());
    let audioError;
    audioTask.catch(error=>{audioError=error;});
    for(let index=0;index<total;index++){
      signal.throwIfAborted();
      if(audioError)throw audioError;
      paint(context,index/fps);
      await video.add(index/fps,1/fps);
      if(index%10===0){
        report(index,total);
        await new Promise(resolve=>setTimeout(resolve,0));
      }
    }
    video.close();
    await audioTask;
    signal.throwIfAborted();
    report(total,total);
    await output.finalize();
    return new Blob([target.buffer],{type:'video/mp4'});
  }finally{
    frame.remove();
    if(output?.state==='started')await output.cancel();
  }
}

// Runs inside a separate copy of the patch so the live transport and layout are untouched.
export async function preparePalindromeVideo(signal,layout,pixelRatio){
  const {toCanvas}=await import('https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/+esm');
  await Promise.all([twLoad(),document.fonts.ready]);
  if(!TW.buf)throw new Error('Could not load the Palindrome soundtrack.');
  for(let attempt=0;!window.TW_ROOM&&attempt<100;attempt++){
    signal.throwIfAborted();
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(!window.TW_ROOM)throw new Error('Could not load the 3D room.');
  signal.throwIfAborted();

  const root=document.documentElement;
  if(layout.frame)root.dataset.frame=layout.frame;
  else delete root.dataset.frame;
  if(layout.skin)root.dataset.skin=layout.skin;
  else delete root.dataset.skin;
  // Let the frame observer run before restoring the live header's scale.
  await Promise.resolve();
  updateFrameScale();
  root.style.setProperty('--top-ui-scale',layout.topScale);
  root.toggleAttribute('data-compact-frame',layout.compact);
  root.style.overflow='hidden';
  document.body.style.overflow='hidden';
  root.style.scrollbarWidth='none';
  document.body.style.scrollbarWidth='none';
  TW.mode='fwd';
  TW.dir=1;
  TW.speed=1;
  P12.stepSeconds=undefined;
  MPOS[P12.id]=layout.modules;
  videoLayouts['two-ways:room']=layout.room;
  ZOOM=layout.zoom;
  root.style.setProperty('--mz',ZOOM);
  $('zVal').textContent=Math.round(ZOOM*100)+'%';
  Object.assign(PAN,layout.pan);
  renderPatch();
  // Capture scrolled content at its viewport position while keeping sticky controls in place.
  if(layout.scroll){
    const content=$('patchView');
    content.style.position='relative';
    content.style.top=-layout.scroll+'px';
  }
  $('sections').scrollLeft=layout.sceneScroll;
  paintTransportTime(0);
  // SVG snapshots do not carry the app stylesheet. Resolve themed paint before
  // cloning so SVG's default black fill cannot replace module and cable colors.
  const svgPaint=['fill','fill-opacity','stroke','stroke-width','stroke-opacity',
    'stroke-dasharray','stroke-linecap','stroke-linejoin','opacity',
    'font-family','font-size','font-weight','letter-spacing','text-anchor'];
  for(const node of document.querySelectorAll('#patchView svg, #patchView svg *')){
    if(node.namespaceURI!=='http://www.w3.org/2000/svg')continue;
    const computed=getComputedStyle(node);
    const values=svgPaint.map(property=>computed.getPropertyValue(property));
    for(const [index,property] of svgPaint.entries()){
      if(!values[index])continue;
      node.setAttribute(property,values[index]);
      node.style.setProperty(property,values[index]);
    }
  }
  const room=TW.views[0].canvas;
  const deck=TW.deck.canvas;
  TW_ROOM.draw(room,0);
  if(TW_ROOM.err)throw new Error('The browser could not render the 3D room.');
  twDrawDeck(TW.deck,0,1);
  const surfaces=[room,deck].map(canvas=>({canvas,rect:canvas.getBoundingClientRect()}));
  const elapsed=$('elapsedTime');
  const elapsedRect=elapsed.getBoundingClientRect();
  const elapsedStyle=getComputedStyle(elapsed);
  const timeColor=elapsedStyle.color;
  const timeFont=`400 ${elapsedStyle.fontSize} ${elapsedStyle.fontFamily}`;
  const strip=$('sceneStrip');
  const buttons=[...$('sections').querySelectorAll('.sec')];
  let start=0;
  const scenes=[];
  const snapshotOptions={pixelRatio,skipFonts:true,width:layout.width,height:layout.height};
  const background=getComputedStyle(document.body).backgroundColor;
  elapsed.style.visibility='hidden';
  const selectScene=index=>buttons.forEach((button,i)=>button.classList.toggle('now',i===index));
  const filter=node=>!['SCRIPT','LINK','CANVAS'].includes(node.tagName)&&!node.hidden;
  const view=layout.wires?$('wires'):$('patchView');
  const viewRect=view.getBoundingClientRect();
  const topbar=document.querySelector('.topbar').getBoundingClientRect();
  const clipTop=Math.max(viewRect.top,topbar.bottom,strip.getBoundingClientRect().bottom);
  for(const [index,section] of P12.sections.entries()){
    signal.throwIfAborted();
    selectScene(index);
    const button=buttons[index];
    const rect=button.getBoundingClientRect();
    const color=getComputedStyle(button).color;
    const duration=section.bars*16*TW_SD;
    const still=await toCanvas(document.body,{
      ...snapshotOptions,backgroundColor:background,filter,
      style:{overflow:'hidden',scrollbarWidth:'none'}
    });
    scenes.push({start,end:start+duration,duration,rect,color,still});
    start+=duration;
  }
  const duration=start;
  return {tape:TW.buf,duration,paint(context,time){
    const scene=scenes.find(item=>time<item.end)??scenes.at(-1);
    context.drawImage(scene.still,0,0,layout.width,layout.height);
    context.save();
    context.beginPath();
    context.rect(viewRect.left,clipTop,viewRect.width,Math.max(0,viewRect.bottom-clipTop));
    context.clip();
    TW_ROOM.draw(room,time);
    twDrawDeck(TW.deck,time,1);
    for(const {canvas,rect} of surfaces){
      context.drawImage(canvas,rect.x,rect.y,rect.width,rect.height);
    }
    context.restore();
    context.fillStyle=scene.color;
    context.fillRect(scene.rect.x+1,scene.rect.bottom-3,(scene.rect.width-2)*(time-scene.start)/scene.duration,2);
    context.fillStyle=timeColor;
    context.font=timeFont;
    context.textBaseline='middle';
    const seconds=Math.floor(time);
    context.fillText(`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`,
      elapsedRect.x,elapsedRect.y+elapsedRect.height/2);
  }};
}
