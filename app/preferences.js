const {dataset}=document.documentElement;
dataset.skin='light';
const exportFrame=window.parent!==window&&new URLSearchParams(location.search).has('render-video');
try {
  if(localStorage.getItem('ff-skin')==='dark')delete dataset.skin;
  localStorage.removeItem('ff-app-frame');   // the App size option is gone: the app always fits the window
} catch(e) {}

function updateFrameScale(){
  const root=document.documentElement;
  const frame=root.dataset.frame;
  const viewportHeight=window.visualViewport?.height??innerHeight;
  const portrait=frame==='portrait';
  const frameWidth=portrait?720:1280;
  const scale=frame?Math.min(innerWidth/frameWidth,viewportHeight/(portrait?1280:720)):1;
  root.style.setProperty('--frame-scale',scale);
  root.style.setProperty('--top-ui-scale',1/scale);
  root.toggleAttribute('data-compact-frame',Boolean(frame)&&frameWidth*scale<=440);
}
const frameScale=()=>document.documentElement.dataset.frame
  ? document.body.getBoundingClientRect().width/document.body.offsetWidth || 1
  : 1;
new MutationObserver(updateFrameScale).observe(document.documentElement,{attributes:true,attributeFilter:['data-frame']});
addEventListener('resize',updateFrameScale);
updateFrameScale();
