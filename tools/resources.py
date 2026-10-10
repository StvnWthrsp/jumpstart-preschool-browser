"""Read the Play 4 LBRC archives on the Preschool 1999 disc."""
from pathlib import Path
import struct


def archive(path):
    data = Path(path).read_bytes()
    assert data[:4] == b'LBRC'
    count = struct.unpack_from('<I', data, 16)[0]
    sections = [struct.unpack_from('<4sI', data, 32 + i * 8) for i in range(count)]
    result = {}
    for i, (tag, offset) in enumerate(sections):
        end = sections[i + 1][1] if i + 1 < count else struct.unpack_from('<I', data, 4)[0] - 32
        assert (end - offset) % 20 == 0
        entries = {}
        for pos in range(offset + 32, end + 32, 20):
            start, size, reserved, resource_id, flags = struct.unpack_from('<5I', data, pos)
            if not size:
                continue
            start += 16
            assert start + size <= len(data) + 16
            assert resource_id not in entries
            entries[resource_id] = data[start:start + size]
        result[tag.decode().strip()] = entries
    return result


def unpack_lz(data, expected):
    """Translate native decoder 0x414690: interleaved LSB-first control words."""
    pos = 0
    control = 0
    bits = 0
    out = bytearray()

    def bit():
        nonlocal pos, control, bits
        if bits == 0:
            control = struct.unpack_from('<H', data, pos)[0]
            pos += 2
            bits = 16
        value = control & 1
        control >>= 1
        bits -= 1
        return value

    while True:
        if bit():
            out.append(data[pos])
            pos += 1
        else:
            if bit():
                low, high = data[pos:pos + 2]
                pos += 2
                distance = ((high & 248) << 5 | low) + 1
                length = high & 7
                if length == 0:
                    length = data[pos]
                    pos += 1
                    if length == 0:
                        break
                    length -= 2
                length += 2
            else:
                length = (bit() << 1 | bit()) + 2
                distance = data[pos] + 1
                pos += 1
            assert distance <= len(out)
            for _ in range(length):
                out.append(out[-distance])
        assert len(out) <= expected
    assert len(out) == expected, (len(out), expected)
    return bytes(out)


def bundle(data):
    if data[:4] != b'ANIM':
        return None
    first = struct.unpack_from('<I', data, 4)[0]
    tags = [struct.unpack_from('<4sI', data, pos) for pos in range(0, first, 8)]
    result = {}
    for tag, offset in tags:
        entries = {}
        while True:
            start, size, reserved, rid, flags = struct.unpack_from('<5I', data, offset)
            if not rid:
                break
            start -= 16
            assert start >= 0 and start + size <= len(data)
            payload = data[start:start + size]
            entries[rid] = entries.get(rid, b'') + payload if tag == b'WAVE' else payload
            offset += 20
        result[tag.decode().strip()] = entries
    return result


def bitmap(data, with_restore=False):
    flags, height, width, size = struct.unpack_from('<HHHI', data)
    kind = flags & 255
    restore = bytes(width * height)
    if kind == 0:
        pixels = data[10:10 + size]
    elif kind == 5:
        pixels = unpack_lz(data[10:], width * height)
    elif kind == 4:
        unpacked_size = struct.unpack_from('<I', data, 10)[0]
        packed = unpack_lz(data[14:], unpacked_size)
        pixels, restore = unpack_rle(packed, width, height, with_restore=True)
    else:
        raise ValueError(f'unsupported bitmap encoding {kind}')
    assert len(pixels) == width * height
    return (width, height, pixels, flags, restore) if with_restore else (width, height, pixels, flags)


def unpack_rle(packed, width, height, with_restore=False):
    colors = packed[0]
    table_size = struct.unpack_from('<H', packed, colors + 1)[0]
    pos = colors + 3 + table_size
    rows = []
    masks = []
    for y in range(height):
        length = struct.unpack_from('<H', packed, colors + 3 + 2 * y)[0] if y+1 < height else 0
        end = pos + length
        row = bytearray()
        mask = bytearray()
        while len(row) < width:
            token = packed[pos]; pos += 1
            if token < 128:
                value = packed[token + 1]
                row.append(0 if with_restore and value == 255 else value)
                mask.append(int(value == 255))
            else:
                run = packed[pos] or width - len(row); pos += 1
                if token == 255:
                    row.extend(packed[pos:pos + run]); pos += run
                    mask.extend(bytes(run))
                else:
                    value = packed[(token & 127) + 1]
                    row.extend([0 if with_restore and value == 255 else value] * run)
                    mask.extend([int(value == 255)] * run)
        assert len(row) == width
        if y + 1 < height:
            assert pos == end, (pos, end)
        rows.append(bytes(row))
        masks.append(bytes(mask))
    return (b''.join(rows), b''.join(masks)) if with_restore else b''.join(rows)


def png(width, height, pixels, palette, transparent=True):
    import zlib
    def chunk(tag, payload):
        return struct.pack('>I', len(payload)) + tag + payload + struct.pack('>I', zlib.crc32(tag + payload))
    rows = b''.join(b'\0' + pixels[y * width:(y + 1) * width] for y in reversed(range(height)))
    output = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 3, 0, 0, 0))
    output += chunk(b'PLTE', palette)
    if transparent:
        output += chunk(b'tRNS', b'\0')
    return output + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b'')
