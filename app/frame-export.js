// Frame-by-frame MP4 export for patches that offer patch.frameExport (the drummer family).
// Pass 1 plays the piece once in real time and captures the master output sample by sample, logging when every step was scheduled.
// Pass 2 replays those steps silently against a stand-in clock and draws the picture at exactly 1/60 s intervals, however long
// each frame takes, then muxes the frames and the captured sound into an MP4 (H.264 + AAC).
const FPS=60,TAIL=3.5;

export function showFrameExport(patch){
  const dialog=document.createElement('dialog');
  dialog.className='export-dialog';
  dialog.setAttribute('aria-labelledby','fexport-title');
  dialog.innerHTML=`
    <form method="dialog">
      <h2 id="fexport-title">Export MP4 · 60 fps</h2>
      <p role="status">Getting ready…</p>
      <progress aria-label="Export progress" max="1" value="0"></progress>
      <div class="export-actions"><button class="fld">Cancel</button><a class="fld on" hidden>Download MP4</a></div>
    </form>`;
  const status=dialog.querySelector('[role="status"]'),progress=dialog.querySelector('progress'),link=dialog.querySelector('a'),button=dialog.querySelector('button');
  const controller=new AbortController();let url;
  dialog.addEventListener('close',()=>{controller.abort();if(url)setTimeout(()=>URL.revokeObjectURL(url),1000);dialog.remove();},{once:true});
  document.body.append(dialog);dialog.showModal();
  renderFrames(patch,controller.signal,(phase,f)=>{progress.value=f;status.textContent=phase;}).then(({blob,name})=>{
    if(controller.signal.aborted)return;
    url=URL.createObjectURL(blob);link.href=url;link.download=name;progress.hidden=true;link.hidden=false;status.textContent='Your video is ready.';
  }).catch(error=>{
    if(controller.signal.aborted)return;
    console.error('Frame export failed',error);status.textContent=error.message||'Video export failed.';progress.hidden=true;
  }).finally(()=>{button.textContent='Close';});
}

const RECORDER=`class R extends AudioWorkletProcessor{constructor(){super();this.L=[];this.R=[];this.n=0;this.first=-1;this.on=true;
  this.port.onmessage=e=>{if(e.data==='stop'){this.flush();this.on=false;this.port.postMessage({done:true});}};}
  process(inputs){if(!this.on)return false;const i=inputs[0]||[];if(this.first<0)this.first=currentFrame;const l=i[0]||new Float32Array(128),r=i[1]||l;
    this.L.push(l.slice());this.R.push(r.slice());if(++this.n>=64)this.flush();return true;}
  flush(){if(!this.n)return;this.port.postMessage({first:this.first,L:this.L,R:this.R});this.L=[];this.R=[];this.n=0;}}
registerProcessor('sp-frame-recorder',R);`;

// a stand-in for any audio node or parameter: every property is itself, every call returns itself, every assignment is ignored
const NODE=new Proxy(function(){},{get:(o,k)=>k===Symbol.toPrimitive?()=>0:k==='value'?0:NODE,set:()=>true,apply:()=>NODE});
const MAKERS=['createBufferSource','createGain','createBiquadFilter','createOscillator','createStereoPanner','createWaveShaper','createDelay','createConvolver','createDynamicsCompressor','createConstantSource','createPanner'];

async function renderFrames(patch,signal,report){
  if(!window.VideoEncoder||!window.AudioEncoder||!window.AudioWorkletNode)throw new Error('This browser cannot encode MP4 video and audio.');
  const {Output,Mp4OutputFormat,BufferTarget,CanvasSource,AudioBufferSource,canEncodeVideo,canEncodeAudio}=await import('https://cdn.jsdelivr.net/npm/mediabunny@1.65.2/+esm');
  initAudio();await ctx.resume();
  const sr=ctx.sampleRate,FX=patch.frameExport;
  const previousLoop=LOOPSI;LOOPSI=null;paintLoop();if(playing)stop();

  /* ---------- pass 1: the sound, in real time ---------- */
  report('Recording the sound · 0%',0);
  await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([RECORDER],{type:'text/javascript'})));
  const rec=new AudioWorkletNode(ctx,'sp-frame-recorder',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCount:2,channelCountMode:'explicit'}),sink=ctx.createGain();sink.gain.value=0;
  const chunks=[];let first=-1,doneRec;const recDone=new Promise(r=>doneRec=r);
  rec.port.onmessage=e=>{if(e.data.done){doneRec();return;}if(first<0)first=e.data.first;chunks.push(e.data);};
  const log=[],play=patch.play;patch.play=(t,bar,s,S,ui)=>{log.push([t,bar,s,S]);play(t,bar,s,S,ui);};
  let captured;
  try{
    MST.trim.connect(rec);rec.connect(sink);sink.connect(ctx.destination);
    FX.begin(); // no drawing while the sound is captured, so nothing can stutter
    stepIdx=0;patch.reset?.();start();
    const total=TOTAL_BARS*16*sd()+TAIL;const t0=performance.now();
    while(playing){signal.throwIfAborted();report(`Recording the sound · ${Math.min(99,Math.floor((performance.now()-t0)/1000/total*100))}%`,Math.min(.5,(performance.now()-t0)/1000/total*.5));await new Promise(r=>setTimeout(r,200));}
    for(const end=performance.now()+TAIL*1000;performance.now()<end;){signal.throwIfAborted();await new Promise(r=>setTimeout(r,200));}
    rec.port.postMessage('stop');await recDone;
    if(!log.length)throw new Error('Nothing was played.');
    // the sound from the first step on
    const T0=log[0][0],dur=log.at(-1)[0]-T0+sd()+TAIL,len=Math.round(dur*sr),off=Math.round(T0*sr)-first;
    captured=new AudioBuffer({numberOfChannels:2,length:len,sampleRate:sr});const L=new Float32Array(len),R=new Float32Array(len);let pos=0;
    for(const c of chunks)for(let k=0;k<c.L.length;k++){const a=c.L[k],b=c.R[k];for(let j=0;j<a.length;j++,pos++){const d=pos-off;if(d>=0&&d<len){L[d]=a[j];R[d]=b[j];}}}
    captured.copyToChannel(L,0);captured.copyToChannel(R,1);captured.T0=T0;captured.dur=dur;
  }finally{
    patch.play=play;try{MST.trim.disconnect(rec);}catch(e){}rec.disconnect();sink.disconnect();if(playing)stop();
  }
  signal.throwIfAborted();

  /* ---------- pass 2: the picture, frame by frame ---------- */
  const canvas=patch.recordCanvas(true),width=canvas.width,height=canvas.height;
  const videoOptions={width,height,bitrate:40e6},audioOptions={numberOfChannels:2,sampleRate:sr,bitrate:192000};
  const vOK=await canEncodeVideo('avc',videoOptions),acodec=await canEncodeAudio('aac',audioOptions)?'aac':await canEncodeAudio('opus',audioOptions)?'opus':null; // AAC, or Opus where AAC is missing
  if(!vOK||!acodec){patch.recordCanvas(false);FX.end();throw new Error('This browser cannot encode H.264 video with AAC or Opus audio at this size.');}
  // a silent replay: the clock is ours, and every new audio node is a stand-in, so the scheduled sounds are drawn but not heard
  let vnow=captured.T0;MAKERS.forEach(m=>{ctx[m]=()=>NODE;});
  Object.defineProperty(ctx,'currentTime',{get:()=>vnow,configurable:true});Object.defineProperty(ctx,'outputLatency',{get:()=>0,configurable:true});
  let output;
  try{
    patch.reset?.();
    const target=new BufferTarget();output=new Output({format:new Mp4OutputFormat(),target});
    const video=new CanvasSource(canvas,{codec:'avc',bitrate:videoOptions.bitrate,latencyMode:'quality'}),sound=new AudioBufferSource({codec:acodec,bitrate:audioOptions.bitrate});
    output.addVideoTrack(video,{frameRate:FPS});output.addAudioTrack(sound);await output.start();
    let audioError;const audioTask=sound.add(captured).then(()=>sound.close());audioTask.catch(e=>{audioError=e;});
    const frames=Math.round(captured.dur*FPS);let next=0;
    for(let i=0;i<frames;i++){
      signal.throwIfAborted();if(audioError)throw audioError;
      vnow=captured.T0+i/FPS;
      while(next<log.length&&log[next][0]<=vnow+.12){const [t,bar,s,S]=log[next++];play(t,bar,s,S,[]);} // the steps, scheduled just ahead as they were live
      FX.frame(vnow);
      await video.add(i/FPS,1/FPS);
      if(i%15===0){report(`Rendering the picture · ${Math.floor(i/frames*100)}% · frame ${i} of ${frames}`,.5+.5*i/frames);await new Promise(r=>setTimeout(r,0));}
    }
    video.close();await audioTask;report('Finishing MP4…',1);await output.finalize();
    const title=patch.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-+$/,'');
    return {blob:new Blob([target.buffer],{type:'video/mp4'}),name:`${title}-${width>height?'16x9':'9x16'}-60fps-${Date.now()}.mp4`};
  }finally{
    MAKERS.forEach(m=>{delete ctx[m];});delete ctx.currentTime;delete ctx.outputLatency;
    patch.recordCanvas(false);FX.end();patch.reset?.();stepIdx=0;LOOPSI=previousLoop;paintLoop();
    if(output?.state==='started')await output.cancel();
  }
}
