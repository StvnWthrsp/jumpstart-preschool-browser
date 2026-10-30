# JumpStart Preschool Browser

A browser port of **JumpStart Preschool (1999)**. A replacement JavaScript engine runs the game's original scripts, graphics, sound and movies using Canvas, Web Audio and HTML video. This is an engine reimplementation, not a recompilation of recovered C++ source.

## Run the server

Requires Python 3. Converted runtime assets are included; no ISO, build step, Windows installation or npm dependencies are needed to play.

```sh
git clone https://github.com/StvnWthrsp/jumpstart-preschool-browser.git
cd jumpstart-preschool-browser
python3 tools/serve.py
```

The server listens on **127.0.0.1:8099**. Keep that terminal running; Ctrl+C stops it. With Node.js installed, `npm start` runs the same server. To use another port, run `python3 -m http.server 8100 --bind 127.0.0.1 --directory web`.

## Run the client

Open **http://127.0.0.1:8099** in a modern desktop browser (tested with Chromium). Use the server URL; opening `index.html` directly will not work.

Click **Start game**, enter a player name and press Enter. Click the school door, then an activity in the classroom. You can skip movies and use the original bottom blocks or **Return to classroom**. Picking up an item is click-to-carry, then click-to-place.

Player names and progress are saved in this browser's local storage. There is no account service or cloud sync. Changing browsers, ports or clearing site data creates a separate save.

## Known issues

- Printing is disabled. Several less-used graphics, text and database services remain provisional; see [compatibility notes](docs/reverse-engineering.md#compatibility-work-remaining).
- Every activity launches, but completion at every difficulty and comparison against a running Windows copy remain unverified.
- An unsupported operation may stop the runtime with an on-screen diagnostic. Reload and restart if needed.
- The client loads substantial resource metadata at startup. The repository includes about 297 MB of runtime assets.

Sign-in focus, Pierre's asset-loading flicker, bottom-block crashes and invisible carried items have regression coverage.

## Development and checks

Requires Node.js 22+ and Python 3:

```sh
npm ci
npm test
npm run test:browser
npm run test:rooms
npm run test:sorting
npm run test:regressions
npm run test:toolbar
npm run test:cursor
```

Browser checks require the server above, Playwright (installed by `npm ci`), and Chromium at `/usr/bin/chromium`. Run them from the repository root. Reports/screenshots are written to ignored `artifacts/`. GitHub Actions runs the unit and decoder checks.

## Rebuild assets from the original disc (optional)

Install `bsdtar` and FFmpeg with VP9/Opus support, then:

```sh
mkdir -p disc
bsdtar -xf "$HOME/Downloads/JumpStart Presch.iso" -C disc
npm run build
```

The build regenerates resource metadata, PNGs, font atlases and WebM movies. Delete `web/assets/movies/` first if you need to reconvert existing movies. The ISO, raw disc extraction, research tool installations and native decompiler exports are not included. REA/Ghidra are research tools, not runtime requirements.

This repository includes converted original game assets for reproducible playback. Research evidence and remaining engine work are documented in [reverse-engineering notes](docs/reverse-engineering.md).
