import fs from 'node:fs';
import {PlayEngine} from '../web/engine.js';
const banks=new Map();
for(const path of fs.readdirSync('web/assets'))if(path.startsWith('cub')){const bank=JSON.parse(fs.readFileSync(`web/assets/${path}/bank.json`));banks.set(bank.id,bank);}
function advance(engine,count){for(let i=0;i<count;i++){engine.vm.instructions=0;engine.tick();if(engine.movie){const id=engine.movie;engine.movie=0;engine.event(31,[id]);}}}
export function signIn(engine){
  engine.activate(99);advance(engine,100);engine.event(10,[1059,0]);
  for(const char of 'Browser tester'){engine.event(5,[char.toUpperCase().charCodeAt(0),1,0]);engine.event(6,[char.charCodeAt(0),1,0]);}
  engine.event(5,[13,1,0]);engine.event(6,[13,1,0]);advance(engine,200);
}
for(let sprite=Number(process.argv[2]||3154);sprite<=Number(process.argv[3]||3185);sprite++){
  const engine=new PlayEngine(banks);
  try{signIn(engine);engine.event(10,[2002,sprite]);engine.event(11,[2002,sprite]);engine.event(12,[2002,sprite]);const clickTrace=engine.trace.slice(-35);advance(engine,100);console.log(JSON.stringify({sprite,bank:engine.bank.id,transition:engine.trace.filter(e=>[110,35013].includes(e.id)),...(process.argv[2]?{clickTrace,globals:[13096,228,3388,128].map(a=>[a,engine.vm.read(a)])}:{})}));}
  catch(error){console.log(JSON.stringify({sprite,error:error.message}));}
}
