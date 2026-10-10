import sys, struct
from pathlib import Path
from resources import archive

bank, ident = map(int, sys.argv[1:3])
path = next(p for p in Path('disc/PRSCHOOL').rglob('*') if p.suffix.lower()=='.rsc' and int(p.stem[3:6])==bank)
data = next(v for k,v in archive(path)['SCRP'].items() if k&65535==ident)
print('length/local bytes/argument bytes:',struct.unpack_from('<4I',data))
pos=16
while pos<len(data):
    start=pos;op,descriptor=data[pos:pos+2];pos+=2;args=[]
    for i in range(descriptor&15):
        kind,value=struct.unpack_from('<Bi',data,pos);pos+=5;args.append((kind,value))
    print(f'{start-16:5} {op:02x} type={descriptor>>4} {args}')
