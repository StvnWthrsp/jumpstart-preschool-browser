import {boot,advance} from './harness.mjs';
for(const [button,sprite]of [[2133,0],[2136,0],[2139,0],[2141,0],[2142,0],[2474,2143],[2475,0],[2476,2154],[2477,2183],[2478,2452],[2480,0]]){
  try{
    const engine=boot();engine.event(10,[1573,1574]);advance(engine,100);
    if(engine.bank.id!==12)throw new Error(`School door reached ${engine.bank.id}`);
    engine.event(10,[button,sprite]);engine.event(11,[button,sprite]);
    const clickTrace=engine.trace.slice(-40);advance(engine,150);
    console.log(JSON.stringify({button,sprite,bank:engine.bank.id,clickTrace}));
  }catch(error){console.log(JSON.stringify({button,error:error.message}));}
}
