const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { ReviewDevice, args, wait } = require('./review-emulator');
const { enterBoxing } = require('./prism-session');
const o = args(process.argv.slice(2));
const d = new ReviewDevice(o);
(async () => {
  await d.connect();
  if (o.rpk) { await d.install(o.rpk); await d.launch(); }
  if (o.suite === 'motion') {
    await wait(1800); await d.shot('always-on-home');
    let offset = d.logs.length; await d.click(145, 365);
    await d.audit(offset, 'start', 'breathing', 10000);
    await wait(900); await d.shot('inhale');
    await d.milestone(offset, () => d.auditEntries(offset).some(a => a.phase === 'hold'), 'hold phase', 10000);
    await wait(1000); await d.shot('hold');
    await d.milestone(offset, () => d.auditEntries(offset).some(a => a.phase === 'exhale'), 'exhale phase', 12000);
    await wait(1800); await d.shot('exhale');
    const exitOffset = d.logs.length; await d.click(233, 423);
    await d.audit(exitOffset, 'exit', 'breathing', 10000); await wait(2000);
    const boxing = await enterBoxing(d, { fighter: o.fighter });
    if (boxing.view === 'boxingFailure') {
      await wait(1000); await d.shot('boxing-interrupted');
      console.log('Motion unavailable: captured the interruption; boxing exit was not verified.');
    } else {
      await wait(3000); await d.shot('animated-boxing');
      const boxingExit = d.logs.length; await d.click(233, 440);
      await d.audit(boxingExit, 'exit', 'boxing', 10000); await wait(3000);
      await d.shot('home-after-exits');
    }
  } else if (o.suite === 'positive') {
    const boxing = await enterBoxing(d, { fighter: o.fighter });
    if (boxing.view !== 'boxing') throw Error('Positive hits cannot be verified: motion is unavailable; inspect the interruption.');
    const offset = boxing.offset;
    await d.milestone(offset, () => d.auditEntries(offset).some(a => a.event === 'motion-connected'), 'app motion connected', 10000);
    // Sensor delivery and scoring are verified by application audits. The host
    // readiness-based schedule avoids treating selection/preparation as training.
    const epoch = d.sessionStart;
    for (let n = 3; n <= 9; n++) {
      await wait(Math.max(0, epoch + 900 + n * 1000 + 80 - Date.now()));
      await d.acceleration([n % 2 ? 10 : 0, 0, 9.8]);
      await wait(100); await d.shot('input-' + n);
    }
    const complete = await d.audit(offset, 'complete', 'boxingResult', 40000);
    await wait(1000); await d.shot('positive-result');
    assert(complete.actions > 0, 'app must record real sensor actions');
    assert(complete.stats.hits > 0 && complete.stats.score > 0, 'positive path requires actual hits and score');
    fs.writeFileSync(path.join(d.out, 'positive.json'), JSON.stringify({ device: d.status, artifact: d.artifact, complete,
      scope: 'Official emulator system.sensor input. Not human recognition accuracy.' }, null, 2));
    const home = d.logs.length; await d.click(233, 348);
    await d.audit(home, 'home', 'home', 10000); await wait(700); await d.shot('home-after-positive');
  } else throw Error('Choose --suite motion|positive');
  console.log('Verified native UI states: ' + d.out);
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => d.close());
