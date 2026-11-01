// Drive the public UI and emulator sensor transport; never write app state.
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function enterBoxing(device, options = {}) {
  const fighter = options.fighter || 'male';
  if (!['male', 'female'].includes(fighter)) throw Error('Choose --fighter male|female');
  const wait = options.wait || pause;
  const scale = device.status.width / 466;
  const offset = device.logs.length;
  const deadline = Date.now() + (options.timeout || 12000);
  let nextSelectionAt = 0, baseline = 0;
  await device.click(Math.round(325 * scale), Math.round(365 * scale));
  while (Date.now() < deadline) {
    const entries = device.auditEntries(offset);
    const failed = entries.find(entry => entry.event === 'motion-failed' && entry.view === 'boxingFailure');
    const view = device.viewEntries(offset).at(-1);
    if (failed || view?.view === 'boxingFailure') return { offset, view: 'boxingFailure', audit: failed || view };
    if (entries.some(entry => entry.view === 'boxing' && ['start', 'motion-connected'].includes(entry.event))) {
      return { offset, view: 'boxing', audit: await device.audit(offset, 'start', 'boxing', 10000) };
    }
    if (entries.some(entry => entry.event === 'prepare' && entry.view === 'boxing')) {
      // Repeated tiny changes encourage a fresh callback without creating a punch.
      // The first sample must occur after subscription and is baseline only.
      await device.acceleration([baseline++ % 2 ? 0.01 : 0, 0, 9.8]);
    } else if (view?.view === 'fighterChoice' && Date.now() >= nextSelectionAt) {
      await device.click(Math.round((fighter === 'female' ? 301 : 165) * scale), Math.round(205 * scale));
      nextSelectionAt = Date.now() + 500;
    }
    await wait(200);
  }
  throw Error('Timed out entering boxing: inspect fighter preference, storage and motion readiness in device.log');
}

module.exports = { enterBoxing };
