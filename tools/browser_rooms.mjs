import {chromium} from 'playwright';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1000,height:850}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8099');
await page.waitForFunction(()=>!document.querySelector('#start').disabled,{timeout:60000});
async function advance(count){await page.evaluate(count=>{for(let i=0;i<count;i++){engine.vm.instructions=0;engine.tick();if(engine.movie){const id=engine.movie;document.querySelector('#movie').pause();document.querySelector('#movie').style.display='none';document.querySelector('#skip').hidden=true;engine.movie=0;engine.event(31,[id]);}}},count);}
const results=[];
for(const [id,x,y] of [[1,411,144],[2,475,400],[3,127,180],[4,85,378],[5,615,399],[6,538,172],[7,436,272],[8,306,235],[9,629,226],[10,187,146]]){
  try{
    await page.evaluate(()=>localStorage.removeItem('preschool-profiles'));
    await page.locator('#start').click();await advance(100);
    await page.locator('#game').click({position:{x:260,y:150}});
    await page.keyboard.type('Browser tester');
    await page.keyboard.press('Enter');await advance(200);
    await page.waitForTimeout(250);
    await page.locator('#game').click({position:{x:330,y:260}});await advance(100);await page.waitForTimeout(250);
    if(await page.evaluate(()=>engine.bank.id)!==12)throw new Error('Original school door did not reach the classroom');
    await page.locator('#game').click({position:{x,y}});await advance(1000);
    const reached=await page.evaluate(()=>engine.bank.id);if(reached!==id)throw new Error(`Classroom control reached ${reached}; expected ${id}`);
    await page.waitForTimeout(500);
    await page.screenshot({path:`artifacts/room-${id}.png`});
    const targets=await page.evaluate(()=>{
      const out=[];
      for(const id of engine.buttons){if([30044,30088,30134,30143,30153,2002].includes(id))continue;const b=engine.resource('BUTN',id);if(!b)continue;const d=new DataView(b.buffer,b.byteOffset,b.byteLength),kind=d.getUint16(0,true)&4095;
        if(kind===4){for(let i=0;i<d.getUint16(14,true);i++){const rid=d.getUint16(16+i*2,true),s=[...engine.sprites.values()].find(s=>s.id===rid);if(s)out.push({id,x:s.x+s.width/2,y:s.y+s.height/2});}}
        else if(kind===0||kind===1)out.push({id,x:(d.getInt16(16,true)+d.getInt16(20,true))/2,y:(d.getInt16(18,true)+d.getInt16(22,true))/2});
      }return out.filter(p=>p.x>=0&&p.x<640&&p.y>=0&&p.y<400).slice(0,5);
    });
    for(const p of targets){await page.locator('#game').click({position:{x:p.x,y:p.y}});await advance(1000);}
    const status=await page.locator('#status').textContent();
    results.push({id,status,targets,bank:await page.evaluate(()=>engine.bank.id)});
    await page.screenshot({path:`artifacts/room-${id}-interacted.png`});
    if(status.startsWith('Runtime stopped'))break;
  }catch(error){results.push({id,error:error.message});break;}
}
fs.writeFileSync('artifacts/browser-rooms.json',JSON.stringify({results,errors},null,2));
console.log(JSON.stringify({results,errors},null,2));await browser.close();
if(errors.length||results.length!==10||results.some(result=>result.error||result.status?.startsWith('Runtime stopped')))throw new Error('An original classroom activity check failed; see artifacts/browser-rooms.json');
