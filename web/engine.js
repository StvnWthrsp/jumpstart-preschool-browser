import {PlayVM} from './vm.js';
import {Profiles} from './profiles.js';

export const viewOf = data => new DataView(data.buffer, data.byteOffset, data.byteLength);

export class PlayEngine {
  constructor(banks) {
    this.banks = banks;
    this.active = [99];
    this.bank = banks.get(99);
    this.vm = new PlayVM(this);
    this.profiles = new Profiles(this.vm);
    this.sprites = new Map();
    this.animations = new Map();
    this.timers = new Map();
    this.buttons = new Set();
    this.trace = [];
    this.warnings = new Set();
    this.queue = [];
    this.eventDepth = 0;
    this.tickCount = 0;
    this.loadedBundles = [];
    this.files = new Map();
    this.saves = new Map();
    this.textSprites=new Map();
    this.surfaces=new Map();
    this.textStyles=new Map();
  }

  find(tag, id) {
    id &= 65535;
    for(const {bank,bundle} of [...this.loadedBundles].reverse()) {
      const entries=tag==='BMAP'?bundle.images:bundle.resources[tag];
      for(const key of Object.keys(entries||{}))if((Number(key)&65535)===id)return {bank,id:Number(key),value:entries[key],entries};
    }
    for (const bankId of [...this.active].reverse()) {
      const bank=this.banks.get(bankId);
      const entries=tag==='BMAP'?bank.images:bank.resources[tag];
      if(!entries)continue;
      for(const key of Object.keys(entries))if((Number(key)&65535)===id)return {bank,id:Number(key),value:entries[key],entries};
    }
    for(const bankId of [...this.active].reverse()) {
      const bank=this.banks.get(bankId);
      for(const bundle of Object.values(bank.bundles)) {
        const entries=tag==='BMAP'?bundle.images:bundle.resources[tag];
        for(const key of Object.keys(entries||{}))if((Number(key)&65535)===id){if(!this.loadedBundles.some(b=>b.bundle===bundle))this.loadedBundles.push({bank,bundle});return {bank,id:Number(key),value:entries[key],entries};}
      }
    }
    return null;
  }
  resource(tag,id) {const found=this.find(tag,id);if(!found)return null;if(typeof found.value==='string')found.entries[found.id]=Uint8Array.from(atob(found.value),c=>c.charCodeAt(0));return found.entries[found.id];}
  event(id,args=[]) {
    this.trace.push({bank:this.bank.id,id,args:[...args]});
    if(this.trace.length>1000)this.trace.shift();
    this.eventDepth++;
    try {
      const bytes=this.resource('EVNT',id);
      if(bytes) {
        const data=viewOf(bytes), n=data.getUint32(16,true), offset=20+n*4, cases=data.getUint32(offset,true);
        let script=0;
        if(!n)script=cases?data.getUint32(offset+4,true):0;
        else {
          for(let i=0;i<cases;i++) {
            const candidate=data.getUint32(offset+4+i*8,true), match=data.getInt32(offset+8+i*8,true);
            if(match===args[0] || (i===cases-1&&match===0)) {script=candidate;break;}
          }
        }
        if(script)return this.vm.call(script,args);
        return 0;
      }
      return this.hostCall(id,args);
    } finally {
      if(--this.eventDepth===0)while(this.queue.length){const fn=this.queue.shift();fn();}
    }
  }

  sprite(id, instance, x,y,z=0, animation=null) {
    if(this.textSprites.has(id)){Object.assign(this.textSprites.get(id),{x,y,z,instance});return 1;}
    if(this.surfaces.has(id)){this.sprites.set(`${instance}:${id}`,{id,instance,x,y,z,animation,surface:this.surfaces.get(id),...this.surfaces.get(id)});return 1;}
    const found=this.find('BMAP',id);
    if(!found){this.warnings.add(`Missing bitmap ${id}`);return 0;}
    this.sprites.set(`${instance}:${id}`,{id,instance,x,y,z,animation,bank:found.bank.bank,file:found.id,...found.value});
  }
  remove(id=0,instance=0) {
    for(const [key,sprite]of this.sprites)if((!id||sprite.id===id)&&(!instance||sprite.instance===instance||(id&&!sprite.instance)))this.sprites.delete(key);
    for(const [key,sprite]of this.textSprites)if((!id||sprite.id===id)&&(!instance||sprite.instance===instance||(id&&!sprite.instance)))this.textSprites.delete(key);
  }
  animate(id,x=0,y=0,z=0,parent=0) {
    this.stopAnimation(id);
    for(const bankId of [...this.active].reverse()) {
      const bank=this.banks.get(bankId), bundle=bank.bundles[id];
      if(bundle&&!this.loadedBundles.some(b=>b.bundle===bundle))this.loadedBundles.push({bank,bundle});
    }
    const bytes=this.resource('ANIM',id);
    if(!bytes){this.warnings.add(`Missing animation ${id}`);return 0;}
    const data=viewOf(bytes), n=data.getUint32(0,true);
    if(n>128)throw new Error(`Animation container ${id} needs decoding`);
    const channels=Array.from({length:n},(_,i)=>({type:data.getUint16(12+6*i,true),mode:data.getUint16(14+6*i,true),end:data.getUint16(16+6*i,true),wait:0,image:0}));
    this.animations.set(id,{id,bytes,data,channels,remaining:data.getUint32(4,true)+1,pc:12+6*n,x,y,z,parent});
    this.event(1,[id,Number(Boolean(parent))]);
    return 1;
  }
  stopAnimation(id=0) {
    for(const [key,anim]of this.animations)if(!id||id===key||anim.parent===id){this.animations.delete(key);for(const channel of anim.channels)if(channel.type===2&&channel.image)this.stopSound?.(channel.image);for(const [skey,s]of this.sprites)if(s.animation===key)this.sprites.delete(skey);}
    return 1;
  }
  moveAnimation(id,dx,dy,dz) {
    const anim=this.animations.get(id);if(!anim)return 0;
    anim.x+=dx;anim.y+=dy;anim.z+=dz;
    for(const sprite of this.sprites.values())if(sprite.animation===id){sprite.x+=dx;sprite.y+=dy;sprite.z+=dz;}
    for(const channel of anim.channels)if(channel.type===3&&channel.image)this.moveAnimation(channel.image,dx,dy,dz);
    return 1;
  }
  scaleAnimation(id,percent,refX,refY) {
    const anim=this.animations.get(id);if(!anim)return 0;
    anim.scale=Math.max(5,Math.min(500,percent))/100;anim.refX=refX;anim.refY=refY;
    for(const channel of anim.channels)if(channel.type===3&&channel.image)this.scaleAnimation(channel.image,percent,refX,refY);
    return 1;
  }
  textRuns(text) {
    const runs=[];let font=this.fontData?.get(`${this.fontBank}:${this.font}`),color=this.textColor,hidden=false,buffer='';
    const flush=()=>{if(buffer&&!hidden)runs.push({text:buffer,font,color});buffer='';};
    for(let i=0;i<text.length;){
      if(text[i]==='\\'){
        const match=/^\\([fFhH])(\d+)\\/.exec(text.slice(i));
        if(match){flush();if(match[1].toLowerCase()==='f'){const style=this.textStyles.get(Number(match[2]));if(style){font=style.font||font;color=style.color??color;}}else hidden=match[2]!=='0';i+=match[0].length;continue;}
        i++;if(i>=text.length)break;
      }
      buffer+=text[i++];
    }
    flush();return runs;
  }
  hostCall(id,a) {
    const vm=this.vm;
    if(id<35000)return 0;
    if(id>=38500&&id<=38595){const result=this.profiles.handle(id,a);if(result!==undefined)return result;}
    switch(id) {
      case 35001:case 35032:return this.animate(a[0],a[1],a[2],a[3]);
      case 35002:return this.stopAnimation(a[0]);
      case 35004:case 35019:this.timers.set(a[0],{interval:Math.max(1,Math.round(a[1]/12.5)),next:this.tickCount+Math.max(1,Math.round(a[1]/12.5)),script:a[2],once:id===35019});return 0;
      case 35005:this.timers.delete(a[0]);return 0;
      case 35006:this.cursor=a[0];this.cursorHotspot={x:a[1]||0,y:a[2]||0};return 0;
      case 35007:return this.cursor||0;
      case 35008:this.cursorHidden=true;return 0;
      case 35009:this.cursorHidden=false;return 0;
      case 35011:this.buttons.add(a[0]);return 1;
      case 35012:this.buttons.delete(a[0]);return 1;
      case 35013:this.queue.push(()=>this.activate(a[1]));return 1;
      case 35014:if(!this.banks.has(a[0]))return 0;if(a[1]>=5)this.queue.push(()=>this.activate(a[0]));else if(!this.active.includes(a[0]))this.active.push(a[0]);return 1;
      case 35015:this.active=this.active.filter(b=>b!==a[0]);return 1;
      case 35016:this.brightness=Math.min(100,Math.max(0,a[1]))/100;return 1;
      case 35062:if(!a[0]||a[0]===this.movie)this.pauseMovie?.(Boolean(a[1]));return 0;
      case 35017:this.saves.set(a[0],new Uint8Array(vm.memory.buffer,0,6000).slice());return 1;
      case 35018:{const saved=this.saves.get(a[0]);if(!saved)return 0;const offset=a[1]*2,length=a[2]?a[2]*2:6000;new Uint8Array(vm.memory.buffer).set(saved.subarray(offset,offset+length),offset);return 1;}
      case 35020:vm.write(a[0],this.mouse?.x||0);vm.write(a[1],this.mouse?.y||0);return 0;
      case 35021:{const found=this.find('BMAP',a[0]);this.background=found?{...found.value,id:a[0],bank:found.bank.bank,file:found.value.file||found.id}:null;return Number(Boolean(found));}
      case 35022:return 0;
      case 35023:this.remove();return 0;
      case 35024:this.sprite(a[0],a[1],a[2],a[3],a[4]);return 0;
      case 35025:this.remove(a[0],a[1]);return 0;
      case 35026:this.exited=true;return 0;
      case 35027:{const name=vm.text(a[0]);const data=this.files.get(name)||new Uint8Array(a[2]+a[3]);const next=new Uint8Array(Math.max(data.length,a[2]+a[3]));next.set(data);next.set(new Uint8Array(vm.memory.buffer,a[1],a[3]),a[2]);this.files.set(name,next);return 1;}
      case 35028:{const data=this.files.get(vm.text(a[0]));if(!data)return 0;new Uint8Array(vm.memory.buffer).set(data.subarray(a[2],a[2]+a[3]),a[1]);return 1;}
      case 35029:{const s=this.surfaces.get(a[0])||this.find('BMAP',a[0])?.value;vm.write(a[1],s?.width||0);vm.write(a[2],s?.height||0);return Number(Boolean(s));}
      case 35030:return 0;
      case 35033:{const data=this.resource('STR',a[1]);if(!data)return 0;const text=new TextDecoder().decode(data.subarray(2,2+viewOf(data).getUint16(0,true)));vm.write(a[0],vm.string(text));return 1;}
      case 35035:return 1;
      case 35036:return 0;
      case 35037:return 0;
      case 35039:if(a[0]===1){if(a[1]){vm.write(a[1],0);vm.write(a[1]+4,0);}return 1;}if(a[0]===2){if(a[1])vm.write(a[1],8);return 1;}return 0;
      case 35040:case 35041:case 35042:case 35043:{const anim=this.animations.get(a[0]);if(anim)anim.paused=Boolean(a[1]);return Number(Boolean(anim));}
      case 35044:case 35045:return 0;
      case 35046:case 35056:case 35059:case 35076:return 0;
      case 35047:return this.moveAnimation(a[0],a[1],a[2],a[3]);
      case 35048:return this.scaleAnimation(a[0],a[1],a[2],a[3]);
      case 35049:{const surface={width:a[2],height:a[3],draws:[]};this.surfaces.set(a[0],surface);this.sprite(a[0],0,0,0,a[1]);return a[0];}
      case 35050:{const s=[...this.sprites.values(),...this.textSprites.values()].find(s=>s.id===a[0]&&!s.instance);if(!s)return 0;s.x+=a[1];s.y+=a[2];s.z+=a[3];if(a[4]){const scale=Math.max(5,Math.min(500,a[4]))/100;s.displayWidth=Math.round(s.width*scale);s.displayHeight=Math.round(s.height*scale);}return 1;}
      case 35052:{const timer=this.timers.get(a[0]);if(timer)timer.paused=Boolean(a[1]);return 0;}
      case 35053:return 0;
      case 35054:return 0;
      case 35061:if(!a[0]||a[0]===this.movie){this.stopMovie?.();this.movie=0;}return 0;
      case 35060:if(a[0]===99){this.event(31,[a[0]]);return 0;}this.movie=a[0];this.event(30,[a[0]]);this.playMovie?.(a[0]);return 1;
      case 35100:return 0;
      case 35074:{const d=new Date();[d.getHours(),d.getMinutes(),d.getSeconds(),d.getDate(),d.getMonth()+1,d.getFullYear(),d.getDay()||7].forEach((v,i)=>vm.write(a[i],v));return 0;}
      case 35070:{const anim=this.animations.get(a[0]);if(!anim)return 0;[anim.x,anim.y,anim.z,(anim.scale??1)*100,anim.refX||0,anim.refY||0,anim.remaining,0].forEach((v,i)=>{if(a[i+1])vm.write(a[i+1],v);});return 1;}
      case 35072:{const surface=this.surfaces.get(a[0]),found=this.find('BMAP',a[1]);if(surface&&found){const raw=new DataView(new ArrayBuffer(4));raw.setInt32(0,a[4],true);surface.draws.push({...found.value,bank:found.bank.bank,file:found.value.file||found.id,x:a[2],y:a[3],scale:raw.getFloat32(0,true)/100});}return 0;}
      case 37001:{const b=this.resource('DTAB',a[0]);if(!b)return 0;const d=viewOf(b);vm.write(a[1],d.getInt32(8,true));vm.write(a[2],d.getInt32(12,true));return 1;}
      case 37002:{const b=this.resource('DTAB',a[0]);if(!b)return 0;const d=viewOf(b),columns=d.getUint32(8,true),rows=d.getUint32(12,true);if(a[1]<0||a[2]<0||a[1]>=columns||a[2]>=rows)return 0x44454144;return d.getInt32(16+4*(columns*a[2]+a[1]),true);}
      case 37500:{const text=vm.text(a[1]),runs=this.textRuns(text),font=this.fontData?.get(`${this.fontBank}:${this.font}`);const lineHeight=font?.height||24;const width=runs.reduce((total,run)=>total+[...run.text].reduce((n,c)=>n+(run.font?.glyphs[c.charCodeAt(0)]?.advance||12),0),0);const height=lineHeight*Math.max(1,Math.ceil(width/Math.max(1,a[4]-a[2])));if(a[0]){const previous=this.textSprites.get(a[0]),sprite=[...this.sprites.values()].find(s=>s.id===a[0]);const found=this.find('BMAP',a[0]);this.textSprites.set(a[0],{id:a[0],text,runs,x:sprite?.x??previous?.x??a[2],y:sprite?.y??previous?.y??a[3],z:sprite?.z??previous?.z??0,instance:sprite?.instance??previous?.instance??0,width:found?.value.width||a[4]-a[2],height:found?.value.height||height,font,offsetX:a[2],offsetY:a[3],alignment:this.textAlignment||0});for(const [key,value]of this.sprites)if(value.id===a[0])this.sprites.delete(key);}return height;}
      case 37501:this.font=a[0];this.fontBank=this.find('UFI1',a[0])?.bank.bank;this.textColor=undefined;return Number(Boolean(this.fontBank));
      case 37502:return 1;
      case 37504:this.textColor=(a[0]&65535)===256?undefined:a[0]&255;return 1;
      case 37505:{const found=a[1]?this.find('UFI1',a[1]):null;this.textStyles.set(a[0],{font:found?this.fontData?.get(`${found.bank.bank}:${a[1]}`):null,color:(a[3]&65535)===256?undefined:a[3]&255});return 1;}
      case 37506:this.textAlignment=a[0];return 1;
      case 37999:return 0;
      case 38000:case 38001:return 0;
      default:throw new Error(`Unsupported engine event ${id} (${a.join(',')})`);
    }
  }
  activate(id) {
    if(!this.banks.has(id))throw new Error(`Missing bank ${id}`);
    this.active=id===99?[99]:[99,id];this.bank=this.banks.get(id);
    this.loadedBundles=[];
    this.buttons.clear();this.stopAnimation();this.timers.clear();this.sprites.clear();
    this.textSprites.clear();this.surfaces.clear();
    for(const bankId of this.active)for(const rid of Object.keys(this.banks.get(bankId).resources.BUTN||{})){const bytes=this.resource('BUTN',Number(rid));if(viewOf(bytes).getUint16(0,true)&32768)this.buttons.add(Number(rid)&65535);}
    for(const rid of Object.keys(this.bank.resources.VARI||{})){const data=viewOf(this.resource('VARI',Number(rid)));if(data.getUint32(4,true)===8)for(let i=0;i<data.getUint32(8,true);i++){const address=data.getUint32(12,true)+4*i;if(!this.vm.read(address))this.vm.write(address,this.vm.string());}}
    return this.event(3,[id]);
  }
  tick() {
    this.tickCount++;
    this.event(9,[]);
    for(const [id,anim]of [...this.animations]) {
      if(anim.paused)continue;
      if(anim.remaining<=1){this.animations.delete(id);for(const channel of anim.channels)if(channel.type===2&&channel.image)this.stopSound?.(channel.image);this.event(2,[id,Number(Boolean(anim.parent))]);continue;}
      anim.remaining--;
      for(const channel of anim.channels) {
        if(channel.wait){channel.wait--;continue;}
        if(anim.pc+2>anim.bytes.length)throw new Error(`Animation ${id} stream exhausted: frame remaining ${anim.remaining}, channel ${channel.type}, offset ${anim.pc}/${anim.bytes.length}`);
        const token=anim.data.getUint16(anim.pc,true);anim.pc+=2;
        if(token===65535){channel.wait=anim.data.getUint16(anim.pc,true)-1;anim.pc+=2;continue;}
        if(channel.type===4) {
          if(channel.image)this.remove(channel.image,id);
          channel.image=token;
          if(token) {
            const scale=anim.scale??1,refX=anim.refX||0,refY=anim.refY||0;
            let x=anim.x+refX+(anim.data.getInt16(anim.pc,true)-refX)*scale,y=anim.y+refY+(anim.data.getInt16(anim.pc+2,true)-refY)*scale,z=anim.z+channel.mode;anim.pc+=4;
            const instance=channel.end===anim.remaining?0:id;
            this.sprite(token,instance,x,y,z,instance? id:null);
            const sprite=this.sprites.get(`${instance}:${token}`);if(sprite){sprite.displayWidth=Math.round(sprite.width*scale);sprite.displayHeight=Math.round(sprite.height*scale);}
          }
        } else if(channel.type===3) {channel.image=token;if(token)this.animate(token,anim.x,anim.y,anim.z,id);}
        else if(channel.type===2) {channel.image=token;if(token)this.playSound?.(token,channel.mode);}
        else if(channel.type===1) {if(token)this.event(token,[id]);}
        else throw new Error(`Unsupported animation channel ${channel.type}`);
      }
    }
    for(const [id,timer]of [...this.timers])if(!timer.paused&&this.tickCount>=timer.next) {
      if(timer.once)this.timers.delete(id);else timer.next+=timer.interval;
      this.vm.call(timer.script,[id]);
    }
    if(this.tickCount%100===0)this.vm.collectStrings();
  }
}

export function decodeBank(bank) {
  return bank;
}
