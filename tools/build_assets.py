from pathlib import Path
import base64
import collections
import json
import struct
from resources import archive, bitmap, png, bundle

ROOT = Path(__file__).resolve().parents[1]


def main():
    output = ROOT / 'web/assets'
    output.mkdir(parents=True, exist_ok=True)
    manifest = []
    palette = None
    total = collections.Counter()
    for path in sorted((ROOT / 'disc/PRSCHOOL').rglob('*')):
        if path.suffix.lower() != '.rsc':
            continue
        resources = archive(path)
        bank = path.stem.lower()
        bank_id = int(bank[3:6])
        palette = next(iter(resources.get('CTBL', {}).values()), b'')[2:770] or palette
        directory = output / bank
        directory.mkdir(exist_ok=True)
        images = {}
        background = None
        for rid, data in resources.get('BMAP', {}).items():
            width, height, pixels, flags, restore = bitmap(data, with_restore=True)
            (directory / f'{rid}.png').write_bytes(png(width, height, pixels, palette, bool(flags & 255)))
            images[rid] = {'width': width, 'height': height, 'flags': flags}
            if any(restore):
                mask = f'{rid}-restore'
                (directory / f'{mask}.png').write_bytes(png(width, height, restore, bytes([255]) * 768))
                images[rid]['restore'] = mask
            if flags == 0 and width == 640 and height == 480:
                background = rid
        encoded = {tag: {rid: base64.b64encode(data).decode() for rid, data in members.items()}
                   for tag, members in resources.items() if tag != 'BMAP'}
        bundles = {}
        for parent, data in resources.get('ANIM', {}).items():
            members = bundle(data)
            if members is None:
                continue
            nested_images = {}
            for rid, data in members.get('BMAP', {}).items():
                width, height, pixels, flags, restore = bitmap(data, with_restore=True)
                name = f'{parent}-{rid}'
                (directory / f'{name}.png').write_bytes(png(width, height, pixels, palette, bool(flags & 255)))
                nested_images[rid] = {'width': width, 'height': height, 'flags': flags, 'file': name}
                if any(restore):
                    mask = f'{name}-restore'
                    (directory / f'{mask}.png').write_bytes(png(width, height, restore, bytes([255]) * 768))
                    nested_images[rid]['restore'] = mask
                total['nested_BMAP'] += 1
            nested = {tag: {rid: base64.b64encode(data).decode() for rid, data in values.items()}
                      for tag, values in members.items() if tag != 'BMAP'}
            bundles[parent & 65535] = {'images': nested_images, 'resources': nested}
        bank_data = {'id': bank_id, 'bank': bank, 'images': images, 'background': background, 'resources': encoded, 'bundles': bundles}
        (directory / 'bank.json').write_text(json.dumps(bank_data, separators=(',', ':')))
        counts = {tag: len(members) for tag, members in resources.items()}
        manifest.append({'id': bank_id, 'bank': bank, 'background': background, 'counts': counts})
        total.update(counts)
    (output / 'manifest.json').write_text(json.dumps({'banks': manifest, 'counts': total}, indent=2))
    print(json.dumps(total, indent=2))


if __name__ == '__main__':
    main()
