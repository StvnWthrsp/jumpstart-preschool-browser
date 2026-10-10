export class Profiles {
  constructor(vm,records={},changed=()=>{}){this.vm=vm;this.records=records;this.changed=changed;this.current='';this.names=[];this.index=-1;}
  day(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  setLevel(fields,category,activity,level){const key=`level/${category}/${activity}`,previous=fields[key]||1;if(level===previous)return 0;fields[key]=level;fields[`epoch/${category}/${activity}`]=(fields[`epoch/${category}/${activity}`]||0)+1;this.changed(this.records);return 1;}
  handle(id,a){
    const vm=this.vm,text=n=>vm.text(n).split('\0')[0];
    if(id===38500){this.current=text(a[0]);if(!this.current)return 0;if(!Object.hasOwn(this.records,this.current))Object.defineProperty(this.records,this.current,{value:Object.create(null),writable:true,enumerable:true,configurable:true});this.changed(this.records);return 1;}
    if(id===38501){this.current='';return 1;}
    if(id===38594)return 1;
    if(id===38590){this.names=Object.keys(this.records);this.index=-1;return 1;}
    if(id===38591)return Number(++this.index<this.names.length);
    if(id===38592){const name=this.names[this.index];if(name===undefined)return 0;vm.write(a[0],vm.string(name));return 1;}
    if(id===38593){const name=text(a[0]);if(!Object.hasOwn(this.records,name))return 0;delete this.records[name];this.changed(this.records);return 1;}
    if(id===38570||id===38571){const fields=this.records[this.current];if(!fields)return 0;const category=text(a[0]),activity=text(a[1]),level=fields[`level/${category}/${activity}`]||1,epoch=fields[`epoch/${category}/${activity}`]||0;const key=`attempts/${category}/${activity}/${level}/${epoch}/${this.day()}`;const counts=fields[key]||{total:0,correct:0};counts.total++;if(id===38570)counts.correct++;fields[key]=counts;this.changed(this.records);return 1;}
    if(id===38572||id===38573){const fields=this.records[this.current];if(!fields)return 0;const category=text(a[0]),activity=text(a[1]),level=fields[`level/${category}/${activity}`]||1;if(id===38572){vm.write(a[2],level,5);return 1;}return this.setLevel(fields,category,activity,a[2]);}
    if(id===38574){const fields=this.records[this.current];if(!fields)return 0;const category=text(a[0]),activity=text(a[1]),level=fields[`level/${category}/${activity}`]||1,epoch=fields[`epoch/${category}/${activity}`]||0,prefix=`attempts/${category}/${activity}/${level}/${epoch}/`;const days=Object.entries(fields).filter(([key])=>key.startsWith(prefix)).sort(([a],[b])=>b.localeCompare(a));let upTotal=0,upCorrect=0,downTotal=0,downCorrect=0;
      for(const [,counts]of days){if(upTotal<a[3]){upTotal+=counts.total;upCorrect+=counts.correct;}if(downTotal<a[5]){downTotal+=counts.total;downCorrect+=counts.correct;}}
      let next=level;if(level<a[2]&&upTotal>=a[3]&&upTotal&&upCorrect*100/upTotal>=a[4])next=level+1;if(level>1&&downTotal>=a[5]&&downTotal&&downCorrect*100/downTotal<=a[6])next=level-1;
      vm.write(a[7],level,5);vm.write(a[8],next,5);this.setLevel(fields,category,activity,next);return 1;
    }
    if(id>=38580&&id<=38583){const fields=this.records[this.current];if(!fields)return 0;const prefix=`attempts/${text(a[0])}/${text(a[1])}/`,byLevel=id===38581||id===38583,byDate=id===38582||id===38583,offset=2+Number(byLevel),date=byDate?`${a[offset+2]}-${String(a[offset+1]).padStart(2,'0')}-${String(a[offset]).padStart(2,'0')}`:null;let total=0,correct=0;
      for(const [key,counts]of Object.entries(fields)){if(!key.startsWith(prefix))continue;const [level,,day]=key.slice(prefix.length).split('/');if(byLevel&&Number(level)!==a[2]||byDate&&day!==date)continue;total+=counts.total;correct+=counts.correct;}
      const output=offset+(byDate?3:0);vm.write(a[output],total);vm.write(a[output+1],correct);return 1;
    }
    const single=id>=38510&&id<=38525,paired=id>=38540&&id<=38555;
    if(single||paired){
      const offset=single?1:2,key=single?text(a[0]):`${text(a[0])}/${text(a[1])}`;
      const fields=this.records[this.current];if(!fields)return 0;
      const write=single?id>=38520:id>=38550,type=id-(single?(write?38520:38510):(write?38550:38540));
      if(type>5)throw new Error(`Unsupported profile field ${id}`);
      if(write){Object.defineProperty(fields,key,{value:type===5?text(a[offset]):type===4?a.slice(offset,offset+3):a[offset],writable:true,enumerable:true,configurable:true});this.changed(this.records);return 1;}
      const value=Object.hasOwn(fields,key)?fields[key]:undefined;
      if(type===5)vm.write(a[offset],vm.string(value||''));
      else if(type===4)(value||[0,0,0]).forEach((v,i)=>vm.write(a[offset+i],v));
      else vm.write(a[offset],value||0,type===0?1:type===1?5:2);
      return Number(value!==undefined);
    }
    if(id===38530||id===38560){const fields=this.records[this.current];if(!fields)return 0;delete fields[text(a[0])];this.changed(this.records);return 1;}
    return undefined;
  }
}
