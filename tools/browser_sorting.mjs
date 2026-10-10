import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1000,height:850}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
async function advance(count){await page.evaluate(count=>{for(let i=0;i<count;i++){engine.vm.instructions=0;engine.tick();if(engine.movie){const id=engine.movie;engine.stopMovie();engine.movie=0;engine.event(31,[id]);}}},count);}
async function click(x,y){await page.locator('#game').click({position:{x,y}});}
try{
  await page.goto('http://127.0.0.1:8099');await page.waitForFunction(()=>!document.querySelector('#start').disabled,{timeout:60000});
  await page.locator('#start').click();await advance(100);await click(260,150);
  await page.locator('#game').pressSequentially('Sorting test');await page.locator('#game').press('Enter');await advance(200);
  await page.waitForTimeout(400);await click(330,260);await advance(100);
  await page.waitForTimeout(400);await click(615,399);await advance(1000);
  assert.equal(await page.evaluate(()=>engine.bank.id),5);
  let carried=0;
  for(let i=0;i<60;i++){
    const source=await page.evaluate(id=>{const s=[...engine.sprites.values()].find(s=>s.id===id);return s?{x:s.x+s.width/2,y:s.y+s.height/2}:null;},801+i%9);
    if(source){await click(source.x,source.y);await advance(20);if(await page.evaluate(()=>engine.cursor))carried++;}
    const [x,y]=[[159,78],[368,68],[516,141]][i%3];await click(x,y);await advance(300);
    if((await page.locator('#status').textContent()).startsWith('Runtime stopped'))throw new Error(await page.locator('#status').textContent());
  }
  const records=await page.evaluate(()=>engine.profiles.records);
  const attempts=Object.values(records).flatMap(fields=>Object.entries(fields).filter(([key])=>key.startsWith('attempts/')).map(([,value])=>value));
  assert.ok(carried>0,'Selecting a shape must display the original carrying cursor');
  assert.ok(attempts.reduce((sum,c)=>sum+c.total,0)>0,'Sorting must record graded attempts');
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'artifacts/sorting-playthrough.png'});
  fs.writeFileSync('artifacts/sorting-playthrough.json',JSON.stringify({records,carried,errors},null,2));
  console.log('PASS: original sorting controls carry objects, drop them into bins, and record graded attempts.');
}finally{await browser.close();}
