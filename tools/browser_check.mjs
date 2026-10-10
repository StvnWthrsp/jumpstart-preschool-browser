import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1000,height:850}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
async function ready(){await page.goto('http://127.0.0.1:8099');await page.waitForFunction(()=>!document.querySelector('#start').disabled,{timeout:60000});}
async function advance(count){await page.evaluate(count=>{for(let i=0;i<count;i++){engine.vm.instructions=0;engine.tick();if(engine.movie){const id=engine.movie;engine.stopMovie();engine.movie=0;engine.event(31,[id]);}}},count);}
async function click(x,y){await page.locator('#game').click({position:{x,y}});}
try{
  await ready();await page.locator('#start').click();await advance(100);
  await click(260,150);await page.locator('#game').pressSequentially('Browser test');await page.locator('#game').press('Enter');await advance(200);
  assert.equal(await page.evaluate(()=>engine.bank.id),11);
  await page.waitForTimeout(400);await click(330,260);await advance(100);
  assert.equal(await page.evaluate(()=>engine.bank.id),12);
  await page.waitForTimeout(400);await click(187,146);await advance(1000);
  assert.equal(await page.evaluate(()=>engine.bank.id),10);
  for(let i=0;i<30;i++){const [x,y]=[[107,179],[516,195],[270,286]][i%3];await click(x,y);await advance(300);}
  const records=await page.evaluate(()=>engine.profiles.records);
  const counts=Object.values(records).flatMap(fields=>Object.entries(fields).filter(([key])=>key.startsWith('attempts/PS/Quantities/')).map(([,value])=>value));
  assert.ok(counts.reduce((sum,c)=>sum+c.correct,0)>0,'Original counting game must record correct answers');
  assert.ok(counts.reduce((sum,c)=>sum+c.total-c.correct,0)>0,'Original counting game must record incorrect answers');
  assert.ok(!(await page.locator('#status').textContent()).startsWith('Runtime stopped'));
  await page.screenshot({path:'artifacts/counting-playthrough.png'});
  await page.locator('#classroom').click();await advance(200);
  assert.equal(await page.evaluate(()=>engine.bank.id),12,'Return control must use the original classroom transition');
  await ready();await page.locator('#start').click();
  assert.deepEqual(await page.evaluate(()=>engine.profiles.records),records,'Progress must survive page reload');
  assert.deepEqual(errors,[]);
  fs.writeFileSync('artifacts/browser-playthrough.json',JSON.stringify({records,errors},null,2));
  console.log('PASS: original sign-in → school → classroom → counting rounds; correct/incorrect progress survives reload.');
}finally{await browser.close();}
