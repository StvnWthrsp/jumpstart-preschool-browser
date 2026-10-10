import {PlayEngine,decodeBank,viewOf} from './engine.js';
import {decodeADP} from './audio.js';

const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d'),status=document.querySelector('#status'),video=document.querySelector('#movie');
const start=document.querySelector('#start'),skip=document.querySelector('#skip'),selector=document.querySelector('#bank');
const images=new Map(),audioBuffers=new WeakMap(),soundChannels=new Map();
const tintedFonts=new Map();
let engine,audio,running=false,failed=false;
const names={1:'Balloon cart',2:'Paper activities',3:'Painting easel',4:'Puzzles',5:'Sorting bins',6:'Bookshelf',7:'Mouse house',8:'Puppet theatre',9:'Kitchen',10:'Bird nests',11:'School entrance',12:'Classroom',14:'Activity frame',99:'Startup',200:'Sign-in',201:'Records',202:'Time machine',203:'Parent screen',204:'Reward land',301:'Additional resources'};
function report(error){failed=true;running=false;status.textContent=`Runtime stopped: ${error.message}`;console.error(error);document.querySelector('#trace').textContent=JSON.stringify(engine?.trace.slice(-25),null,2);}
function imageFor(sprite){if(sprite.surface){const surface=sprite.surface;surface.canvas ||= new OffscreenCanvas(surface.width,surface.height);const context=surface.canvas.getContext('2d');context.clearRect(0,0,surface.width,surface.height);for(const draw of surface.draws){const image=imageFor(draw);if(image.complete&&image.naturalWidth)context.drawImage(image,draw.x,draw.y,draw.width*draw.scale,draw.height*draw.scale);}return surface.canvas;}const url=`assets/${sprite.bank}/${sprite.file}.png`;if(!images.has(url)){const image=new Image();image.onload=render;image.onerror=()=>report(new Error(`Could not load ${url}`));image.src=url;images.set(url,image);}return images.get(url);}
function frameReady(){
  let ready=true;
  function check(sprite){
    if(sprite.surface){for(const draw of sprite.surface.draws)check(draw);return;}
    const image=imageFor(sprite);if(!image.complete||!image.naturalWidth)ready=false;
  }
  if(engine.background)check(engine.background);
  for(const sprite of engine.sprites.values()){check(sprite);if(sprite.restore)check({bank:sprite.bank,file:sprite.restore});}
  for(const sprite of engine.textSprites.values())for(const run of sprite.runs||[{font:sprite.font}])if(run.font)check({bank:'fonts',file:run.font.digest});
  if(engine.cursor&&!engine.cursorHidden){const cursor=engine.find('BMAP',engine.cursor);if(cursor)check({bank:cursor.bank.bank,file:cursor.value.file||cursor.id});}
  return ready;
}
function render(){if(!engine||!frameReady())return;ctx.clearRect(0,0,640,480);ctx.fillStyle='#000';ctx.fillRect(0,0,640,480);if(engine.background){const image=imageFor(engine.background);if(image.complete&&image.naturalWidth)ctx.drawImage(image,0,0);}for(const s of [...engine.sprites.values()].sort((a,b)=>b.z-a.z)){restoreBackground(s);const image=imageFor(s);if(s.surface||image.complete&&image.naturalWidth)ctx.drawImage(image,s.x,s.y,s.displayWidth??s.width,s.displayHeight??s.height);}
  for(const sprite of engine.textSprites.values())drawText(sprite);
  if(engine.brightness!==undefined&&engine.brightness<1){ctx.fillStyle=`rgba(0,0,0,${1-engine.brightness})`;ctx.fillRect(0,0,640,480);}
  const cursor=engine.cursor&&!engine.cursorHidden?engine.find('BMAP',engine.cursor):null;
  canvas.style.cursor=engine.cursorHidden||cursor?'none':engine.hover?'pointer':'default';
  if(cursor&&engine.mouse){const image=imageFor({bank:cursor.bank.bank,file:cursor.value.file||cursor.id});if(image.complete&&image.naturalWidth)ctx.drawImage(image,engine.mouse.x-(engine.cursorHotspot?.x||0),engine.mouse.y-(engine.cursorHotspot?.y||0));}
  document.querySelector('#classroom').hidden=!((engine.bank.id>=1&&engine.bank.id<=10)||(engine.bank.id>=201&&engine.bank.id<=204));
  if(!failed)status.textContent=names[engine.bank.id]||'JumpStart Preschool';
}
function restoreBackground(sprite){
  if(!sprite.restore||!engine.background)return;
  const mask=imageFor({bank:sprite.bank,file:sprite.restore}),background=imageFor(engine.background);
  if(!mask.complete||!mask.naturalWidth||!background.complete||!background.naturalWidth)return;
  const width=sprite.displayWidth??sprite.width,height=sprite.displayHeight??sprite.height;
  const layer=new OffscreenCanvas(width,height),c=layer.getContext('2d');
  c.drawImage(background,sprite.x,sprite.y,width,height,0,0,width,height);
  c.globalCompositeOperation='destination-in';c.drawImage(mask,0,0,width,height);
  ctx.drawImage(layer,sprite.x,sprite.y);
}
function fontImage(font,color){const atlas=imageFor({bank:'fonts',file:font.digest});if(!atlas.complete||!atlas.naturalWidth)return null;if(color===undefined||!font.palette)return atlas;const key=`${font.digest}:${color}`;if(!tintedFonts.has(key)){const out=new OffscreenCanvas(atlas.width,atlas.height),c=out.getContext('2d');c.drawImage(atlas,0,0);c.globalCompositeOperation='source-in';c.fillStyle=`rgb(${font.palette.slice(color*3,color*3+3).join(',')})`;c.fillRect(0,0,out.width,out.height);tintedFonts.set(key,out);}return tintedFonts.get(key);}
function drawText(sprite){
  const runs=sprite.runs||[{text:sprite.text,font:sprite.font}],lines=[[]];let width=0;
  for(const run of runs)for(const char of run.text){const glyph=run.font?.glyphs[char.charCodeAt(0)],advance=glyph?.advance||12;if(char==='\n'||width+advance>sprite.width){lines.push([]);width=0;if(char==='\n')continue;}lines.at(-1).push({char,glyph,font:run.font,color:run.color,advance});width+=advance;}
  ctx.save();ctx.beginPath();ctx.rect(sprite.x,sprite.y,sprite.width,sprite.height);ctx.clip();let y=sprite.y+(sprite.offsetY||0);
  for(const line of lines){const lineWidth=line.reduce((sum,c)=>sum+c.advance,0),height=Math.max(sprite.font?.height||24,...line.map(c=>c.font?.height||24));let x=sprite.x+(sprite.offsetX||0)+(sprite.alignment===2?sprite.width-lineWidth:sprite.alignment?(sprite.width-lineWidth)/2:0);y+=height;
    for(const c of line){if(c.glyph&&c.font){const atlas=fontImage(c.font,c.color),g=c.glyph;if(atlas)ctx.drawImage(atlas,g.x,g.y,g.width,g.height,x+g.left,y+g.baseline-g.height,g.width,g.height);}else if(!c.font){ctx.fillStyle='#222';ctx.font='24px sans-serif';ctx.fillText(c.char,x,y);}x+=c.advance;}
  }ctx.restore();
}
function finishMovie(){const id=engine.movie;video.pause();video.style.display='none';skip.hidden=true;engine.movie=0;canvas.focus({preventScroll:true});try{if(id)engine.event(31,[id]);render();}catch(e){report(e);}}
video.addEventListener('ended',finishMovie);skip.onclick=finishMovie;
function configure(){engine.fontData=fontData;engine.profiles.records=JSON.parse(localStorage.getItem('preschool-profiles')||'{}');engine.profiles.changed=records=>localStorage.setItem('preschool-profiles',JSON.stringify(records));engine.playSound=(id,channel)=>{const bytes=engine.resource('WAVE',id);if(!bytes||!audio||soundChannels.has(channel))return;try{if(!audioBuffers.has(bytes)){const decoded=decodeADP(bytes),buffer=audio.createBuffer(decoded.channels,decoded.samples[0].length,decoded.rate);decoded.samples.forEach((s,c)=>buffer.copyToChannel(s,c));audioBuffers.set(bytes,buffer);}const source=audio.createBufferSource();source.buffer=audioBuffers.get(bytes);source.connect(audio.destination);soundChannels.set(channel,{id,source});source.onended=()=>{if(soundChannels.get(channel)?.source===source)soundChannels.delete(channel);};source.start();}catch(e){report(e);}};
  engine.stopSound=id=>{for(const [channel,sound]of soundChannels)if(!id||sound.id===id){sound.source.stop();soundChannels.delete(channel);}};
  engine.stopMovie=()=>{video.pause();video.style.display='none';skip.hidden=true;};
  engine.pauseMovie=paused=>{if(paused)video.pause();else video.play().catch(error=>{if(error.name!=='AbortError')report(error);});};
  engine.playMovie=id=>{video.src=`assets/movies/${id}.webm`;video.style.display='block';skip.hidden=false;video.play().catch(error=>{if(error.name!=='AbortError')report(error);});};
}
function begin(id=99){engine?.stopSound?.(0);engine?.stopMovie?.();failed=false;audio ||= new AudioContext();audio.resume();engine=new PlayEngine(banks);window.engine=engine;configure();running=true;try{engine.activate(id);render();canvas.focus();}catch(e){report(e);}}
function pickSprite(x,y){return [...engine.sprites.values()].reverse().sort((a,b)=>a.z-b.z).find(s=>{const width=s.displayWidth??s.width,height=s.displayHeight??s.height;if(!s.z||!width||!height||x<s.x||x>=s.x+width||y<s.y||y>=s.y+height)return false;const image=imageFor(s);if(!s.surface&&(!image.complete||!image.naturalWidth))return false;if(!image.pixels||s.surface){const buffer=new OffscreenCanvas(s.width,s.height),c=buffer.getContext('2d');c.drawImage(image,0,0);image.pixels=c.getImageData(0,0,s.width,s.height).data;}const px=Math.floor((x-s.x)*s.width/width),py=Math.floor((y-s.y)*s.height/height);return image.pixels[4*(py*s.width+px)+3]>0;});}
function hit(x,y){const picked=pickSprite(x,y);engine.hitSprite=picked?.id||0;const buttons=[...engine.buttons].map(id=>({id,bytes:engine.resource('BUTN',id)})).filter(b=>b.bytes).sort((a,b)=>viewOf(a.bytes).getUint16(2,true)-viewOf(b.bytes).getUint16(2,true));for(const {id,bytes}of buttons){const d=viewOf(bytes),kind=d.getUint16(0,true)&4095;if(kind===4){const n=d.getUint16(14,true),targets=Array.from({length:n},(_,i)=>d.getUint16(16+2*i,true));if(picked&&targets.includes(picked.id))return id;}else if(kind===3){const n=d.getUint16(14,true)/2;let inside=false;for(let i=0,j=n-1;i<n;j=i++){const xi=d.getInt16(16+4*i,true),yi=d.getInt16(18+4*i,true),xj=d.getInt16(16+4*j,true),yj=d.getInt16(18+4*j,true);if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}if(inside)return id;}else if(bytes.length>=24){const l=d.getInt16(16,true),t=d.getInt16(18,true),r=d.getInt16(20,true),b=d.getInt16(22,true);if(kind===1?((x-(l+r)/2)/((r-l)/2))**2+((y-(t+b)/2)/((b-t)/2))**2<1:x>=l&&x<r&&y>=t&&y<b)return id;}}return 0;}
canvas.addEventListener('pointermove',e=>{if(!running)return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*640/r.width,y=(e.clientY-r.top)*480/r.height;engine.mouse={x:Math.round(x),y:Math.round(y)};const id=hit(x,y);canvas.style.cursor=id?'pointer':'default';try{if(id!==engine.hover){if(engine.hover)engine.event(15,[engine.hover]);if(id)engine.event(14,[id]);engine.hover=id;}else if(id)engine.event(16,[id]);}catch(error){report(error);}});
for(const [name,event]of [['pointerdown',10],['pointerup',11],['dblclick',12],['contextmenu',13]])canvas.addEventListener(name,e=>{if(!running)return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*640/r.width,y=(e.clientY-r.top)*480/r.height;engine.mouse={x:Math.round(x),y:Math.round(y)};const target=hit(x,y);try{engine.event(event,[target,engine.hitSprite||0]);render();}catch(error){report(error);}e.preventDefault();});
canvas.addEventListener('pointerdown',e=>{canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('keydown',e=>{if(!running)return;try{const code=e.key.length===1?e.key.toUpperCase().charCodeAt(0):e.key==='Backspace'?8:e.key==='Enter'?13:0;engine.event(5,[code,1,0]);if(e.key.length===1||e.key==='Backspace'||e.key==='Enter')engine.event(6,[e.key.length===1?e.key.charCodeAt(0):code,1,0]);}catch(error){report(error);}e.preventDefault();});
canvas.addEventListener('keyup',e=>{if(!running)return;try{engine.event(7,[e.key.length===1?e.key.toUpperCase().charCodeAt(0):e.key==='Backspace'?8:e.key==='Enter'?13:0,1,0]);}catch(error){report(error);}e.preventDefault();});
const manifest=await fetch('assets/manifest.json').then(r=>r.json()),banks=new Map();
const fontManifest=await fetch('assets/fonts/manifest.json').then(r=>r.json()),fontData=new Map();
await Promise.all(Object.entries(fontManifest).map(async([key,digest])=>{const data=await fetch(`assets/fonts/${digest}.json`).then(r=>r.json());fontData.set(key,{...data,digest});}));
try{await Promise.all(manifest.banks.map(async entry=>{const bank=decodeBank(await fetch(`assets/${entry.bank}/bank.json`).then(r=>r.json()));banks.set(bank.id,bank);const option=new Option(`${bank.id}: ${names[bank.id]||bank.bank}`,bank.id);selector.add(option);}));start.disabled=false;start.textContent='Start game';status.textContent='Ready. Click Start game to enable sound.';}catch(e){report(e);}
start.onclick=()=>begin();document.querySelector('#load').onclick=()=>{video.pause();video.style.display='none';skip.hidden=true;try{if(!engine)begin();failed=false;running=true;engine.event(110,[engine.bank.id,Number(selector.value)]);}catch(e){report(e);}};
document.querySelector('#classroom').onclick=()=>{try{engine.stopSound(0);engine.event(110,[engine.bank.id,12]);canvas.focus();}catch(error){report(error);}};
setInterval(()=>{if(!running||failed)return;try{engine.vm.instructions=0;engine.tick();render();if(engine.exited){running=false;engine.stopSound(0);engine.stopMovie();status.textContent='Game closed. Click Start game to play again.';}}catch(e){report(e);}},125);
