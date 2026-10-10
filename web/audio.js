const STEPS=[7,8,9,10,11,12,13,14,16,17,19,21,23,25,28,31,34,37,41,45,50,55,60,66,73,80,88,97,107,118,130,143,157,173,190,209,230,253,279,307,337,371,408,449,494,544,598,658,724,796,876,963,1060,1166,1282,1411,1552,1707,1878,2066,2272,2499,2749,3024,3327,3660,4026,4428,4871,5358,5894,6484,7132,7845,8630,9493,10442,11487,12635,13899,15289,16818,18500,20350,22385,24623,27086,29794,32767];
const DELTA=[-1,-1,-1,-1,2,4,6,8];
export function decodeADP(data) {
  const d=new DataView(data.buffer,data.byteOffset,data.byteLength);
  if(new TextDecoder().decode(data.subarray(0,4))!=='ADP1')throw new Error('Unsupported sound format');
  const channels=d.getUint16(20,true),rate=d.getUint32(16,true),start=16+d.getUint32(12,true);
  if(channels!==1&&channels!==2)throw new Error(`Unsupported sound channels ${channels}`);
  const state=Array.from({length:channels},(_,c)=>({value:d.getInt16(22+4*c,true),index:d.getInt16(24+4*c,true)}));
  const samples=Array.from({length:channels},()=>[]);
  const nibble=(n,c)=>{const s=state[c],step=STEPS[s.index]??8;s.index=Math.max(0,Math.min(88,s.index+DELTA[n&7]));let delta=(step>>3)+((n&4)?step:0)+((n&2)?step>>1:0)+((n&1)?step>>2:0);s.value=Math.max(-32768,Math.min(32767,s.value+((n&8)?-delta:delta)));samples[c].push(s.value/32768);};
  for(let i=start;i<data.length;i++){nibble(data[i]&15,0);nibble(data[i]>>4,channels-1);}
  return {rate,channels,samples:samples.map(s=>Float32Array.from(s))};
}
