import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1000,height:850}}),errors=[],results=[];
page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(()=>{const interval=window.setInterval;window.setInterval=(fn,ms,...args)=>ms===125?(window.gameTick=fn,0):interval(fn,ms,...args);});
await page.goto('http://127.0.0.1:8099');await page.waitForFunction(()=>!document.querySelector('#start').disabled,{timeout:60000});
async function advance(count){await page.evaluate(count=>{for(let i=0;i<count;i++){engine.vm.instructions=0;engine.tick();if(engine.movie){const id=engine.movie;engine.stopMovie();engine.movie=0;engine.event(31,[id]);}}window.gameTick();},count);}
async function click(x,y){await page.locator('#game').click({position:{x,y}});}
const rooms=[[12],[1,411,144],[2,475,400],[3,127,180],[4,85,378],[5,615,399],[6,538,172],[7,436,272],[8,306,235],[9,629,226],[10,187,146]];
try{
  for(const [room,rx,ry] of rooms){
    for(const [index,x] of [54,123,190,255,323,385,450,520,583].entries()){
      await page.evaluate(()=>localStorage.removeItem('preschool-profiles'));await page.locator('#start').click();await advance(100);
      await click(260,67);await page.keyboard.type('Toolbar test');await page.keyboard.press('Enter');await advance(200);
      await page.waitForTimeout(200);await click(330,260);await advance(100);await page.waitForTimeout(200);
      if(room!==12){await click(rx,ry);await advance(300);await page.waitForTimeout(200);}
      assert.equal(await page.evaluate(()=>engine.bank.id),room,`Could not enter room ${room}`);
      const enabled=await page.evaluate(()=>[...engine.buttons]);
      assert.ok(!enabled.includes(30088),'Startup-disabled legacy toolbar was re-enabled');
      await page.evaluate(()=>engine.trace=[]);await click(x,444);
      const clicked=await page.evaluate(()=>engine.trace.find(t=>t.id===10)?.args[0]);
      if(index<5&&enabled.includes(30843+index))assert.equal(clicked,30843+index,`Wrong bottom block in room ${room}, x=${x}`);
      assert.notEqual(clicked,30088,'Click reached the obsolete toolbar');
      await advance(500);
      const result=await page.evaluate(({room,x,clicked})=>({room,x,clicked,bank:engine.bank.id,active:engine.active,status:document.querySelector('#status').textContent}),{room,x,clicked});
      results.push(result);
      assert.ok(result.active.includes(result.bank),`Active room was unloaded at ${room}/${x}`);
      assert.ok(!result.status.startsWith('Runtime stopped'),result.status);
      if(index===0&&room!==12)assert.equal(result.bank,12,'Back block did not return to the classroom');
      if(room===2&&index===4)await page.screenshot({path:'artifacts/paper-toolbar.png'});
    }
    console.log(`Room ${room}: nine bottom blocks checked`);
  }
  assert.deepEqual(errors,[]);
}finally{
  fs.writeFileSync('artifacts/toolbar.json',JSON.stringify({results,errors},null,2));
  await browser.close();
}
