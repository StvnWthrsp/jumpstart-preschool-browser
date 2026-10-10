export class PlayVM {
  constructor(host) {
    this.host = host;
    this.memory = new DataView(new ArrayBuffer(65536));
    this.sp = 60000;
    this.strings = new Map();
    this.nextString = 1;
    this.freeStrings=[];
    this.instructions = 0;
    this.depth = 0;
  }

  string(value = []) {
    const id = this.freeStrings.pop()||this.nextString++;
    if(id>65535)throw new Error('String handle space exhausted');
    this.strings.set(id, typeof value === 'string' ? Array.from(value, c => c.charCodeAt(0)) : [...value]);
    return id;
  }

  text(id) { return String.fromCharCode(...(this.strings.get(id) || [])); }
  read(address, type = 2) {
    if (type === 1) return this.memory.getUint8(address);
    if (type === 5) return this.memory.getInt16(address, true);
    if (type === 3) return this.memory.getFloat32(address, true);
    return this.memory.getInt32(address, true);
  }
  write(address, value, type = 2) {
    if (type === 1) this.memory.setUint8(address, value);
    else if (type === 5) this.memory.setInt16(address, value, true);
    else if (type === 3) this.memory.setFloat32(address, value, true);
    else this.memory.setInt32(address, value, true);
  }
  push(value, type = 2) { this.sp -= 4; this.write(this.sp, value, type); }

  call(id, args = null) {
    const data = this.host.resource('SCRP', id);
    if (!data) throw new Error(`Missing script ${id} in bank ${this.host.bank.id}`);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const savedSP = this.sp;
    if (args) args.forEach((value, i) => this.write(savedSP - 4 * (i + 1), value));
    const frame = {registers: new DataView(new ArrayBuffer(388)), base: args !== null ? savedSP : savedSP + view.getInt32(12, true)};
    this.sp = frame.base - view.getInt32(8, true);
    for(let i=this.sp;i<frame.base-view.getInt32(12,true);i++)this.memory.setUint8(i,0);
    if (++this.depth > 100) throw new Error('Script recursion limit');
    let pc = 16;
    const operand = (kind, value) => {
      const memoryRef = address => ({get: type => this.read(address, type), set: (v, type) => this.write(address, v, type), address});
      const registerRef = index => ({
        get: type => type === 1 ? frame.registers.getUint8(index * 4) : type === 5 ? frame.registers.getInt16(index * 4, true) : type === 3 ? frame.registers.getFloat32(index * 4, true) : frame.registers.getInt32(index * 4, true),
        set: (v, type) => type === 1 ? frame.registers.setUint8(index * 4, v) : type === 5 ? frame.registers.setInt16(index * 4, v, true) : type === 3 ? frame.registers.setFloat32(index * 4, v, true) : frame.registers.setInt32(index * 4, v, true)
      });
      const ref = offset => offset < 0 ? memoryRef(frame.base + offset) : offset <= 96 ? registerRef(offset) : memoryRef(offset);
      if (kind === 1) {
        const buffer = new DataView(new ArrayBuffer(4)); buffer.setInt32(0, value, true);
        return {get: type => type === 3 ? buffer.getFloat32(0, true) : type === 5 ? buffer.getInt16(0, true) : type === 1 ? buffer.getUint8(0) : value, set: v => {value = v;}};
      }
      if (kind === 2) return ref(value);
      if (kind === 3) return ref(ref(value).get(2));
      if (kind === 4) return {get: () => value < 0 ? frame.base + value : value, set: () => {throw new Error('Write to address literal');}};
      if (kind === 5) {
        const packed = ref(value).get(2), sid = packed >>> 16, index = packed & 65535;
        return {get: () => (this.strings.get(sid) || [])[index] || 0, set: v => {const s=this.strings.get(sid); if(s) s[index]=v;}};
      }
      throw new Error(`Unknown operand ${kind}`);
    };
    try {
      while (pc < data.length) {
        if (++this.instructions > 2000000) throw new Error('Script instruction limit');
        const start = pc, op = data[pc++], descriptor = data[pc++], type = descriptor >>> 4, count = descriptor & 15;
        const parameters = [];
        for (let i = 0; i < count; i++) {
          parameters.push(operand(data[pc], view.getInt32(pc + 1, true))); pc += 5;
        }
        const get = (i, t = type) => parameters[i]?.get(t) ?? 0;
        const set = (i, value, t = type) => parameters[i]?.set(value, t);
        const a = get(0), b = get(1);
        if (op === 0) continue;
        if (op === 0x21 && type !== 8) {set(2,(a << 16)|(b & 65535),2);continue;}
        if (op === 0x30) {set(0,Math.trunc(a),2);continue;}
        if (op === 0x31) {set(0,a,3);continue;}
        if (op === 0x32) {set(0,a,1);continue;}
        if (op === 0x33) {set(0,a,type===5?2:5);continue;}
        if (op === 0x20) {const result=count?get(0,2):0;this.write(savedSP-4,result);return result;}
        if (op === 0x50 || op === 0x51 || op === 0x52) {
          const condition = frame.registers.getInt32(0, true);
          if (op === 0x50 || (op === 0x51 && !condition) || (op === 0x52 && condition)) pc += get(0, 2);
          continue;
        }
        if (op === 0x12) {
          const result = this.call(get(0, 2));
          if (count > 1) set(1, result, 2);
          continue;
        }
        if (op === 0x13) {
          const n = get(1, 2);
          const eventArgs = Array.from({length:n}, (_, i) => this.read(this.sp + 4 * (n - i - 1)));
          const result = this.host.event(get(0, 2), eventArgs);
          if (count > 2) set(2, result, 2);
          continue;
        }
        if (op === 0x40) { this.push(a, type === 8 ? 2 : type); continue; }
        if (op === 0x41) { if(count) set(0, this.read(this.sp, type === 8 ? 2 : type)); this.sp += 4; continue; }
        if (op === 0x42) { this.sp += get(0, 2) * 4; continue; }
        if (op === 0x43) { this.push(a <= 96 && a >= 0 ? a : a); continue; }
        if (type === 8) {
          if (op === 0x60) {
            const n = count > 1 ? get(1, 2) : 1;
            for(let i=0;i<n;i++) {
              if(i && parameters[0].address !== undefined) this.write(parameters[0].address+i*4,this.string());
              else if(!a) set(0,this.string(),2);
            }
          } else if (op === 0x61) {set(0,0,2);}
          else if (op === 3) set(0,this.string(this.strings.get(b)||[]),2);
          else if (op === 4) {const sid=a||this.string();this.strings.set(sid,[...(this.strings.get(a)||[]),...(this.strings.get(b)||[])]);set(0,sid,2);}
          else if (op === 0x18 || op === 0x19) set(0,Number((this.text(a)===this.text(b)) === (op===0x18)),2);
          else if (op === 0x21) set(0, (a << 16) | (b & 65535), 2);
          else if (op === 0xe1) {
            const length = get(1,2), bytes = [];
            while(bytes.length < length) {
              if(data[pc] !== 0xe0) throw new Error(`String literal at ${pc}`);
              const n=data[pc+1]&15;
              for(let i=0;i<n;i++) for(let j=0;j<4;j++) bytes.push(data[pc+3+i*5+j]);
              pc+=2+n*5;
            }
            set(0,this.string(String.fromCharCode(...bytes.slice(0,length))),2);
          } else throw new Error(`String opcode ${op.toString(16)} at ${id}:${start}`);
          continue;
        }
        if (op === 0x70) { if(count>1) set(1,(this.strings.get(get(0,2))||[]).length,2); continue; }
        if (op === 0x71) {const source=this.strings.get(get(0,2))||[],sid=get(1,2),part=source.slice(Math.max(0,get(2,2)),get(3,2)+1);this.strings.set(sid,part);if(count>4)set(4,part.length,2);continue;}
        if (op === 0x72) {const source=this.strings.get(get(0,2))||[],sid=get(1,2),target=this.strings.get(sid)||[];target.splice(Math.max(0,Math.min(target.length,get(2,2))),0,...source);this.strings.set(sid,target);if(count>3)set(3,source.length,2);continue;}
        if (op === 0x73) {const sid=get(0,2),target=this.strings.get(sid)||[],from=Math.max(0,get(1,2)),to=Math.min(target.length-1,get(2,2));const removed=to>=from?target.splice(from,to-from+1).length:0;this.strings.set(sid,target);if(count>3)set(3,removed,2);continue;}
        if (op === 0x74) {
          const sid=get(0,2)||this.string(), length=get(1,2), s=this.strings.get(sid)||[];set(0,sid,2);
          s.length=length; for(let i=0;i<length;i++) if(s[i]===undefined)s[i]=0;
          this.strings.set(sid,s); if(count>2)set(2,1,2); continue;
        }
        let result;
        switch(op) {
          case 1: result=a+1;break;
          case 2: result=a-1;break;
          case 3: result=b;break;
          case 4: result=a+b;break;
          case 5: result=a-b;break;
          case 6: result=a*b;break;
          case 7: result=type===3?a/b:Math.trunc(a/b);break;
          case 8: result=a%b;break;
          case 9: result=Math.abs(a);break;
          case 10: result=Math.sign(a);break;
          case 11: result=-a;break;
          case 12: result=Number(a&&b);break;
          case 13: result=Number(a||b);break;
          case 14: result=Number(Boolean(a)!==Boolean(b));break;
          case 15: result=Number(!a);break;
          case 0x11: result=a+Math.floor(Math.random()*(b-a+1));break;
          case 0x14: result=Number(a>b);break;
          case 0x15: result=Number(a>=b);break;
          case 0x16: result=Number(a<b);break;
          case 0x17: result=Number(a<=b);break;
          case 0x18: result=Number(a===b);break;
          case 0x19: result=Number(a!==b);break;
          case 0x22: result=~a;break;
          case 0x23: result=a&b;break;
          case 0x24: result=a|b;break;
          case 0x25: result=a^b;break;
          default: throw new Error(`Opcode ${op.toString(16)} type ${type} at script ${id}:${start-16}`);
        }
        set(0,result,op>=12&&op<=15 || op>=0x14&&op<=0x19 ? 2 : type);
      }
      return 0;
    } catch(error) {
      error.message += ` <- ${this.host.bank.id}:${id}@${pc-16}`;
      throw error;
    } finally {this.sp=savedSP;this.depth--;}
  }

  collectStrings(){
    if(this.depth)return;
    const live=new Set();
    const roots=[this.memory,...[...(this.host.saves?.values()||[])].map(bytes=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength))];
    for(const memory of roots)for(let i=0;i<=memory.byteLength-4;i++){const value=memory.getUint32(i,true);if(this.strings.has(value))live.add(value);if(this.strings.has(value>>>16))live.add(value>>>16);}
    for(const id of this.strings.keys())if(!live.has(id)){this.strings.delete(id);this.freeStrings.push(id);}
  }
}
