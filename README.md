# JumpStart Preschool (1999) browser port

Playable local replacement for the disc's Windows Play 4.0 engine. It executes the original SCRP bytecode and EVNT/ANIM resources using JavaScript, Canvas, Web Audio and HTML video. This is an engine reimplementation, not a recompilation of recovered C++ source.

Local preview: http://127.0.0.1:8099. Click **Start game**, enter a name and press Enter. Open the school door to reach the classroom, then click an activity. **Return to classroom** uses the original transition script. You can skip opening movies. Sorting uses the original click-to-pick-up, click-to-place controls; selected objects follow the pointer. Player records and learning progress stay in this browser's local storage.

## Build from your disc

Requires Python 3, Node.js, `bsdtar`, and FFmpeg with VP9/Opus support. Asset conversion uses Python's standard library; Pillow is only needed for optional inspection tooling. Run commands from this directory:

```sh
mkdir -p disc
bsdtar -xf "$HOME/Downloads/JumpStart Presch.iso" -C disc
npm ci
npm run build
npm start
```

The build extracts the 20 resource libraries, writes PNGs and resource metadata, exports font atlases, and converts the 14 Smacker movies. The first build takes several minutes. No Wine or Windows virtual machine is required for the browser runtime. Ghidra and REA are research tools, not runtime dependencies.

```sh
npm test
npm run test:rooms
npm run test:browser
npm run test:sorting
npm run test:regressions
npm run test:toolbar
npm run test:cursor
python3 tools/disassemble.py 11 1000
```

The browser check uses `/usr/bin/chromium` through Playwright and expects the local server to be running. Captures and diagnostic reports live in `artifacts/`.

The regression check creates a new player alongside an existing profile using ordinary keyboard input after a mouse click. It also delays PNG requests in Paper Activities and verifies that incomplete replacement frames cannot clear Pierre or other visible assets. The renderer retains the last complete frame while bitmaps and font atlases load.

The toolbar check clicks all nine bottom blocks in the classroom and each of its ten activities. It verifies the enabled shared controls receive their intended button events, activity back blocks return to the classroom, and callbacks continue without losing the current resource library. Shared button state survives activity changes, including the startup script's disabling of an obsolete toolbar.

The cursor check verifies the sign-in pointer and actual carried-item pixels in sorting and kitchen. It moves the pointer to two locations and compares the canvas against the original bitmap composited at its hotspot. Carried items update on pointer movement; cursor show/hide follows the original engine commands.

## Current status

Verified in headless Chromium: original startup and name entry; school-door navigation; all ten classroom activities launching through their original controls; animation, speech decoding, bitmap fonts, movies and object carrying. Activity checks advance 1,000 frames after launch and after individual control clicks. Counting playthroughs record correct and incorrect answers, and their progress survives a page reload. Sorting playthroughs place objects and record graded attempts for colors, shapes, and combined categories.

The runtime also implements scaling, four sound channels, learning thresholds, daily attempt statistics, formatted text, palette fades and background-restoration masks. It has not been compared against a running Windows installation, and exhaustive completion at every difficulty is unverified. STBL effects, viewport scrolling, older text APIs and several less-used graphics/database services remain provisional; printing is disabled. Unsupported operations stop with a visible diagnostic. See the compatibility notes before treating it as an exact preservation release.

See [recovered formats and native evidence](docs/reverse-engineering.md) for the investigation and remaining work. The ISO, extracted game files, generated assets, decompiled executable and screenshots are excluded from Git. No game assets are uploaded or published by these tools.
