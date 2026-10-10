# Native engine investigation

## Evidence and approach

Source: local `JumpStart Presch.iso`; game executable `disc/PRSCHOOL/PRSCHL99.EXE`. SHA-256: `51d778a601c66f8d5ac95cf0e778915d891b1fb92ad5d30aad315e2f4d17eb65`.

The executable is a PE32 x86 program with Microsoft runtime, MFC, DirectDraw, DirectSound, WinMM and SmackW32 imports. The engine identifies itself as Play 4.0. The Director files on the disc belong to the preview launcher, rather than the game runtime. BOOK.INI specifies startup library 99 and eight frames per second.

REA 6.3.0 with the Ghidra provider and local Ghidra 12.1.4 produced the initial analysis. Ghidra headless exports are retained locally under `tools/decompiled/`; 3,257 functions were exported. `ExportDecompiled.java`, `ExportSelected.java` and `RecoverMethods.java` are the research scripts. These exports are evidence for the handwritten port, not compilable original source.

Native dispatch at `0x4126c0` maps host events to graphics, animation, timer, movie and resource services. `0x402470` dispatches the profile database services. `0x40d9d0` is the printing plugin; its event 38001 is printer drawing, not movie transfer.

## Resource archives

LBRC headers have a 32-byte prefix. Tag directory entries are eight bytes (four-byte tag and offset); directory offsets are relative to byte 32. Resource table entries are five little-endian uint32 values: payload offset, size, reserved value, resource ID, flags. The payload offset requires a 16-byte adjustment. IDs carry flags in their upper 16 bits.

ANIM containers embed another directory with 20-byte resource entries. Repeated WAVE entries with the same ID are consecutive pieces of one ADP1 stream and must be concatenated. Overwriting them silently discards the sound header. The final container's declared archive size includes 16 bytes beyond the physical payload; the reader tolerates this envelope convention while validating its nested records.

Extraction: 20 libraries, 3,207 direct and 13,392 nested bitmaps, 1,270 SCRP resources, 695 EVNT resources, 2,397 ANIM resources, 348 DTAB resources, 148 direct WAVE resources and 36 UFI1 font resources. Nested sound streams are additional to the direct WAVE count.

## Bitmaps and compression

BMAP starts with flags uint16, height uint16, width uint16 and size uint32. Kind 0 stores raw indexed pixels; kind 5 uses LZ; kind 4 uses LZ followed by row RLE. Rows are bottom-up. The palette comes from CTBL (uint16 count followed by RGB triplets). Index zero is transparent for the compressed sprite formats.

The LZ decoder was translated from native `0x414690`: interleaved LSB-first 16-bit control words, literals, short/long backwards copies with overlap, and an extended zero-length terminator. RLE starts with a lookup palette, row-offset table and per-row tokens. Low tokens select lookup colors; high tokens repeat colors or insert literal runs. `tools/resources.py` implements these layouts and emits standard indexed PNG files.

In native `0x40efa0`, lookup color 255 restores the original background at that pixel. A literal-run pixel of value 255 remains white. The extractor emits separate restoration masks, and the renderer composites the scene background through them. Collapsing these two meanings produces large white patches over the sorting bins.

UFI1 contains AMIF or KARF fonts. Eight-byte glyph records provide character, dimensions, side bearings and baseline offset. AMIF glyphs use the bitmap RLE; KARF uses raw indexed pixels or MSB-first packed bits. Font rows are top-down, unlike BMAP. Atlases retain glyph metrics for Canvas text rendering.

ADP1 is IMA-style ADPCM: little-endian predictor and step index per channel, low nibble first, interleaved left/right nibbles for stereo. The native initial index -1 uses a step of eight. The header predictor seeds the decoder; it is not an extra output sample. Both predictor and step index are clamped.

## Script VM and events

SCRP has a 16-byte header with length, reserved value, frame bytes and argument bytes. Each instruction begins with an opcode byte and a descriptor byte (high nibble value type, low nibble operand count). Each operand is a kind byte plus an int32 value. Operand kinds cover literals, register/global/frame references, indirection, address literals and packed string-character references. Inline string literals have a following data instruction.

The port models 64 KiB of memory, 97 registers per call, a descending stack, typed arithmetic, jumps, script/event calls and string operations. Negative offsets address the current frame; offsets through 96 address registers; larger offsets address globals. String IDs remain distinct from character arrays. A conservative memory scan reclaims unused handles between script calls.

EVNT has a GUID prefix, argument type list and script/match pairs. Matching the first argument selects a script; a terminal zero match supplies the default. Host events 35000+ provide engine services, 37000+ tables, 37500+ fonts/text, and 38500+ profiles.

ANIM contains channel count, frame count and six-byte channel descriptors, followed by an interleaved token stream. Channels are events, sound, child animations or images. `0xffff` supplies a wait count. Image tokens have signed x/y coordinates; the native depth order draws smaller z values nearer the viewer. Certain final-frame images become persistent instance-zero sprites.

Native `0x4158a0` removes a matching bitmap when its instance is zero or matches the requested animation instance. The persistent instance must be removed too; otherwise old character faces and limbs remain over later frames. Native `0x413650` takes five arguments for event 35024: bitmap, instance, x, y, z. Native `0x413900` restores save blocks using 16-bit word offsets/counts. Saved blocks are string-handle roots in the replacement VM.

BUTN supplies enabled flags, priority and rect/ellipse/polygon/sprite shapes. Native sprite hit testing checks the foremost nontransparent pixel before matching a sprite-based button. Pointer events are 10 down, 11 up, 12 double-click, 13 right-click, and 14/15/16 hover enter/leave/over. Keyboard events are 5 key-down, 6 character and 7 key-up. Event 23 is a printing page callback.

## Compatibility work remaining

The user explicitly selected a playable replacement-engine port as the desired result. Browser tests now follow startup, school door, classroom and all ten activity controls. Counting rounds exercise both correct and incorrect responses and verify persisted records after reload. Sorting tests select and carry original objects, place them into bins and verify graded records. These tests establish playable paths, not exhaustive compatibility.

Implemented services include child-animation parent flags, animation/sprite scaling, four sound channels, movie pause/stop, formatted font slots and colors, typed profile fields, daily correct/incorrect counts, activity levels and promotion/demotion thresholds. Native `0x41c7a0` supplied threshold semantics: newest whole days until minimum attempt counts, constrained to the current level period. The replacement records a new epoch when the level changes. It does not implement every database call.

Remaining fidelity includes exact resource lifetime and library teardown, timer rounding, STBL remapping/blending, viewport scrolling, palette remapping beyond global fades, older text services and movie-frame callbacks. Printing is inactive. Events 35044/35045/35046/35053/35054/35056/35059/35076 and several older font calls have provisional results. Native Windows reference captures and completion at every difficulty remain unverified.

Future preservation validation should complete every exercise at each difficulty, check carry cancellation and parent reports, and compare with the Windows program under a local compatibility environment. Keep extracted assets and native decompiler output local.
