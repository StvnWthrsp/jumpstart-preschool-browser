from pathlib import Path
import hashlib, struct, json
from resources import archive, unpack_rle, png

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'web/assets/fonts'
OUT.mkdir(parents=True, exist_ok=True)
manifest = {}
seen = set()
for path in sorted((ROOT / 'disc/PRSCHOOL').rglob('*')):
    if path.suffix.lower() != '.rsc': continue
    bank = path.stem.lower()
    resources = archive(path)
    palette = next(iter(resources.get('CTBL', {}).values()), b'')[2:770]
    for rid, data in resources.get('UFI1', {}).items():
        digest = hashlib.sha256(data+palette).hexdigest()[:16]
        manifest[f'{bank}:{rid & 65535}'] = digest
        if digest in seen: continue
        seen.add(digest)
        assert data[:8] in [b'AMIF1.0\0', b'KARF1.0\0']
        count = struct.unpack_from('<H', data, 8)[0]
        mode = struct.unpack_from('<b', data, 11)[0]
        glyphs = {}; bitmaps = {}; pos = 13
        for i in range(count):
            char,w,h,left,right,baseline,_ = struct.unpack_from('<HBBbbbB', data, pos); pos += 8
            if data[:4] == b'AMIF':
                size = struct.unpack_from('<I', data, pos)[0]; pos += 4
                glyph = unpack_rle(data[pos:pos+size],w,h) if w*h else b''; pos += size
            else:
                size = w*h if mode>=3 else (w*h+7)//8
                raw = data[pos:pos+size]; pos += size
                glyph = raw if mode>=3 else bytes(49 if raw[n//8]&(128>>(n%8)) else 0 for n in range(w*h))
            glyphs[char] = {'width':w,'height':h,'left':left,'right':right,'baseline':baseline,'advance':left+w+right}
            bitmaps[char] = glyph
        assert pos<=len(data),(bank,rid,pos,len(data))
        cell_w=max(g['width'] for g in glyphs.values()) or 1
        cell_h=max(g['height'] for g in glyphs.values()) or 1
        width,height=cell_w*16,cell_h*((count+15)//16)
        pixels=bytearray(width*height)
        for i,(char,g) in enumerate(glyphs.items()):
            x,y=(i%16)*cell_w,(i//16)*cell_h
            g.update(x=x,y=y)
            for row in range(g['height']):
                offset=(y+row)*width+x
                pixels[offset:offset+g['width']]=bitmaps[char][row*g['width']:(row+1)*g['width']]
        # png() flips its input; the atlas above is already arranged top down.
        rows = b''.join(pixels[y*width:(y+1)*width] for y in reversed(range(height)))
        (OUT/f'{digest}.png').write_bytes(png(width,height,rows,palette))
        (OUT/f'{digest}.json').write_text(json.dumps({'height':data[10],'glyphs':glyphs,'palette':list(palette)},separators=(',',':')))
(OUT/'manifest.json').write_text(json.dumps(manifest))
print(f'{len(manifest)} font references, {len(seen)} unique atlases')
