import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1000,height:850}}),errors=[],results=[];
page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(()=>{const interval=window.setInterval;window.setInterval=(fn,ms,...args)=>ms===125?(window.gameTick=fn,0):interval(fn,ms,...args);});
async function advance(count){await page.evaluate(count=>{for(let i=0;i<count;i++){engine.vm.instructions=0;engine.tick();if(engine.movie){const id=engine.movie;engine.stopMovie();engine.movie=0;engine.event(31,[id]);}}window.gameTick();},count);}
async function click(x,y){await page.locator('#game').click({position:{x,y}});}
async function checkCursor(label){
  await page.waitForTimeout(300);
  const result=await page.evaluate(async()=>{
    const canvas=document.querySelector('#game'),cursor=engine.find('BMAP',engine.cursor);
    if(engine.cursorHidden||!cursor)return {visible:false,id:engine.cursor,hidden:engine.cursorHidden};
    const image=new Image();image.src=`assets/${cursor.bank.bank}/${cursor.value.file||cursor.id}.png`;await image.decode();
    const actual=canvas.getContext('2d').getImageData(0,0,640,480).data;
    const mouse=engine.mouse,tick=engine.tick;engine.tick=()=>{};
    try{
      engine.mouse=null;window.gameTick();
      const expected=document.createElement('canvas');expected.width=640;expected.height=480;
      const ctx=expected.getContext('2d');ctx.drawImage(canvas,0,0);
      const base=ctx.getImageData(0,0,640,480).data;
      engine.mouse=mouse;window.gameTick();
      ctx.drawImage(image,mouse.x-(engine.cursorHotspot?.x||0),mouse.y-(engine.cursorHotspot?.y||0));
      const wanted=ctx.getImageData(0,0,640,480).data;
      let changed=0,mismatched=0;for(let i=0;i<actual.length;i++){if(wanted[i]!==base[i])changed++;if(wanted[i]!==actual[i])mismatched++;}
      return {visible:true,id:engine.cursor,changed,mismatched,x:mouse.x,y:mouse.y};
    }finally{engine.mouse=mouse;engine.tick=tick;}
  });
  results.push({label,...result});assert.equal(result.visible,true,`${label}: cursor hidden`);
  assert.ok(result.changed>100,`${label}: cursor must contribute visible pixels`);
  assert.equal(result.mismatched,0,`${label}: carried bitmap must be drawn at its hotspot`);
}
try{
  await page.goto('http://127.0.0.1:8099');await page.waitForFunction(()=>!document.querySelector('#start').disabled,{timeout:60000});
  await page.evaluate(()=>localStorage.removeItem('preschool-profiles'));await page.locator('#start').click();await advance(100);
  await page.locator('#game').hover({position:{x:320,y:180}});await checkCursor('Sign-in after opening animation');
  await click(260,67);await page.keyboard.type('Cursor test');await page.keyboard.press('Enter');await advance(200);
  await page.waitForTimeout(300);await click(330,260);await advance(100);await page.waitForTimeout(300);
  for(const [room,x,y] of [[5,615,399],[9,629,226]]){
    await click(x,y);await advance(1000);await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>engine.bank.id),room);
    const before=await page.evaluate(()=>engine.cursor);
    const sources=await page.evaluate(room=>{
      if(room===5){const s=[...engine.sprites.values()].find(s=>s.id===801);return [{x:s.x+s.width/2,y:s.y+s.height/2}];}
      const targets=new Set();for(const id of engine.buttons){if(id<2332||id>2348)continue;const b=engine.resource('BUTN',id),d=new DataView(b.buffer,b.byteOffset,b.byteLength);for(let i=0;i<d.getUint16(14,true);i++)targets.add(d.getUint16(16+2*i,true));}
      return [...engine.sprites.values()].filter(s=>targets.has(s.id)).map(s=>({x:s.x+s.width/2,y:s.y+s.height/2}));
    },room);
    assert.ok(sources.length,`Room ${room}: no ingredient/shape available`);
    for(const source of sources){await click(source.x,source.y);await advance(20);if(await page.evaluate(()=>engine.cursor)!==before)break;}
    assert.notEqual(await page.evaluate(()=>engine.cursor),before,`Room ${room}: pickup must select an item bitmap`);
    for(const [index,point] of [{x:100,y:180},{x:450,y:180}].entries()){
      await page.locator('#game').hover({position:point});await checkCursor(`Room ${room}, pointer ${index}`);
    }
    await page.screenshot({path:`artifacts/cursor-room-${room}.png`});
    await page.locator('#classroom').click();await advance(100);await page.waitForTimeout(300);
  }
  assert.deepEqual(errors,[]);console.log('PASS: sign-in cursor and carried items in sorting/kitchen match original bitmap pixels at two pointer positions.');
}finally{fs.writeFileSync('artifacts/cursor.json',JSON.stringify({results,errors},null,2));await browser.close();}
