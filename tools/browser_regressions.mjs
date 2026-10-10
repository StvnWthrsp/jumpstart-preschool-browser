import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1000,height:850}});
await page.addInitScript(()=>{
  const originalInterval=window.setInterval;
  window.setInterval=(callback,delay,...args)=>delay===125?(window.gameTick=callback,0):originalInterval(callback,delay,...args);
  window.loadedImages=[];
  const OriginalImage=window.Image;
  window.Image=class extends OriginalImage{constructor(...args){super(...args);window.loadedImages.push(this);}};
});
async function advance(count){await page.evaluate(count=>{for(let i=0;i<count;i++){window.gameTick();if(engine.movie){const id=engine.movie;engine.stopMovie();engine.movie=0;engine.event(31,[id]);}}},count);}
async function click(x,y){await page.locator('#game').click({position:{x,y}});}
try{
  await page.goto('http://127.0.0.1:8099');await page.waitForFunction(()=>!document.querySelector('#start').disabled,{timeout:60000});
  await page.evaluate(()=>localStorage.setItem('preschool-profiles',JSON.stringify({'Existing':{}})));
  await page.locator('#start').click();await advance(100);await page.waitForTimeout(500);
  await page.locator('#start').focus();await click(260,67);
  console.log('Focus after actual sign-in click:',await page.evaluate(()=>document.activeElement.id));
  assert.equal(await page.evaluate(()=>document.activeElement.id),'game','Clicking the sign-in field must focus the canvas without a keyboard tool focusing it');
  await page.keyboard.type('Focus test');await page.keyboard.press('Enter');await advance(200);
  assert.equal(await page.evaluate(()=>engine.bank.id),11);
  assert.ok(await page.evaluate(()=>Object.keys(engine.profiles.records).some(name=>name.toLowerCase()==='focus test')));
  await page.waitForTimeout(400);await click(330,260);await advance(100);await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>engine.bank.id),12);
  await page.route('**/*.png',async route=>{await new Promise(resolve=>setTimeout(resolve,180));await route.continue();});
  await click(475,400);await advance(100);assert.equal(await page.evaluate(()=>engine.bank.id),2);
  let pendingFrames=0,completeFrames=0;
  for(let i=0;i<100;i++){
    const result=await page.evaluate(()=>{
      const canvas=document.querySelector('#game'),before=canvas.toDataURL();window.gameTick();
      const pending=[...engine.sprites.values()].filter(sprite=>!sprite.surface).some(sprite=>{
        const suffix=`/assets/${sprite.bank}/${sprite.file}.png`;
        const image=window.loadedImages.find(image=>image.src.endsWith(suffix));return !image||!image.complete||!image.naturalWidth;
      });
      return {pending,unchanged:canvas.toDataURL()===before};
    });
    if(result.pending){pendingFrames++;assert.ok(result.unchanged,'Pierre and the rest of the displayed frame must remain intact while a replacement bitmap loads');}
    else completeFrames++;
    await page.waitForTimeout(50);
  }
  assert.ok(pendingFrames>0,'Delayed bitmap loading must be exercised');
  assert.ok(completeFrames>0,'Complete animation frames must also be presented');
  await page.screenshot({path:'artifacts/paper-regression.png'});
  console.log(`PASS: sign-in via ordinary keyboard; ${pendingFrames} pending frames retained and ${completeFrames} complete Paper Activities frames.`);
}finally{await browser.close();}
