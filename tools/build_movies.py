from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess

ROOT = Path(__file__).resolve().parents[1]
NAMES = {96: 'js_all.smk', 97: 'mixkamov.smk', 98: 'js_pre.smk', 100: 'mix_os.smk', 101: 'mix_cv.smk', 102: 'mix_cw.smk', 103: 'mix_ms.smk', 104: 'mix_ln.smk', 105: 'mix_ak.smk', 106: 'mix_mn.smk', 107: 'mix_rl.smk', 108: 'mix_sl.smk', 109: 'mix_sm.smk', 110: 'mix_li.smk'}
FILES = {p.name.lower(): p for p in (ROOT / 'disc/PRSCHOOL/cubcs').iterdir()}
OUT = ROOT / 'web/assets/movies'
OUT.mkdir(parents=True, exist_ok=True)

def encode(item):
    ident, name = item
    target = OUT / f'{ident}.webm'
    if target.exists():
        return
    temporary = OUT / f'{ident}.building.webm'
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(FILES[name]), '-threads', '2', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32', '-c:a', 'libopus', str(temporary)], check=True)
    temporary.replace(target)
    print(f'Movie {ident} converted', flush=True)

with ThreadPoolExecutor(max_workers=3) as workers:
    list(workers.map(encode, NAMES.items()))
