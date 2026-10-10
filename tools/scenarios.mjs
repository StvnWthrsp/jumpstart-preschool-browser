import fs from 'node:fs';
import {PlayEngine,decodeBank} from '../web/engine.js';
const banks=new Map();
for(const path of fs.readdirSync(new URL('../web/assets/',import.meta.url)))if(path.startsWith('cub')){const bank=decodeBank(JSON.parse(fs.readFileSync(new URL(`../web/assets/${path}/bank.json`,import.meta.url))));banks.set(bank.id,bank);}
const results=[];
for(const id of [200,11,1,2,3,4,5,6,7,8,9,10,12]){
  const engine=new PlayEngine(banks);
  try{
    engine.activate(99);
    for(let i=0;i<100;i++){engine.tick();if(engine.movie){const movie=engine.movie;engine.movie=0;engine.event(31,[movie]);}}
    if(id!==200)engine.event(110,[200,id]);
    for(let i=0;i<300;i++){engine.vm.instructions=0;engine.tick();}
    results.push({id,bank:engine.bank.id,sprites:engine.sprites.size,buttons:[...engine.buttons],animations:engine.animations.size});
  }catch(error){results.push({id,bank:engine.bank.id,error:error.message,trace:engine.trace.slice(-4)});}
}
console.log(JSON.stringify(results,null,2));
