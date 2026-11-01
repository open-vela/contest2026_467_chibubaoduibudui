const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const { args } = require('./review-emulator');
const options = args(process.argv.slice(2));
if (!options.python) throw Error('Pass --python to an existing Python runtime with Pillow');
const { chromium } = require(options.playwright || 'playwright');
const canonical = name => fs.readFileSync(path.join(__dirname, name), 'utf8').replace(/\r\n/g, '\n');
const tag = crypto.createHash('sha256').update(canonical('female-fighter-drawing.js'))
  .update(canonical('training-drawing.js')).update(canonical('optimize-training-frame.py'))
  .update(canonical('generate-female-fighter.js')).digest('hex').slice(0, 12);
const folder = 'fighter-female-' + tag;
const output = path.resolve(__dirname, '../src/common', folder);
(async () => {
  const browser = await chromium.launch({ headless: true, channel: options.channel || 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 210, height: 180 }, deviceScaleFactor: 1 });
    await page.setContent('<style>html,body{margin:0;background:transparent}canvas{display:block}</style><canvas width="210" height="180"></canvas>');
    for (const name of ['training-drawing.js', 'female-fighter-drawing.js']) await page.addScriptTag({ content: canonical(name) });
    fs.mkdirSync(output, { recursive: true });
    const names = [];
    for (const [kind, count] of [['guard', 8], ['punch', 12]]) for (let frame = 0; frame < count; frame++) {
      await page.evaluate(({ kind, frame }) => FemaleFighterDrawing.render(document.querySelector('canvas').getContext('2d'),
        kind === 'punch' ? TrainingDrawing.punchProfile(frame * 0.05) : 0,
        kind === 'punch' ? -0.7 : -1.4 * (1 + Math.sin(frame / 8 * Math.PI * 2)) / 2), { kind, frame });
      const name = kind + '-' + String(frame).padStart(2, '0') + '.png';
      await page.locator('canvas').screenshot({ path: path.join(output, name), omitBackground: true });
      cp.execFileSync(options.python, [path.join(__dirname, 'optimize-training-frame.py'), path.join(output, name)], { windowsHide: true, stdio: 'pipe' });
      names.push(name);
    }
    // Update the package reference only after all frames have been written.
    const visuals = path.resolve(__dirname, '../src/pages/index/training-visuals.js');
    const source = fs.readFileSync(visuals, 'utf8');
    fs.writeFileSync(visuals, source.replace(/const FEMALE_ASSET_ROOT = '[^']+';/, "const FEMALE_ASSET_ROOT = '/common/" + folder + "';"));
    console.log(JSON.stringify({ directory: output, frames: names.length, bytes: names.reduce((sum, name) => sum + fs.statSync(path.join(output, name)).size, 0) }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
