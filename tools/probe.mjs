import fs from 'node:fs';
import {PlayEngine,decodeBank} from '../web/engine.js';
const paths=fs.readdirSync(new URL('../web/assets/',import.meta.url));
const banks=new Map();
for(const path of paths)if(path.startsWith('cub')) {const bank=decodeBank(JSON.parse(fs.readFileSync(new URL(`../web/assets/${path}/bank.json`,import.meta.url))));banks.set(bank.id,bank);}
const engine=new PlayEngine(banks);
try {engine.activate(Number(process.argv[2]||99));for(let i=0;i<100;i++){engine.tick();if(engine.movie){const id=engine.movie;engine.movie=0;engine.event(31,[id]);}}}catch(error){console.log(error.stack);}
console.log(JSON.stringify({bank:engine.bank.id,sprites:engine.sprites.size,animations:engine.animations.size,buttons:[...engine.buttons],trace:engine.trace.slice(-20)},null,2));
