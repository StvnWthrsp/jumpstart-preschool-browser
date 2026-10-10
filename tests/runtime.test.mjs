import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayVM} from '../web/vm.js';
import {PlayEngine} from '../web/engine.js';
import {Profiles} from '../web/profiles.js';
import {decodeADP} from '../web/audio.js';

test('sprite movement uses relative deltas for the persistent instance',()=>{
  const engine=new PlayEngine(new Map());
  engine.sprites.set('0:42',{id:42,instance:0,x:100,y:200,z:10,width:100,height:50});
  engine.sprites.set('8:42',{id:42,instance:8,x:50,y:60,z:20});
  assert.equal(engine.hostCall(35050,[42,-10,5,2,50]),1);
  assert.deepEqual(engine.sprites.get('0:42'),{id:42,instance:0,x:90,y:205,z:12,width:100,height:50,displayWidth:50,displayHeight:25});
  assert.equal(engine.sprites.get('8:42').x,50);
});

test('removing an animation bitmap also removes its persistent instance',()=>{
  const engine=new PlayEngine(new Map());
  for(const instance of [0,8,9])engine.sprites.set(`${instance}:42`,{id:42,instance});
  engine.remove(42,8);
  assert.deepEqual([...engine.sprites.keys()],['9:42']);
});

test('clearing an instance with a wildcard bitmap preserves unrelated persistent sprites',()=>{
  const engine=new PlayEngine(new Map());
  for(const instance of [0,8,9])engine.sprites.set(`${instance}:42`,{id:42,instance});
  engine.remove(0,8);
  assert.deepEqual([...engine.sprites.keys()],['0:42','9:42']);
});

test('profile names and typed fields survive save and restore',()=>{
  const vm=new PlayVM({});let saved;
  const profiles=new Profiles(vm,{},records=>{saved=JSON.stringify(records);});
  assert.equal(profiles.handle(38500,[vm.string('Arcane\0padding')]),1);
  const category=vm.string('blocks'),key=vm.string('score');
  profiles.handle(38552,[category,key,123]);
  const restored=new Profiles(vm,JSON.parse(saved));
  restored.handle(38500,[vm.string('Arcane')]);
  assert.equal(restored.handle(38542,[category,key,500]),1);
  assert.equal(vm.read(500),123);
  assert.equal(restored.handle(38542,[category,vm.string('missing'),504]),0);
});

test('ADP1 mono decodes low nibble first from the initial predictor',()=>{
  const bytes=new Uint8Array(27),view=new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('ADP1'));view.setUint32(12,10,true);
  view.setUint32(16,22050,true);view.setUint16(20,1,true);
  view.setInt16(22,100,true);view.setInt16(24,0,true);bytes[26]=0x91;
  const decoded=decodeADP(bytes);
  assert.equal(decoded.rate,22050);assert.equal(decoded.channels,1);
  assert.deepEqual([...decoded.samples[0]],[101/32768,100/32768]);
});

test('correct and incorrect attempts are counted separately',()=>{
  const vm=new PlayVM({}),profiles=new Profiles(vm);
  profiles.handle(38500,[vm.string('Tester')]);
  const args=[vm.string('Preschool'),vm.string('Bird nests')];
  profiles.handle(38570,args);profiles.handle(38571,args);
  const counts=Object.entries(profiles.records.Tester).find(([key])=>key.startsWith('attempts/'))[1];
  assert.deepEqual(counts,{total:2,correct:1});
});

test('script returns an integer and restores its stack frame',()=>{
  const bytes=new Uint8Array(23),view=new DataView(bytes.buffer);
  view.setUint32(0,19,true);view.setUint32(8,4,true);
  bytes[16]=0x20;bytes[17]=0x21;bytes[18]=1;view.setInt32(19,77,true);
  const vm=new PlayVM({resource:()=>bytes,bank:{id:99}});
  assert.equal(vm.call(1,[]),77);assert.equal(vm.sp,60000);assert.equal(vm.depth,0);
});

test('learning thresholds promote and demote without reusing an earlier level period',()=>{
  const vm=new PlayVM({}),profiles=new Profiles(vm);
  profiles.handle(38500,[vm.string('Tester')]);const args=[vm.string('PS'),vm.string('Colors')];
  for(let i=0;i<40;i++)profiles.handle(i<32?38570:38571,args);
  profiles.handle(38574,[...args,3,40,80,40,60,500,502]);
  assert.equal(vm.read(500,5),1);assert.equal(vm.read(502,5),2);
  for(let i=0;i<40;i++)profiles.handle(38571,args);
  profiles.handle(38574,[...args,3,40,80,40,60,500,502]);
  assert.equal(vm.read(500,5),2);assert.equal(vm.read(502,5),1);
  profiles.handle(38574,[...args,3,40,80,40,60,500,502]);
  assert.equal(vm.read(502,5),1);
  profiles.handle(38580,[...args,504,508]);assert.equal(vm.read(504),80);assert.equal(vm.read(508),32);
});

test('save restoration counts 16-bit words and zero count restores the full block',()=>{
  const engine=new PlayEngine(new Map()),vm=engine.vm;
  vm.write(100,111);vm.write(200,222);engine.hostCall(35017,[1]);vm.write(100,0);vm.write(200,0);
  engine.hostCall(35018,[1,50,2]);assert.equal(vm.read(100),111);assert.equal(vm.read(200),0);
  engine.hostCall(35018,[1,0,0]);assert.equal(vm.read(200),222);
});

test('formatted font runs consume style delimiters and hidden spans',()=>{
  const engine=new PlayEngine(new Map());engine.textStyles.set(1,{color:68});
  assert.deepEqual(engine.textRuns('\\f01\\A\\h1\\hidden\\h0\\B').map(r=>[r.text,r.color]),[['A',68],['B',68]]);
});

test('saved game memory keeps its string handles alive',()=>{
  const engine=new PlayEngine(new Map()),vm=engine.vm,handle=vm.string('Saved player');
  vm.write(500,handle);engine.hostCall(35017,[1]);vm.write(500,0);vm.collectStrings();
  engine.hostCall(35018,[1,0,0]);assert.equal(vm.text(vm.read(500)),'Saved player');
});

test('repeated animation images retain their order among overlapping layers',()=>{
  const bank={id:99,bank:'test',images:{42:{width:1,height:1},43:{width:1,height:1}},resources:{},bundles:{}};
  const engine=new PlayEngine(new Map([[99,bank]])),bytes=new Uint8Array(24),data=new DataView(bytes.buffer);
  data.setUint16(0,42,true);data.setUint16(6,42,true);
  engine.animations.set(8,{id:8,bytes,data,pc:0,x:0,y:0,z:10,remaining:5,channels:[{type:4,mode:0,end:0,wait:0,image:0}]});
  engine.tick();engine.sprite(43,8,0,0,10);
  assert.deepEqual([...engine.sprites.keys()],['8:42','8:43']);
  engine.tick();assert.deepEqual([...engine.sprites.keys()],['8:42','8:43']);
});
