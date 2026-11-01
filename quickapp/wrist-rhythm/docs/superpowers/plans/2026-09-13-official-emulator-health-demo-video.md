# Official Emulator Health Demo Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a verified 60-second MP4 of Wrist Rhythm running in the official openvela watch emulator, with simulated heart-rate and stress data, Mandarin male narration, subtitles, and a synchronized written script.

**Architecture:** Keep production health access behind a real-provider module, and build the recording RPK in an isolated ASCII staging directory where only that provider is replaced with a deterministic demo provider. Capture a longer, real-time emulator session, then select representative segments into a 60-second master and mux Mandarin male narration plus subtitles without altering application pixels.

**Tech Stack:** openvela Quick App `.ux`, Node.js 22, AIoT Toolkit 2.0.5, `@aiot-toolkit/emulator` gRPC, Windows `System.Speech`, FFmpeg 7.1, Node's built-in test/assert tooling.

**Spec:** `docs/superpowers/specs/2026-09-13-official-emulator-health-demo-video-design.md`

## Global Constraints

- Run the application in `vela-miwear-watch-5.0(开发者大赛)` using the existing VVD name `Vela_Official_Watch_5_Demo`.
- Simulate both existing health metrics: heart rate and stress.
- Use a natural, calm Mandarin male voice; this machine provides `Microsoft Kangkang` (`zh-CN`, male).
- Keep the final video approximately 60 seconds and square, encoded as H.264 video with AAC audio.
- Do not shorten the production 60-second breathing session or 30-second boxing session for recording.
- Default debug and release builds must use `@service.health` and must not import or start the demo provider.
- Do not overwrite existing `output/video` files or include unrelated dirty-worktree changes in commits.
- Never repair missing app data with post-production numeric overlays.

## File Map

- `src/pages/index/health-provider.js`: production-only provider seam that re-exports `health.js`.
- `src/pages/index/demo-health-core.js`: deterministic, timer-independent health scenario logic.
- `src/pages/index/demo-health.js`: recording-only adapter implementing the same provider interface.
- `src/pages/index/index.ux`: imports the provider seam instead of importing `health.js` directly.
- `scripts/demo-build-runner.js`: builds an isolated staged RPK and swaps only the staged provider.
- `tools/capture-official-health-demo.js`: installs, launches, drives, and captures the official VVD.
- `tools/health-demo-media.js`: owns the edit decision list, narration cues, SRT/Markdown generation, and FFmpeg argument construction.
- `tools/render-health-demo-narration.ps1`: renders the approved text with `Microsoft Kangkang`.
- `tools/compose-official-health-demo.js`: produces the silent master and final narrated/subtitled MP4.
- `test/demo-health.test.js`: scenario and provider-lifecycle tests.
- `test/demo-build-runner.test.js`: staged-build isolation and artifact tests.
- `test/health-demo-media.test.js`: timeline, script, and command-construction tests.
- `package.json`: adds test files and explicit demo build/capture/compose commands.
- `output/video/official-health-demo-v2/`: generated deliverables; remains uncommitted unless the user asks otherwise.

---

### Task 1: Add the production provider seam and deterministic demo scenario

**Files:**
- Create: `src/pages/index/health-provider.js`
- Create: `src/pages/index/demo-health-core.js`
- Create: `src/pages/index/demo-health.js`
- Modify: `src/pages/index/index.ux` at the current `./health.js` import
- Create: `test/demo-health.test.js`
- Modify: `package.json` test script

**Interfaces:**
- Consumes: existing provider functions `getRecent(dataTypes)`, `subscribe(dataType, onSample, onError)`, `unsubscribe(dataType, onError)` and `DATA_TYPES`.
- Produces: `demoHealthCore.valueAt(elapsedMs)`, `demoHealthCore.sampleAt(dataType, elapsedMs, timeStamp)`, and `demoHealthCore.createDemoHealthSource(options)`; the demo adapter exports the same interface as `health.js`.

- [ ] **Step 1: Write the failing demo scenario test**

Create `test/demo-health.test.js` with assertions for the exact trajectory and provider isolation:

```js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const demo = require('../src/pages/index/demo-health-core.js');

const ROOT = path.resolve(__dirname, '..');

assert.deepStrictEqual(demo.valueAt(0), { heartRate: 112, stress: 46 });
assert.deepStrictEqual(demo.valueAt(13000), { heartRate: 104, stress: 41 });
assert.deepStrictEqual(demo.valueAt(36000), { heartRate: 94, stress: 35 });
assert.deepStrictEqual(demo.valueAt(56000), { heartRate: 86, stress: 31 });
assert.deepStrictEqual(demo.valueAt(84000), { heartRate: 126, stress: 31 });
assert.deepStrictEqual(demo.valueAt(101000), { heartRate: 132, stress: 31 });

const sample = demo.sampleAt(demo.DATA_TYPES.HEART_RATE, 84000, 123456);
assert.deepStrictEqual(sample, {
  ok: true,
  dataType: demo.DATA_TYPES.HEART_RATE,
  value: 126,
  timeStamp: 123456,
});

const provider = fs.readFileSync(
  path.join(ROOT, 'src/pages/index/health-provider.js'),
  'utf8',
);
assert(provider.includes("from './health.js'"));
assert(!provider.includes('demo-health'));

const page = fs.readFileSync(path.join(ROOT, 'src/pages/index/index.ux'), 'utf8');
assert(page.includes("from './health-provider.js'"));
console.log('demo health tests passed');
```

- [ ] **Step 2: Run the test and verify the initial failure**

Run: `node test/demo-health.test.js`

Expected: FAIL because `demo-health-core.js` and `health-provider.js` do not exist.

- [ ] **Step 3: Implement the deterministic core**

Create `src/pages/index/demo-health-core.js` with these boundaries:

```js
const DATA_TYPES = { HEART_RATE: 0, STRESS: 9 };
const STAGES = [
  { at: 0, heartRate: 112, stress: 46 },
  { at: 13000, heartRate: 104, stress: 41 },
  { at: 36000, heartRate: 94, stress: 35 },
  { at: 56000, heartRate: 86, stress: 31 },
  { at: 84000, heartRate: 126, stress: 31 },
  { at: 101000, heartRate: 132, stress: 31 },
];

function valueAt(elapsedMs) {
  let stage = STAGES[0];
  for (const candidate of STAGES) {
    if (candidate.at > elapsedMs) break;
    stage = candidate;
  }
  return { heartRate: stage.heartRate, stress: stage.stress };
}

function sampleAt(dataType, elapsedMs, timeStamp) {
  const values = valueAt(elapsedMs);
  const value = dataType === DATA_TYPES.HEART_RATE
    ? values.heartRate
    : dataType === DATA_TYPES.STRESS
      ? values.stress
      : null;
  return value === null ? null : { ok: true, dataType, value, timeStamp };
}

function createDemoHealthSource(options = {}) {
  const now = options.now || Date.now;
  const schedule = options.setInterval || setInterval;
  const cancel = options.clearInterval || clearInterval;
  const startedAt = now();
  const timers = {};
  function emit(dataType, callback) {
    const stamp = now();
    const sample = sampleAt(dataType, stamp - startedAt, stamp);
    if (sample && callback) callback(sample);
  }
  return {
    getRecent(dataTypes) {
      return Promise.resolve(dataTypes.map((type) => sampleAt(type, 0, now())).filter(Boolean));
    },
    subscribe(dataType, onSample) {
      if (timers[dataType]) return;
      emit(dataType, onSample);
      timers[dataType] = schedule(() => emit(dataType, onSample), 1000);
    },
    unsubscribe(dataType) {
      if (timers[dataType]) cancel(timers[dataType]);
      delete timers[dataType];
      return { ok: true };
    },
  };
}

module.exports = { DATA_TYPES, STAGES, valueAt, sampleAt, createDemoHealthSource };
```

- [ ] **Step 4: Add real and demo provider modules and update the page import**

Create `src/pages/index/health-provider.js`:

```js
export { getRecent, subscribe, unsubscribe, DATA_TYPES } from './health.js';
```

Create `src/pages/index/demo-health.js`:

```js
import core from './demo-health-core.js';

export const DATA_TYPES = core.DATA_TYPES;
const source = core.createDemoHealthSource();
export const getRecent = (dataTypes) => source.getRecent(dataTypes);
export const subscribe = (dataType, onSample, onError) => source.subscribe(dataType, onSample, onError);
export const unsubscribe = (dataType, onError) => source.unsubscribe(dataType, onError);
```

Change the import in `src/pages/index/index.ux` to:

```js
import { getRecent, subscribe, unsubscribe, DATA_TYPES } from './health-provider.js';
```

Append `node test/demo-health.test.js` to `test:logic` in `package.json`.

- [ ] **Step 5: Run focused and full tests**

Run: `node test/demo-health.test.js`

Expected: `demo health tests passed`.

Run: `npm test`

Expected: all existing suites and the new suite pass.

- [ ] **Step 6: Commit the provider seam and scenario**

```powershell
git add -- src/pages/index/health-provider.js src/pages/index/demo-health-core.js src/pages/index/demo-health.js src/pages/index/index.ux test/demo-health.test.js package.json
git commit -m "feat: add isolated demo health scenario"
```

Before committing, inspect `git diff --cached` and ensure pre-existing unrelated edits in `index.ux` or `package.json` are not staged; use an interactive or minimal patch if necessary.

---

### Task 2: Build the demo RPK in an isolated staging directory

**Files:**
- Create: `scripts/demo-build-runner.js`
- Create: `test/demo-build-runner.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: repository root, `src/pages/index/health-provider.js`, AIoT CLI at `node_modules/aiot-toolkit/lib/bin.js`.
- Produces: `buildDemo(projectRoot, outputDirectory, overrides)` returning the absolute non-empty demo RPK path.

- [ ] **Step 1: Write failing staged-build tests**

Create `test/demo-build-runner.test.js` using a temporary fixture. Assert that:

```js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const runner = require('../scripts/demo-build-runner.js');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'health-demo-test-'));
const project = path.join(root, 'project');
const output = path.join(root, 'output');
fs.mkdirSync(path.join(project, 'src/pages/index'), { recursive: true });
fs.writeFileSync(path.join(project, 'src/pages/index/health-provider.js'), "export * from './health.js';\n");
fs.writeFileSync(path.join(project, 'package.json'), '{}\n');

let stagedProvider = '';
const artifact = runner.buildDemo(project, output, {
  copyProjectInputs(source, destination) {
    fs.cpSync(source, destination, { recursive: true });
  },
  runBuild(stageProject) {
    stagedProvider = fs.readFileSync(
      path.join(stageProject, 'src/pages/index/health-provider.js'),
      'utf8',
    );
    fs.mkdirSync(path.join(stageProject, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(stageProject, 'dist/demo.debug.1.0.0.rpk'), 'rpk');
  },
});

assert(stagedProvider.includes("from './demo-health.js'"));
assert.strictEqual(
  fs.readFileSync(path.join(project, 'src/pages/index/health-provider.js'), 'utf8'),
  "export * from './health.js';\n",
);
assert(fs.statSync(artifact).size > 0);
fs.rmSync(root, { recursive: true, force: true });
console.log('demo build runner tests passed');
```

- [ ] **Step 2: Run the test and verify failure**

Run: `node test/demo-build-runner.test.js`

Expected: FAIL because `scripts/demo-build-runner.js` does not exist.

- [ ] **Step 3: Implement the isolated builder**

Implement `scripts/demo-build-runner.js` with:

```js
const DEMO_PROVIDER = "export { getRecent, subscribe, unsubscribe, DATA_TYPES } from './demo-health.js';\n";
```

`buildDemo()` must create an ASCII-only `mkdtemp` stage, copy source inputs while excluding `.git`, `node_modules`, `build`, `dist`, `.worktrees`, and `output`, junction the repository `node_modules`, replace only the staged provider, invoke `process.execPath node_modules/aiot-toolkit/lib/bin.js build`, locate one non-empty `.debug.` RPK, copy it atomically to `output/video/official-health-demo-v2/demo-rpk/`, and remove the stage in `finally`.

The module must export `buildDemo`, `copyProjectInputs`, `findDebugArtifact`, and `runNativeBuild` so tests can inject filesystem/build operations.

- [ ] **Step 4: Add commands and tests to `package.json`**

Add:

```json
"build:demo": "node scripts/demo-build-runner.js",
"capture:demo": "node tools/capture-official-health-demo.js",
"compose:demo": "node tools/compose-official-health-demo.js"
```

Append `node test/demo-build-runner.test.js` to `test:logic`.

- [ ] **Step 5: Verify isolation and build output**

Run: `node test/demo-build-runner.test.js`

Expected: `demo build runner tests passed`.

Run: `npm run build:demo`

Expected: a non-empty debug RPK under `output/video/official-health-demo-v2/demo-rpk/`, while `src/pages/index/health-provider.js` still imports `./health.js`.

- [ ] **Step 6: Commit the demo builder**

```powershell
git add -- scripts/demo-build-runner.js test/demo-build-runner.test.js package.json
git commit -m "build: isolate health demo package"
```

---

### Task 3: Record the full official-emulator session

**Files:**
- Create: `tools/capture-official-health-demo.js`
- Create: `test/capture-official-health-demo.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: demo RPK, package `com.openvela.wristrhythm`, running VVD `Vela_Official_Watch_5_Demo`, emulator gRPC screenshots and acceleration sensor.
- Produces: 1,110 PNG frames at 10 fps in `output/video/official-health-demo-v2/raw-frames/` and `capture-manifest.json` containing VVD/image identity, dimensions, frame count, and event timestamps.

- [ ] **Step 1: Write failing timeline and path-safety tests**

Create `test/capture-official-health-demo.test.js` and assert:

```js
const assert = require('assert');
const capture = require('../tools/capture-official-health-demo.js');

assert.strictEqual(capture.VVD_NAME, 'Vela_Official_Watch_5_Demo');
assert.strictEqual(capture.FPS, 10);
assert.strictEqual(capture.DURATION_SECONDS, 111);
assert.deepStrictEqual(capture.UI_EVENTS.slice(0, 3).map((event) => event.at), [8000, 74000, 76000]);
assert.throws(() => capture.assertOutputDirectorySafe('F:\\'), /unsafe/i);
console.log('capture timeline tests passed');
```

- [ ] **Step 2: Run the test and verify failure**

Run: `node test/capture-official-health-demo.test.js`

Expected: FAIL because the capture module does not exist.

- [ ] **Step 3: Implement install, launch, and capture orchestration**

Base the gRPC code on the existing `tools/capture-official-emulator-demo.js`, but export constants/functions and only call `main()` under `require.main === module`.

Use these UI events:

```js
const UI_EVENTS = [
  { at: 8000, kind: 'click', x: 145, y: 360, label: 'start-steady' },
  { at: 74000, kind: 'click', x: 233, y: 360, label: 'return-home' },
  { at: 76000, kind: 'click', x: 320, y: 360, label: 'start-boxing' },
  { at: 76300, kind: 'acceleration', data: [0, 0, 9.8], label: 'motion-ready' },
];
```

Append alternating `[10, 0, 9.8]` and `[0, 0, 9.8]` acceleration events every 1,000 ms from 76,950 ms through 105,950 ms. Before recording, validate the resolved frame directory is a child of `output/video/official-health-demo-v2/`, create a fresh directory named with the pattern `raw-frames-YYYYMMDD-HHmmss`, install the demo RPK through the official emulator instance API, launch `com.openvela.wristrhythm`, wait until screenshots are non-empty, then capture 111 seconds.

Write a manifest shaped as:

```json
{
  "vvdName": "Vela_Official_Watch_5_Demo",
  "imageType": "vela-miwear-watch-5.0",
  "fps": 10,
  "durationSeconds": 111,
  "frames": 1110,
  "width": 466,
  "height": 466,
  "events": []
}
```

Populate dimensions from the first decoded PNG and events from the executed timeline rather than hard-coding them in the emitted manifest.

- [ ] **Step 4: Verify the recorder test and add it to the suite**

Append `node test/capture-official-health-demo.test.js` to `test:logic`, then run:

Run: `node test/capture-official-health-demo.test.js`

Expected: `capture timeline tests passed`.

Run: `npm test`

Expected: all suites pass.

- [ ] **Step 5: Commit the recorder**

```powershell
git add -- tools/capture-official-health-demo.js test/capture-official-health-demo.test.js package.json
git commit -m "feat: record official emulator health demo"
```

---

### Task 4: Generate synchronized script, subtitles, and Mandarin male narration

**Files:**
- Create: `tools/health-demo-media.js`
- Create: `tools/render-health-demo-narration.ps1`
- Create: `test/health-demo-media.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `NARRATION_CUES`, `EDIT_SEGMENTS`, `writeTextArtifacts(outputDirectory)`, SRT text, Markdown script, a plain UTF-8 narration text file, and `旁白.wav`.

- [ ] **Step 1: Write failing cue and duration tests**

Create `test/health-demo-media.test.js` with checks that cue 1 starts at 0, the final cue ends at 60, all cues are ordered/non-overlapping, edit segments total exactly 60 seconds, and the narration contains `心率`, `压力`, `官方`, `虚拟`, and `节拍`.

Use this exact edit list:

```js
const EDIT_SEGMENTS = [
  [0, 7],
  [8, 16],
  [38, 46],
  [68, 74],
  [74, 78],
  [78, 90],
  [94, 104],
  [106, 111],
];
```

- [ ] **Step 2: Run the test and verify failure**

Run: `node test/health-demo-media.test.js`

Expected: FAIL because `tools/health-demo-media.js` does not exist.

- [ ] **Step 3: Implement exact narration cues and text artifacts**

Define these cues in `tools/health-demo-media.js`:

```js
const NARRATION_CUES = [
  [0, 6, '现在看到的是运行在 openvela 官方手表虚拟设备中的腕上节律。'],
  [6, 13, '首页通过模拟健康数据，同时展示一百一十二次心率和四十六分压力，并提示用户放缓节律。'],
  [13, 22, '进入稳态六十，应用会根据当前状态选择舒缓呼吸节奏，引导吸气、停留与呼气。'],
  [22, 30, '随着训练推进，心率和压力逐步下降，呼吸节奏只会在完整周期边界调整。'],
  [30, 37, '训练结束后，结果页清楚呈现两项数据的前后变化。'],
  [37, 47, '回到首页进入节奏拳，虚拟机继续模拟腕部加速度动作，命中反馈、得分和连击实时更新。'],
  [47, 55, '当心率再次升高，目标节拍会自动放缓，让训练强度跟随身体状态。'],
  [55, 60, '腕上节律，把数据感知、呼吸调节和节奏运动，装进每一次抬腕。'],
];
```

Generate UTF-8 SRT with `HH:MM:SS,mmm` timestamps and Markdown containing a timecode/visual/narration table plus one continuous narration paragraph. Also write the continuous paragraph to `腕上节律-官方模拟器健康数据演示-旁白.txt`. Write all three under `output/video/official-health-demo-v2/`; the Markdown and SRT use the filenames from the spec.

- [ ] **Step 4: Implement the explicit male-voice renderer**

Create `tools/render-health-demo-narration.ps1` that accepts `-InputText` and `-OutputWav`, loads `System.Speech`, verifies an installed voice named exactly `Microsoft Kangkang` whose culture is `zh-CN` and gender is `Male`, selects it, sets rate `-1`, volume `100`, writes a PCM WAV, and disposes the synthesizer in `finally`. It must throw instead of falling back to a female voice.

- [ ] **Step 5: Generate and verify narration assets**

Run: `node test/health-demo-media.test.js`

Expected: `health demo media tests passed`.

Run: `node tools/health-demo-media.js`

Run the generated continuous narration text through:

```powershell
$narrationText = Get-Content -Raw -LiteralPath 'output/video/official-health-demo-v2/腕上节律-官方模拟器健康数据演示-旁白.txt'
& tools/render-health-demo-narration.ps1 -InputText $narrationText -OutputWav 'output/video/official-health-demo-v2/腕上节律-官方模拟器健康数据演示-旁白.wav'
```

Expected: a non-empty WAV created with `Microsoft Kangkang`. Use FFmpeg metadata output to confirm one mono or stereo PCM audio stream and record its duration.

- [ ] **Step 6: Commit media source files and tests**

```powershell
git add -- tools/health-demo-media.js tools/render-health-demo-narration.ps1 test/health-demo-media.test.js package.json
git commit -m "feat: generate health demo narration assets"
```

---

### Task 5: Compose the 60-second master and final MP4

**Files:**
- Create: `tools/compose-official-health-demo.js`
- Extend: `test/health-demo-media.test.js`

**Interfaces:**
- Consumes: raw frame directory/manifest, `EDIT_SEGMENTS`, narration WAV, SRT, bundled FFmpeg.
- Produces: `腕上节律-官方模拟器健康数据演示-母版.mp4` and `腕上节律-官方模拟器健康数据演示-成片.mp4`.

- [ ] **Step 1: Add failing FFmpeg-construction tests**

Assert the composition module creates eight trim inputs from `EDIT_SEGMENTS`, a concat graph with `n=8`, a 932×932/yuv420p/H.264 silent master, and a final command with AAC audio plus an embedded `mov_text` subtitle track tagged `zho`.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node test/health-demo-media.test.js`

Expected: FAIL because the compose module or argument builders are missing.

- [ ] **Step 3: Implement deterministic composition**

`tools/compose-official-health-demo.js` must:

1. locate FFmpeg in `output/video/.deps/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe`, failing with a clear path if absent;
2. encode raw PNGs to a lossless or visually lossless intermediate at 10 fps;
3. trim the exact `EDIT_SEGMENTS`, reset timestamps, and concatenate them in order;
4. scale to 932×932 with Lanczos, set square sample aspect ratio, encode H.264 `yuv420p`, and write the silent master;
5. pad or trim narration to exactly 60 seconds without changing pitch;
6. mux master video, AAC narration, and UTF-8 SRT as `mov_text`, with language metadata `zho`, into the final MP4;
7. refuse to overwrite any path outside `output/video/official-health-demo-v2/`.

Use `child_process.spawnSync` with an argument array; do not interpolate a shell command. Include `-movflags +faststart` in the final encode.

- [ ] **Step 4: Run composition tests**

Run: `node test/health-demo-media.test.js`

Expected: all cue, duration, and FFmpeg argument checks pass.

- [ ] **Step 5: Commit the composer**

```powershell
git add -- tools/compose-official-health-demo.js test/health-demo-media.test.js
git commit -m "feat: compose narrated health demo video"
```

---

### Task 6: Execute, inspect, and deliver the official-emulator video

**Files:**
- Generate: `output/video/official-health-demo-v2/**`
- Update if evidence requires correction: narration cues, edit list, recorder coordinates, or demo scenario files from earlier tasks

**Interfaces:**
- Produces the final deliverable set and verification evidence; no later task consumes it.

- [ ] **Step 1: Verify production code before demo execution**

Run:

```powershell
npm test
npm run build
npm run build:release
```

Expected: all commands exit successfully and both ordinary artifacts are non-empty. Inspect ordinary build inputs to confirm `health-provider.js` imports `./health.js` and no demo provider is referenced from `index.ux`.

- [ ] **Step 2: Start or select the official VVD and build the demo RPK**

Start `vela-miwear-watch-5.0(开发者大赛)` as `Vela_Official_Watch_5_Demo` using AIoT IDE if it is not already running. Confirm the running registration reports image type `vela-miwear-watch-5.0` and an attached ADB device, then run:

```powershell
npm run build:demo
```

- [ ] **Step 3: Capture the full real-time session**

Run:

```powershell
npm run capture:demo
```

Expected: 1,110 sequential non-empty PNGs, a manifest naming the official VVD/image, and no duplicate or missing frame numbers.

- [ ] **Step 4: Generate narration, text, subtitles, and both videos**

Run the media generator, male voice renderer, and composer in order:

```powershell
node tools/health-demo-media.js
$narrationText = Get-Content -Raw -LiteralPath 'output/video/official-health-demo-v2/腕上节律-官方模拟器健康数据演示-旁白.txt'
& tools/render-health-demo-narration.ps1 -InputText $narrationText -OutputWav 'output/video/official-health-demo-v2/腕上节律-官方模拟器健康数据演示-旁白.wav'
npm run compose:demo
```

Expected: non-empty Markdown, SRT, WAV, silent master MP4, and final MP4.

- [ ] **Step 5: Inspect application evidence frames**

Extract or select frames corresponding to final-video times 3, 15, 25, 33, 43, 51, and 58 seconds. Visually verify:

- home shows numeric heart rate `112` and stress `46`, not `--`;
- home shows the high-state suggestion;
- breathing shows at least two distinct phases and the calming rhythm label;
- steady result shows `112 → 86 bpm`, `46 → 31 分`, and negative deltas;
- boxing shows a valid pace label, targets, hits, score, and streak;
- boxing later reflects the slower pace after heart rate rises;
- boxing result shows a numeric heart-rate transition;
- no label, metric, fighter, or button is clipped by the round safe area.

If any item fails, correct the earliest responsible source or timeline and repeat capture/composition; do not edit numbers onto frames.

- [ ] **Step 6: Inspect media streams and synchronization**

Use FFmpeg/ffprobe output to verify the final MP4 is 60 seconds within ±0.2 seconds, 932×932, H.264/yuv420p, contains AAC audio, and contains one Chinese `mov_text` subtitle stream. Listen at the beginning, around 30 seconds, and the final sentence to confirm the voice is male, intelligible, uncut, and aligned with the shown feature.

- [ ] **Step 7: Run final regression verification**

Run again:

```powershell
npm test
npm run build
npm run build:release
git status --short
```

Expected: tests and both production builds pass. Generated media remains under the new output directory, and all pre-existing unrelated worktree changes remain present and untouched.

- [ ] **Step 8: Deliver clickable artifacts**

Report absolute links for the final MP4, silent master, WAV, SRT, Markdown script, capture manifest, and design/plan documents. State the verified VVD image/name, final media properties, and the exact test/build commands that passed.
