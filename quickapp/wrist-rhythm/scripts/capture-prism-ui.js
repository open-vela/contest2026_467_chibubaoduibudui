// Real emulator screenshots. No app data, clocks or scores are modified.
const fs = require('fs');
const { ReviewDevice, args, wait } = require('./review-emulator');
const { enterBoxing } = require('./prism-session');
const o = args(process.argv.slice(2));
const d = new ReviewDevice(o);
(async () => {
  await d.connect();
  if (o.rpk) { await d.install(o.rpk); await d.launch(); }
  const scale = d.status.width / 466;
  const click = (x, y) => d.click(Math.round(x * scale), Math.round(y * scale));
  await wait(1500);
  await d.shot('home');
  let offset = d.logs.length;
  await click(145, 360);
  await d.audit(offset, 'start', 'breathing', 10000);
  await wait(3000); await d.shot('breathing');
  // Wait for real completion, with no render-log claim if onReady was dropped.
  await d.audit(offset, 'complete', 'result', 70000);
  await wait(6000); await d.shot('steady-result');
  offset = d.logs.length;
  await click(233, 400);
  await d.audit(offset, 'home', 'home', 10000);
  await wait(700);
  const boxing = await enterBoxing(d, { fighter: o.fighter });
  if (boxing.view === 'boxingFailure') {
    await wait(1000); await d.shot('boxing-interrupted');
  } else {
    await wait(3000); await d.shot('boxing');
    await d.audit(boxing.offset, 'complete', 'boxingResult', 40000);
    // Native rendering can trail the JS completion audit.
    await wait(6000); await d.shot('boxing-result');
  }
  fs.writeFileSync(d.out + '/capture.json', JSON.stringify({ device: d.status, artifact: d.artifact,
    sessions: d.auditEntries().filter(a => ['start', 'complete', 'home'].includes(a.event)),
    observations: d.events.filter(e => e.action === 'observed_audit'),
    boxingOutcome: boxing.view,
    note: 'Screenshots are sampled native renders. Interrupted motion is not a completed boxing round. Emulator health readings are not human measurements.' }, null, 2));
  console.log('Captured native screens; boxing outcome ' + boxing.view + ': ' + d.out);
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => d.close());
