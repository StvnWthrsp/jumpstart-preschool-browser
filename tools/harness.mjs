import fs from 'node:fs';
import {PlayEngine} from '../web/engine.js';
export const banks=new Map();
for(const path of fs.readdirSync('web/assets'))if(path.startsWith('cub')){const bank=JSON.parse(fs.readFileSync(`web/assets/${path}/bank.json`));banks.set(bank.id,bank);}
export function advance(engine,count){for(let i=0;i<count;i++){engine.vm.instructions=0;engine.tick();if(engine.movie){const id=engine.movie;engine.movie=0;engine.event(31,[id]);}}}
export function boot(){
  const engine=new PlayEngine(banks);engine.activate(99);advance(engine,100);engine.event(10,[1059,0]);
  for(const char of 'Browser tester'){engine.event(5,[char.toUpperCase().charCodeAt(0),1,0]);engine.event(6,[char.charCodeAt(0),1,0]);}
  engine.event(5,[13,1,0]);engine.event(6,[13,1,0]);advance(engine,200);
  if(engine.bank.id!==11)throw new Error(`Sign-in reached unexpected library ${engine.bank.id}`);
  return engine;
}
