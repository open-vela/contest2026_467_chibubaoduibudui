const assert = require('assert');
const { test } = require('node:test');
const fs = require('fs');
const path = require('path');
const NOW = 1791700000000;

function harness(options = {}) {
  const root = path.join(__dirname, '../src/pages/index');
  const source = fs.readFileSync(path.join(root, 'index.ux'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  const modules = { steady: require(root + '/steady'), boxing: require(root + '/boxing'), reactive: require(root + '/reactive'),
    clock: require(root + '/session-clock'), lifecycle: require(root + '/page-lifecycle'), quality: require(root + '/health-quality'),
    visuals: require(root + '/training-visuals') };
  let now = NOW;
  let id = 0;
  const timers = new Map();
  const subscriptions = new Map();
  let motionCallback = null;
  let motionSubscriptions = 0;
  const motionAttempts = [];
  const audits = [];
  let savedGender = options.storedGender || '';
  const preferences = require(root + '/fighter-profile').createPreferences(options.profileProvider || {}, {
    get({ success }) { success(savedGender); },
    set({ value, success, fail }) { if (options.storageFails) fail(); else { savedGender = value; success(); } },
  }, {
    setTimeout: (callback, ms) => { timers.set(++id, { callback, ms, once: true }); return id; },
    clearTimeout: (timer) => timers.delete(timer),
  });
  // Execute the actual system.sensor adapter; only the system provider is a fixture.
  const motionSource = fs.readFileSync(path.join(root, 'motion.js'), 'utf8');
  const motion = Function('sensor', motionSource.replace(/^import .*;\s*$/gm, '').replace(/export function/g, 'function')
    + '\nreturn { subscribeAccelerometer, unsubscribeAccelerometer };')({
      subscribeAccelerometer(callbacks) {
        motionAttempts.push(callbacks); motionCallback = callbacks.callback; motionSubscriptions += 1;
        if (options.motionThrows) throw new Error('sensor unavailable');
        if (options.motionFails) callbacks.fail('sensor unavailable', 200);
        if (options.synchronousMotion) callbacks.callback(options.synchronousMotion);
      },
      unsubscribeAccelerometer() { motionCallback = null; motionSubscriptions -= 1; },
    });
  const injected = { ...modules, Date: { now: () => now }, DATA_TYPES: { HEART_RATE: 0, STRESS: 9 },
    console: { log: (line) => { if (line.startsWith('WRIST_AUDIT ')) audits.push(JSON.parse(line.slice(12))); } },
    getRecent: () => Promise.resolve([]),
    subscribe: (type, onSample, onError) => subscriptions.set(type, { onSample, onError }),
    unsubscribe: (type) => subscriptions.delete(type), ...motion,
    getScreenLayout: () => Promise.resolve({ className: '', size: 'regular', viewport: 'normal' }),
    getFighterPreference: () => preferences.load(),
    saveFighterPreference: (gender) => preferences.save(gender),
    setInterval: (callback, ms) => { timers.set(++id, { callback, ms }); return id; },
    clearInterval: (timer) => timers.delete(timer),
    setTimeout: (callback, ms) => { timers.set(++id, { callback, ms, once: true }); return id; },
    clearTimeout: (timer) => timers.delete(timer),
  };
  const definition = Function(...Object.keys(injected), source.replace(/^import .*;\s*$/gm, '').replace('export default', 'return'))(...Object.values(injected));
  const page = { ...definition.private };
  for (const [key, fn] of Object.entries(definition)) if (typeof fn === 'function') page[key] = fn.bind(page);
  page.onShow();
  return { page, timers, subscriptions, audits, savedGender: () => savedGender,
    motionAttempts,
    motionError: () => motionAttempts.at(-1).fail('sensor unavailable', 200),
    timeout: () => {
      for (const [key, timer] of [...timers]) if (timer.once && timer.ms === 1600) { timers.delete(key); timer.callback(); }
    },
    motionCount: () => motionSubscriptions,
    motion: (x, y = 0, z = 9.8) => { assert(motionCallback, 'motion subscription is active'); motionCallback({x,y,z}); },
    at: (offset) => { now = NOW + offset; },
    push: (type, value, offset = 0) => subscriptions.get(type).onSample({ ok: true, dataType: type, value, timeStamp: NOW + offset }),
    refresh: () => { for (const timer of [...timers.values()]) if (timer.ms === 1000) timer.callback(); },
  };
}

for (const [name, options] of [['fresh preference', {}], ['saved female preference', { storedGender: 'female' }], ['unavailable motion', { motionFails: true }]]) {
  test(`Prism capture enters the actual boxing lifecycle with ${name}`, async () => {
    const { enterBoxing } = require('../scripts/prism-session');
    const h = harness(options);
    let selections = 0, baselineWrites = 0;
    const device = {
      status: { width: 466 },
      get logs() { return 'x'.repeat(h.audits.length); },
      auditEntries(offset) { return h.audits.slice(offset); },
      viewEntries() { return [{ view: h.page.view }]; },
      async click(x) {
        if (x > 310) h.page.requestBoxing();
        else { selections += 1; h.page.chooseMale(); }
        for (let step = 0; step < 4; step++) await Promise.resolve();
      },
      async acceleration(sample) {
        assert.equal(h.page.boxingState, 'preparing', 'baseline is supplied only after the real prepare transition');
        baselineWrites += 1;
        h.motion(...sample);
      },
      async audit(offset, event, view) {
        const entry = h.audits.slice(offset).find(item => item.event === event && item.view === view);
        assert(entry, `${event} ${view} must have been emitted by the actual page`);
        return entry;
      },
    };
    try {
      const result = await enterBoxing(device, { wait: async () => {}, timeout: 1000 });
      if (options.motionFails) {
        assert.equal(result.view, 'boxingFailure');
        assert.equal(baselineWrites, 0);
        assert(!h.audits.some(entry => entry.event === 'start'));
      } else {
        assert.equal(result.view, 'boxing');
        assert.equal(h.page.boxingState, 'running');
        assert.equal(baselineWrites, 1);
        assert.equal(h.page.boxingStats.score, 0, 'readiness sample does not score');
        assert.equal(selections, options.storedGender ? 0 : 1);
        assert.equal(h.page.fighterGender, options.storedGender || 'male');
      }
    } finally { h.page.onHide(); }
  });
}

for (const first of ['error', 'invalid', 'tick', 'hide']) {
  test(`boxing completion wins the deadline race when ${first} arrives first`, () => {
    for (const at of [30000, 30001]) {
      const h = harness();
      try {
        h.push(0, 90); h.push(9, 40); h.page.startBoxing(); h.motion(0);
        const native = h.motionAttempts[0];
        for (let t = 50; t <= 29950; t += 50) {
          h.at(t); h.page.boxingTick();
          if (t === 900) h.motion(5);
          if (t === 25000) { h.push(0, 80, t); h.push(9, 30, t); }
        }
        h.at(at);
        const callbacks = {
          error: () => native.fail('sensor unavailable', 200),
          invalid: () => native.callback({ x: NaN, y: 0, z: 9.8 }),
          tick: () => h.page.boxingTick(),
          hide: () => h.page.onHide(),
        };
        callbacks[first]();
        for (const [name, callback] of Object.entries(callbacks)) if (name !== first) callback();
        assert.equal(h.page.view, 'boxingResult');
        assert.equal(h.page.boxingResultScore, '100');
        assert.equal(h.page.boxingResultHits, '1 / 30');
        assert.match(h.page.boxingResultHeartRate, /90 → 80/);
        assert.match(h.page.boxingResultStress, /40 → 30/);
        assert.equal(h.audits.filter(a => a.event === 'complete').length, 1);
        assert.equal(h.motionCount(), 0);
        assert.equal(h.timers.size, 0);
        h.at(80000); h.page.onShow();
        assert.equal(h.page.view, 'boxingResult');
        assert.equal(h.motionCount(), 0);
        assert.equal(h.timers.size, 1);
      } finally { h.page.onDestroy(); }
    }
  });
}

for (const failure of ['error', 'invalid']) {
  test(`boxing ${failure} immediately before the deadline still interrupts`, () => {
    const h = harness();
    try {
      h.page.startBoxing(); h.motion(0); h.at(29999);
      if (failure === 'error') h.motionError();
      else h.motionAttempts[0].callback({ x: NaN, y: 0, z: 9.8 });
      assert.equal(h.page.view, 'boxingFailure');
      h.at(30000); h.page.boxingTick();
      assert.equal(h.page.view, 'boxingFailure');
      assert.equal(h.audits.filter(a => a.event === 'complete').length, 0);
      assert.equal(h.motionCount(), 0);
    } finally { h.page.onDestroy(); }
  });
}

for (const [heartRate, secondBeat] of [[null, 1900], [130, 2100], [160, 2300]]) {
  test(`boxing on-beat scoring is callback-order independent at heart rate ${heartRate}`, () => {
    for (const order of ['tick-first', 'sample-first']) {
      const h = harness();
      try {
        if (heartRate !== null) h.push(0, heartRate);
        h.page.startBoxing(); h.motion(0);
        let previous = 0;
        for (const [index, beat] of [900, secondBeat].entries()) {
          for (let t = previous + 50; t < beat; t += 50) { h.at(t); h.page.boxingTick(); }
          h.at(beat);
          const pose = index === 0 ? 5 : 0;
          if (order === 'tick-first') { h.page.boxingTick(); h.motion(pose); }
          else { h.motion(pose); h.page.boxingTick(); }
          // More movement at the same timestamp must not bypass the real detector cooldown.
          h.motion(pose + 5); h.motion(pose);
          assert.equal(h.page.boxingStats.score, (index + 1) * 100, order);
          assert.equal(h.page.motionActions, index + 1, order);
          assert.equal(h.page.boxingStats.targets, index + 1, order);
          previous = beat;
        }
        assert.equal(h.page.boxingStats.hits, 2);
        assert.equal(h.page.boxingStats.maxStreak, 2);
        assert.equal(h.audits.filter(a => a.event === 'target').length, 2);
      } finally { h.page.onDestroy(); }
    }
  });
}

for (const [offset, points] of [[120, 100], [121, 70], [250, 70], [251, 40], [350, 40], [351, 0]]) {
  test(`boxing delayed target callback preserves the scoring boundary at +${offset}ms`, () => {
    for (const order of ['tick-first', 'sample-first']) {
      const h = harness();
      try {
        h.page.startBoxing(); h.motion(0);
        for (let t = 50; t <= 850; t += 50) { h.at(t); h.page.boxingTick(); }
        h.at(900 + offset);
        if (order === 'tick-first') { h.page.boxingTick(); h.motion(5); }
        else { h.motion(5); h.page.boxingTick(); }
        h.at(1400); h.page.boxingTick();
        assert.equal(h.page.boxingStats.score, points, order);
        assert.equal(h.page.boxingStats.hits, points ? 1 : 0, order);
        assert.equal(h.page.boxingStats.targets, 1, order);
        assert.equal(h.page.motionActions, 1, order);
      } finally { h.page.onDestroy(); }
    }
  });
}

test('boxing input synchronization does not open an early-hit window', () => {
  const h = harness();
  try {
    h.page.startBoxing(); h.motion(0); h.at(800); h.motion(5);
    assert.equal(h.page.boxingStats.score, 0);
    assert.equal(h.page.boxingStats.targets, 0);
    h.at(900); h.page.boxingTick(); h.motion(10);
    assert.equal(h.page.boxingStats.score, 0, 'the rejected early action still obeys cooldown');
    assert.equal(h.page.motionActions, 1);
  } finally { h.page.onDestroy(); }
});

test('boxing target synchronization advances once per effective timestamp after a timer delay', () => {
  for (const at of [1900, 2000, 3500]) {
    for (const order of ['tick-first', 'sample-first']) {
      const h = harness();
      try {
        h.page.startBoxing(); h.motion(0);
        for (let t = 50; t <= 850; t += 50) { h.at(t); h.page.boxingTick(); }
        h.at(at);
        if (order === 'tick-first') { h.page.boxingTick(); h.motion(5); }
        else { h.motion(5); h.page.boxingTick(); }
        assert.equal(h.page.motionActions, 1, order);
        assert.equal(h.page.boxingStats.score, 0, order);
        assert.equal(h.page.boxingStats.hits, 0, order);
        assert.equal(h.page.boxingStats.targets, 0, order);
        assert.equal(h.audits.filter(a => a.event === 'target').length, 1, order);
      } finally { h.page.onDestroy(); }
    }
  }
});

test('boxing resumed target scoring uses effective time before its timer callback', () => {
  const h = harness();
  try {
    h.page.startBoxing(); h.motion(0);
    h.at(900); h.page.boxingTick(); h.motion(5);
    h.at(1500); h.page.onHide(); h.at(25000); h.page.onShow(); h.motion(50);
    assert.equal(h.page.boxingStats.score, 100, 'reconnection pose is baseline only');
    h.at(25500); h.motion(55); h.page.boxingTick();
    assert.equal(h.page.boxingStats.score, 200);
    assert.equal(h.page.boxingStats.hits, 2);
    assert.equal(h.page.boxingStats.maxStreak, 2);
    assert.equal(h.page.motionActions, 2);
  } finally { h.page.onDestroy(); }
});

for (const scenario of [
  { name: 'standard to calming', initial: 20, updates: [[5000, 45]], tail: 58000 },
  { name: 'calming to standard', initial: 45, updates: [[5000, 20]], tail: 52000 },
  { name: 'both directions', initial: 20, updates: [[5000, 45], [25000, 20]], tail: 54000 },
  { name: 'last boundary switches to a longer cycle', initial: 20, updates: [[45000, 45]], tail: 50000 },
]) {
  test(`breathing uses a natural tail after ${scenario.name} instead of an incomplete cycle`, () => {
    const h = harness();
    try {
      h.push(0, 80); h.push(9, scenario.initial); h.page.startTraining();
      for (let t = 50; t <= 59950; t += 50) {
        h.at(t);
        for (const [at, stress] of scenario.updates) if (t === at) h.push(9, stress, t);
        h.page.tick();
        if (t === scenario.tail - 50) assert.equal(h.page.breathPhase, 'exhale', 'finish the preceding full cycle');
        if (t >= scenario.tail) {
          assert.equal(h.page.phaseLabel, '自然呼吸');
          assert(!['inhale', 'hold', 'exhale'].includes(h.page.breathPhase));
          assert.equal(h.page.patternLabel, '收尾放松');
          assert(h.page.breathFrameSrc.endsWith('/breath-00.png'), 'tail artwork must not begin another guided inhale');
        }
      }
      assert.equal(h.page.view, 'breathing');
      assert.equal(h.page.remainingText, '1');
      h.at(60000); h.page.tick();
      assert.equal(h.page.view, 'result');
      assert.equal(h.page.trainingClock.pausedAt, NOW + 60000);
      assert.equal(h.audits.filter(a => a.event === 'complete').length, 1);
    } finally { h.page.onDestroy(); }
  });
}

for (const stress of [20, 45]) {
  test(`breathing keeps the complete final exhale when the ${stress < 40 ? 'standard' : 'calming'} cycles fit`, () => {
    const h = harness();
    try {
      h.push(0, 80); h.push(9, stress); h.page.startTraining();
      for (let t = 50; t <= 59950; t += 50) { h.at(t); h.page.tick(); }
      assert.equal(h.page.breathPhase, 'exhale');
      assert.equal(h.page.phaseLabel, '缓缓呼气');
      h.at(60000); h.page.tick();
      assert.equal(h.page.view, 'result');
      assert.equal(h.page.trainingClock.pausedAt, NOW + 60000);
    } finally { h.page.onDestroy(); }
  });
}

test('breathing natural tail pauses in background and preserves foreground health comparison', () => {
  const h = harness();
  try {
    h.push(0, 90); h.push(9, 20); h.page.startTraining();
    for (let t = 50; t <= 59000; t += 50) {
      h.at(t); if (t === 5000) h.push(9, 45, t); h.page.tick();
    }
    assert.equal(h.page.phaseLabel, '自然呼吸');
    const frame = h.page.breathFrameSrc;
    h.page.onHide(); assert.equal(h.timers.size, 0);
    h.at(119000); h.page.onShow();
    assert.equal(h.page.phaseLabel, '自然呼吸');
    assert.equal(h.page.breathFrameSrc, frame);
    assert.equal(h.page.remainingText, '1');
    h.at(119500); h.push(0, 80, 119500); h.page.tick();
    h.at(119999); h.page.tick(); assert.equal(h.page.view, 'breathing');
    h.at(120000); h.page.tick();
    assert.equal(h.page.view, 'result');
    assert.equal(h.page.resultHeartRateDelta, '-10 bpm');
    assert.equal(h.audits.filter(a => a.event === 'complete').length, 1);
    assert.equal(h.audits.find(a => a.event === 'complete').elapsed, 60000);
  } finally { h.page.onDestroy(); }
});

test('leaving a breathing tail permits a fresh full session', () => {
  const h = harness();
  try {
    h.push(9, 20); h.page.startTraining();
    for (let t = 50; t <= 59000; t += 50) {
      h.at(t); if (t === 5000) h.push(9, 45, t); h.page.tick();
    }
    assert.equal(h.page.phaseLabel, '自然呼吸');
    h.page.stopTraining();
    assert.equal(h.page.view, 'home');
    assert.equal(h.audits.filter(a => a.event === 'complete').length, 0);
    h.push(9, 20, 59000); h.page.startTraining();
    assert.equal(h.page.view, 'breathing');
    assert.equal(h.page.remainingText, '60');
    assert.equal(h.page.phaseLabel, '慢慢吸气');
    assert.equal(h.page.patternLabel, '标准节奏 · 4-2-4');
  } finally { h.page.onDestroy(); }
});

async function settleProfile() { for (let n = 0; n < 8; n++) await Promise.resolve(); }

test('first boxing entry waits for a saved choice before starting the training clock', async () => {
  const h = harness();
  h.page.requestBoxing(); await settleProfile();
  assert.equal(h.page.view, 'fighterChoice');
  assert.equal(h.motionCount(), 0);
  assert.equal(h.page.boxingClock, null);
  h.page.chooseFemale(); h.page.chooseMale(); await settleProfile();
  assert.equal(h.page.view, 'boxing');
  assert.equal(h.savedGender(), 'female', 'a second tap while saving cannot replace the choice');
  assert(h.page.fighterFrameSrc.includes('/fighter-female-'));
  h.page.stopBoxing(); h.page.requestBoxing(); await settleProfile();
  assert.equal(h.page.view, 'boxing');
  assert.equal(h.page.fighterGender, 'female');
  h.page.onDestroy(); assert.equal(h.timers.size, 0);
});

test('automatic owner gender wins and refreshes on each boxing entry', async () => {
  let gender = 'female';
  const h = harness({ storedGender: 'male', profileProvider: { getUserInfo: () => ({ gender }) } });
  h.page.requestBoxing(); await settleProfile();
  assert.equal(h.page.view, 'boxing'); assert.equal(h.page.fighterGender, 'female');
  h.motion(0);
  h.at(900); h.page.boxingTick();
  assert(h.page.fighterFrameSrc.includes('/fighter-female-'));
  assert(h.page.fighterFrameSrc.endsWith('/punch-00.png'));
  h.at(1500); h.page.boxingTick(); assert(h.page.fighterFrameSrc.includes('/guard-'));
  h.page.stopBoxing(); gender = 'male'; h.page.requestBoxing(); await settleProfile();
  assert.equal(h.page.fighterGender, 'male');
  assert(!h.page.fighterFrameSrc.includes('/fighter-female-'));
  h.page.onDestroy();
});

test('failed persistence keeps the choice visible with retry feedback', async () => {
  const h = harness({ storageFails: true });
  h.page.requestBoxing(); await settleProfile(); h.page.chooseFemale(); await settleProfile();
  assert.equal(h.page.view, 'fighterChoice');
  assert.equal(h.page.fighterChoiceBusy, false);
  assert(h.page.fighterChoiceMessage.includes('重试'));
  assert.equal(h.motionCount(), 0);
  h.page.cancelFighterChoice(); assert.equal(h.page.view, 'home'); h.page.onDestroy();
});

test('leaving the app cancels profile lookup and a late callback cannot start boxing', async () => {
  let callback;
  const h = harness({ profileProvider: { getUserInfo({ success }) { callback = success; } } });
  h.page.requestBoxing(); h.page.onHide();
  assert.equal(h.timers.size, 0);
  callback({ gender: 'female' }); await settleProfile();
  assert.equal(h.page.view, 'home'); assert.equal(h.motionCount(), 0);
  h.page.onShow(); assert.equal(h.page.view, 'home'); h.page.onDestroy();
});

test('boxing completion diagnostic reports its own clock, not the breathing countdown', () => {
  const h=harness();h.page.startBoxing();h.motion(0);h.at(30000);h.page.boxingTick();
  const complete=h.audits.find(a=>a.event==='complete');
  assert.equal(complete.view,'boxingResult');assert.equal(complete.elapsed,30000);assert.equal(complete.remaining,'0');
  h.page.onDestroy();
});

test('page does not call insufficient data stable and high heart rate works without stress', () => {
  const h = harness();
  h.push(0, 120);
  assert.notEqual(h.page.statusTitle, '当前节律平稳');
  for (let i = 1; i <= 3; i++) { h.at(i * 1000); h.push(0, 120, i * 1000); }
  assert.equal(h.page.suggest, true);
  h.page.onDestroy();
});

test('foreground expiry clears values without new callbacks; hide releases every timer', () => {
  const h = harness();
  h.push(0, 72);
  h.at(61000); h.refresh();
  assert.equal(h.page.heartRate, null);
  assert.equal(h.page.heartRateText, '待更新');
  h.page.onHide();
  assert.equal(h.timers.size, 0);
  h.page.onShow();
  assert.equal(h.page.heartRate, null);
  assert.equal([...h.timers.values()].filter(t => t.ms === 1000).length, 1);
  h.page.onShow();
  assert.equal([...h.timers.values()].filter(t => t.ms === 1000).length, 1);
  h.page.onDestroy();
  assert.equal(h.timers.size, 0);
});

test('per-metric unsupported state survives another metric succeeding', () => {
  const h = harness();
  h.push(0, 72);
  h.subscriptions.get(9).onError({ unsupported: true });
  assert.equal(h.page.heartRateText, '72');
  h.push(0, 72);
  assert.equal(h.page.stressText, '不支持');
  assert.equal(h.page.heartRateText, '72');
  h.page.onDestroy();
});

test('completed session with repeated timestamps reports insufficient comparison, not zero', () => {
  const h = harness();
  h.push(0, 90); h.push(9, 40);
  h.page.startTraining();
  h.at(30000); h.push(0, 90); h.push(9, 40);
  h.at(60000); h.page.tick();
  assert.equal(h.page.view, 'result');
  assert.equal(h.page.resultHeartRateDelta, '无法比较');
  assert.equal(h.page.resultStressDelta, '无法比较');
  h.page.onDestroy();
});

test('only a metric with a new in-session measurement receives a comparison', () => {
  const h = harness();
  h.push(0, 90); h.push(9, 40); h.page.startTraining();
  h.at(50000); h.push(0, 80, 50000);
  h.at(60000); h.page.tick();
  assert.equal(h.page.resultHeartRateDelta, '-10 bpm');
  assert.equal(h.page.resultStressDelta, '无法比较');
  assert.equal(h.page.heartRateImproved, false);
  h.page.onDestroy();
});

test('offline breathing completes and provides an honest default reason', () => {
  const h = harness(); h.page.startTraining();
  assert.equal(h.page.patternReason, '数据不足，使用默认节奏');
  h.at(60000); h.page.tick();
  assert.equal(h.page.view, 'result');
  assert.equal(h.page.resultHeartRateDelta, '无法比较');
  h.page.onDestroy();
});

test('pattern and explanation change together only on a complete cycle boundary', () => {
  const h = harness(); h.push(0, 80); h.push(9, 20); h.page.startTraining();
  h.at(5000); h.push(9, 45, 5000); h.page.tick();
  assert.equal(h.page.currentPattern.name, 'standard');
  assert.notEqual(h.page.patternReason, '依据当前压力选择');
  h.at(10000); h.page.tick();
  assert.equal(h.page.currentPattern.name, 'calming');
  assert.equal(h.page.patternReason, '依据当前压力选择');
  h.page.onDestroy();
});

test('background pauses session and foreground re-evaluates expired health', () => {
  const h = harness(); h.push(0, 80); h.page.startTraining();
  h.at(10000); h.page.onHide();
  assert.equal(h.timers.size, 0);
  h.at(120000); h.page.onShow();
  assert.equal(h.page.remainingText, '50');
  assert.equal(h.page.heartRate, null);
  h.at(170000); h.page.tick();
  assert.equal(h.page.resultHeartRateDelta, '无法比较');
  h.page.onDestroy();
});

test('boxing unavailable motion creates an interruption instead of a completed score', () => {
  const h = harness(); h.push(0, 90); h.page.startBoxing();
  h.page.handleMotionUnavailable();
  assert.equal(h.page.boxingScoreText, '0');
  h.at(30000); h.page.boxingTick();
  assert.equal(h.page.view, 'boxingFailure');
  assert(!h.audits.some(a => a.event === 'complete'));
  h.page.onDestroy();
});

test('system motion adapter reaches detector, debounce, scoring, combo and result separately', () => {
  const h = harness(); h.page.startBoxing(); h.motion(0);
  h.at(400); h.motion(4.5);
  assert.equal(h.page.boxingPrompt, '等节拍亮起'); assert.equal(h.page.boxingScoreText, '0');
  h.at(1000); h.page.boxingTick(); h.motion(0);
  assert.equal(h.page.boxingScoreText, '100'); assert.equal(h.page.boxingStreakText, '1');
  h.at(1070); h.motion(4.5);
  assert.equal(h.page.boxingPrompt, '精准！'); // Without debounce this becomes 等节拍亮起.
  h.at(1500); h.motion(9); assert.equal(h.page.boxingScoreText, '100');
  for (let n=2;n<=5;n++) { h.at(n*1000); h.page.boxingTick(); h.motion(n%2===0?4.5:0); }
  assert.equal(h.page.boxingStats.hits,5); assert.equal(h.page.boxingStats.score,500);
  assert.equal(h.page.boxingComboClass,'combo-hot');
  h.at(30000); h.page.boxingTick();
  assert.equal(h.page.boxingResultScore,'500'); assert.equal(h.page.boxingResultStreak,'5');
  assert.equal(h.motionCount(),0);h.page.onDestroy();
});

test('ten alternating explicit exits keep one health timer and no motion subscription at home', () => {
  const h = harness();
  for(let n=0;n<10;n++) {
    if(n%2===0) {h.page.startTraining();h.page.stopTraining();}
    else {h.page.startBoxing();assert.equal(h.motionCount(),1);h.page.stopBoxing();}
    assert.equal(h.page.view,'home'); assert.equal(h.timers.size,1);
    assert.equal(h.motionCount(),0); assert.equal(h.subscriptions.size,2);
  }
  h.page.onDestroy();assert.equal(h.timers.size,0);assert.equal(h.subscriptions.size,0);
});

test('breathing artwork follows the effective clock continuously through inhale hold and exhale', () => {
  const h = harness(); h.page.startTraining();
  assert(h.page.breathFrameSrc.endsWith('/breath-00.png'));
  for (const [at, frame] of [[1000,'06'],[4000,'40'],[5999,'40'],[6000,'40'],[8000,'20'],[10000,'00']]) {
    h.at(at); h.page.tick();
    assert(h.page.breathFrameSrc.endsWith(`/breath-${frame}.png`));
  }
  h.page.onHide(); const frozen = h.page.breathFrameSrc;
  h.at(130000); h.page.onShow();
  assert.equal(h.page.breathFrameSrc, frozen, 'background wall time must not advance the artwork');
  assert.equal([...h.timers.values()].filter(t=>!t.once).length, 2, 'one existing session clock and one health clock');
  h.page.onDestroy(); assert.equal(h.timers.size,0);
});

test('boxing artwork returns to guard and a scored hit does not restart an extending punch', () => {
  const h = harness(); h.page.startBoxing(); h.motion(0);
  assert(h.page.fighterFrameSrc.endsWith('/guard-00.png'));
  h.at(900); h.page.boxingTick();
  assert(h.page.fighterFrameSrc.endsWith('/punch-00.png'));
  h.at(1000); h.page.boxingTick(); const extending = h.page.fighterFrameSrc;
  assert(extending.endsWith('/punch-02.png'));
  h.page.registerPunch(NOW+1000);
  assert.equal(h.page.fighterFrameSrc, extending, 'hit feedback preserves the current arm pose');
  assert.equal(h.page.boxingScoreText, '100');
  h.at(1300); h.page.boxingTick();
  assert(h.page.fighterFrameSrc.endsWith('/punch-08.png'));
  h.at(1500); h.page.boxingTick();
  assert(h.page.fighterFrameSrc.includes('/guard-'), 'completed visual gesture must not leave the arm extended');
  h.page.onHide(); const frozen = h.page.fighterFrameSrc;
  h.at(80000); h.page.onShow();
  assert.equal(h.page.fighterFrameSrc, frozen, 'resuming must not replay a missed beat');
  assert.equal(h.page.boxingScoreText, '100');
  h.page.onDestroy(); assert.equal(h.timers.size,0);
});

test('boxing waits for a valid three-axis baseline, then records its actual start health', () => {
  const h = harness(); h.push(0, 90); h.page.startBoxing();
  const attempt = h.motionAttempts[0];
  h.page.startBoxing();
  assert.equal(h.motionAttempts.length, 1, 'double tap must not restart preparation');
  h.at(1200); h.page.boxingTick();
  assert.equal(h.page.boxingClock, null); assert.equal(h.page.boxingRemainingText, '30');
  assert.equal(h.page.boxingBeatAt, 0); assert.equal(h.page.boxingStats.targets, 0);
  assert.equal(h.page.motionConnected, false);
  assert.equal([...h.timers.values()].filter(t => t.ms === 50).length, 0);
  h.push(0, 85, 1200); h.motion(20, 30, 40);
  assert.equal(h.page.sessionStartedAt, NOW + 1200);
  assert.equal(h.page.baselineSamples.heartRate.value, 85);
  assert.equal(h.page.motionActions, 0); assert.equal(h.page.boxingScoreText, '0');
  h.at(2100); h.page.boxingTick(); h.motion(25, 30, 40);
  assert.equal(h.page.boxingScoreText, '100');
  h.at(30000); h.page.boxingTick(); assert.equal(h.page.view, 'boxing');
  h.at(31200); h.page.boxingTick(); assert.equal(h.page.view, 'boxingResult');
  h.page.onDestroy(); assert.equal(h.timers.size, 0);
});

for (const mode of ['timeout', 'callback', 'throw', 'running', 'malformed', 'invalid-preparing', 'invalid-reconnecting']) {
  test(`motion ${mode} failure releases the round and cannot become a normal result`, () => {
    const h = harness({ motionFails: mode === 'callback', motionThrows: mode === 'throw' });
    h.page.startBoxing();
    if (mode === 'invalid-preparing') h.motionAttempts[0].callback({ x: NaN, y: 0, z: 0 });
    if (mode === 'invalid-reconnecting') {
      h.motion(0); h.at(900); h.page.onHide(); h.at(1000); h.page.onShow();
      h.motionAttempts.at(-1).callback({ x: 0, y: 0 });
    }
    if (mode === 'timeout') h.timeout();
    if (mode === 'running' || mode === 'malformed') {
      h.motion(0); h.at(900); h.page.boxingTick();
      if (mode === 'running') h.motionError();
      else h.motionAttempts[0].callback({ x: Infinity, y: 0, z: 0 });
    }
    assert.equal(h.page.view, 'boxingFailure'); assert(h.page.boxingFailureReason.length > 0);
    assert.equal(h.motionCount(), 0); assert.equal(h.timers.size, 1);
    h.at(60000); h.page.boxingTick(); h.page.finishBoxing();
    assert.equal(h.page.view, 'boxingFailure'); assert(!h.audits.some(a => a.event === 'complete'));
    h.page.returnHome(); assert.equal(h.page.view, 'home');
    h.page.onDestroy(); assert.equal(h.timers.size, 0);
  });
}

test('retry discards old samples, errors and timer callbacks and begins a wholly new round', () => {
  const h = harness(); h.page.startBoxing();
  const old = h.motionAttempts[0]; const timeout = [...h.timers.values()].find(t => t.ms === 1600).callback;
  h.motion(0); const tick = [...h.timers.values()].find(t => t.ms === 50).callback;
  h.at(900); h.page.boxingTick(); h.motion(5); assert.equal(h.page.boxingStats.score, 100);
  h.motionError(); h.page.retryBoxing(); h.page.retryBoxing();
  assert.equal(h.motionAttempts.length, 2); assert.equal(h.motionCount(), 1);
  assert.equal(h.page.boxingStats.score, 0); assert.equal(h.page.motionActions, 0);
  old.callback({ x: 99, y: 99, z: 99 }); old.fail('late', 200); timeout(); tick();
  assert.equal(h.page.boxingClock, null); assert.equal(h.page.motionConnected, false);
  h.at(1400); h.motion(30); assert.equal(h.page.motionActions, 0);
  timeout(); tick(); assert.equal(h.page.view, 'boxing'); assert.equal(h.page.boxingRemainingText, '30');
  h.at(2300); h.page.boxingTick(); h.motion(35); assert.equal(h.page.boxingStats.score, 100);
  h.page.onDestroy(); old.callback({ x: 0, y: 0, z: 0 }); tick();
  assert.equal(h.timers.size, 0); assert.equal(h.motionCount(), 0);
});

test('synchronous connection is safe, while stationary data never means sensor failure', () => {
  const h = harness({ synchronousMotion: { x: 0, y: 0, z: 9.8 } }); h.page.startBoxing();
  assert.equal([...h.timers.values()].filter(t => t.once).length, 0);
  assert.equal([...h.timers.values()].filter(t => t.ms === 50).length, 1);
  for (let n = 1; n <= 30; n++) { h.at(n * 1000); h.motion(0); h.page.boxingTick(); }
  assert.equal(h.page.view, 'boxingResult'); assert.equal(h.page.boxingResultScore, '0');
  assert.equal(h.page.motionActions, 0); h.page.onDestroy();
});

for (const kind of ['breathing', 'boxing']) {
  for (const [label, measured, expected] of [['first second', 1000, false], ['before window', -10001, false],
    ['window boundary', -10000, true], ['inside window', -9999, true], ['completion boundary', 0, true]]) {
    test(`${kind} comparison handles ${label} using measurement time`, () => {
      const h = harness(); const end = kind === 'breathing' ? 60000 : 30000;
      h.push(0, 90); h.push(9, 40);
      if (kind === 'breathing') h.page.startTraining(); else { h.page.startBoxing(); h.motion(0); }
      h.at(end); const at = measured > 0 ? measured : end + measured;
      h.push(0, 80, at); h.push(9, 30, at);
      if (kind === 'breathing') {
        h.page.tick(); assert.equal(h.page.resultHeartRateDelta, expected ? '-10 bpm' : '无法比较');
        assert.equal(h.page.resultStressDelta, expected ? '-10 分' : '无法比较');
        if (!expected) assert.match(h.page.resultHeartRateDetail, /结束/);
      } else {
        h.page.boxingTick(); assert.equal(h.page.boxingResultHeartRate.includes('90 → 80'), expected);
        assert.equal(h.page.boxingResultStress.includes('40 → 30'), expected);
      }
      h.page.onDestroy();
    });
  }
}

test('missing baseline and missing end are explained independently for each metric', () => {
  const h = harness(); h.push(0, 90); h.page.startTraining();
  h.at(55000); h.push(9, 30, 55000); h.at(60000); h.page.tick();
  assert.match(h.page.resultHeartRateDetail, /结束/); assert.match(h.page.resultStressDetail, /基线/);
  assert.equal(h.page.resultHeartRateDelta, '无法比较'); assert.equal(h.page.resultStressDelta, '无法比较');
  h.page.onDestroy();
  const b = harness(); b.push(9, 40); b.page.startBoxing(); b.motion(0);
  b.at(25000); b.push(9, 30, 25000); b.at(30000); b.page.boxingTick();
  assert.match(b.page.boxingResultHeartRate, /基线/); assert.match(b.page.boxingResultStress, /40 → 30/);
  b.page.onDestroy();
});

for (const kind of ['breathing', 'boxing']) {
  test(`${kind} excludes late background and reconnect-wait measurements but accepts foreground ones`, () => {
    for (const measured of [69000, 70000, 70500, 71000, 75000]) {
      const h = harness(); h.push(0, 90); h.push(9, 40);
      if (kind === 'breathing') h.page.startTraining(); else { h.page.startBoxing(); h.motion(0); }
      const duration = kind === 'breathing' ? 60000 : 30000;
      const pause = duration - 5000;
      h.at(pause); h.page.onHide(); h.at(71000); h.page.onShow();
      if (kind === 'boxing') { h.at(72000); h.motion(20); }
      h.at(75000); h.push(0, 80, measured); h.push(9, 30, measured);
      h.at(kind === 'breathing' ? 76000 : 77000);
      if (kind === 'breathing') {
        h.page.tick(); assert.equal(h.page.resultHeartRateDelta, measured >= 71000 ? '-10 bpm' : '无法比较');
      } else {
        h.page.boxingTick(); assert.equal(h.page.boxingResultHeartRate.includes('90 → 80'), measured >= 72000);
      }
      h.page.onDestroy();
    }
  });
}

test('pausing settles only the displayed unhit target once, never a hit or a future target', () => {
  for (const state of ['future', 'pending', 'hit', 'missed']) {
    const h = harness(); h.page.startBoxing(); h.motion(0);
    h.at(state === 'future' ? 800 : 900); h.page.boxingTick();
    if (state === 'hit') h.motion(5);
    if (state === 'missed') { h.at(1251); h.page.boxingTick(); }
    h.page.onHide(); h.page.onHide();
    const count = state === 'future' ? 0 : 1;
    assert.equal(h.page.boxingStats.targets, count); assert.equal(h.timers.size, 0);
    h.at(10000); h.page.onShow(); h.page.onShow();
    assert.equal(h.page.boxingStats.targets, count); h.motion(20);
    assert.equal(h.page.boxingStats.targets, count); assert.equal(h.page.motionActions, state === 'hit' ? 1 : 0);
    h.page.onDestroy();
  }
});

test('resume establishes a fresh pose without bypassing the 350ms debounce', () => {
  const h = harness(); h.page.startBoxing(); h.motion(0);
  h.at(900); h.page.boxingTick(); h.motion(5); assert.equal(h.page.boxingStats.score, 100);
  const old = h.motionAttempts[0]; const tick = [...h.timers.values()].find(t => t.ms === 50).callback;
  h.at(910); h.page.onHide(); h.at(920); h.page.onShow();
  old.callback({ x: 90, y: 0, z: 9.8 }); old.fail('late', 200); tick();
  assert.equal(h.page.boxingClock.pausedAt, NOW + 910);
  h.at(930); h.motion(50); assert.equal(h.page.motionActions, 1);
  h.at(1000); h.motion(55); assert.equal(h.page.motionActions, 1, 'old punch cooldown survives reset');
  h.at(1020); h.page.boxingTick(); h.at(1250); h.motion(50);
  assert.equal(h.page.motionActions, 2); assert.equal(h.page.boxingStats.score, 170);
  h.page.onDestroy();
});

test('reconnection timeout interrupts a paused round; preparation also survives repeated hide/show', () => {
  const h = harness(); h.page.startBoxing(); h.page.onHide(); h.page.onHide();
  const old = h.motionAttempts[0]; h.at(10000); h.page.onShow(); h.page.onShow();
  assert.equal(h.motionCount(), 1); old.callback({ x: 0, y: 0, z: 0 });
  assert.equal(h.page.boxingClock, null); h.motion(0);
  h.at(11000); h.page.boxingTick(); h.page.onHide(); h.at(20000); h.page.onShow();
  h.timeout(); assert.equal(h.page.view, 'boxingFailure'); assert.equal(h.motionCount(), 0);
  h.page.onDestroy();
});

test('repeated background transitions retain exactly 30 seconds of active time and one runtime', () => {
  const h = harness(); h.page.startBoxing(); h.motion(0);
  let wall = 0;
  for (let n = 0; n < 5; n++) {
    wall += 1000; h.at(wall); h.page.boxingTick(); h.page.onHide(); h.page.onHide();
    assert.equal(h.timers.size, 0); assert.equal(h.motionCount(), 0);
    wall += 2000; h.at(wall); h.page.onShow(); h.page.onShow();
    wall += 500; h.at(wall); h.page.boxingTick();
    assert.equal([...h.timers.values()].filter(t => t.ms === 50).length, 0);
    h.motion(40 + n * 20); assert.equal(h.page.motionActions, 0);
    assert.equal(h.motionCount(), 1); assert.equal(h.subscriptions.size, 2);
    assert.equal([...h.timers.values()].filter(t => t.ms === 50).length, 1);
    assert.equal([...h.timers.values()].filter(t => t.ms === 1000).length, 1);
    assert.equal(h.page.boxingRemainingText, String(30 - n - 1));
  }
  h.at(wall + 24999); h.page.boxingTick(); assert.equal(h.page.view, 'boxing');
  h.at(wall + 25000); h.page.boxingTick(); assert.equal(h.page.view, 'boxingResult');
  assert.equal(h.audits.filter(a => a.event === 'complete').length, 1);
  h.page.onDestroy(); assert.equal(h.timers.size, 0); assert.equal(h.motionCount(), 0);
});

for (const kind of ['breathing', 'boxing']) {
  test(`${kind} retains the previous end sample when the newest is on the excluded pause boundary`, () => {
    const h = harness(); const duration = kind === 'breathing' ? 60000 : 30000;
    const pause = duration - 5000;
    h.push(0, 90); if (kind === 'breathing') h.page.startTraining(); else { h.page.startBoxing(); h.motion(0); }
    h.at(pause - 100); h.push(0, 80, pause - 100);
    h.at(pause); h.push(0, 70, pause); h.page.onHide();
    h.at(pause + 1000); h.page.onShow(); if (kind === 'boxing') { h.at(pause + 2000); h.motion(50); }
    h.at(duration + (kind === 'boxing' ? 2000 : 1000));
    if (kind === 'breathing') { h.page.tick(); assert.equal(h.page.resultHeartRateDelta, '-10 bpm'); }
    else { h.page.boxingTick(); assert.match(h.page.boxingResultHeartRate, /90 → 80/); }
    h.page.onDestroy();
  });
  for (const scenario of ['late valid sample', 'background history flood']) {
    test(`${kind} retains its own end candidate despite ${scenario}`, () => {
      const h = harness(); const duration = kind === 'breathing' ? 60000 : 30000;
      const pause = duration - 5000;
      h.push(0, 90); h.push(9, 40);
      if (kind === 'breathing') h.page.startTraining(); else { h.page.startBoxing(); h.motion(0); }
      if (scenario === 'background history flood') { h.at(pause - 100); h.push(0, 80, pause - 100); }
      h.at(pause); h.page.onHide(); h.at(pause + 1000); h.page.onShow();
      for (let i = 1; i <= 10; i++) h.push(0, 110, pause + i * 50);
      if (scenario === 'late valid sample') h.push(0, 80, pause - 100);
      if (kind === 'boxing') { h.at(pause + 2000); h.motion(50); }
      h.at(duration + (kind === 'boxing' ? 2000 : 1000));
      if (kind === 'breathing') { h.page.tick(); assert.equal(h.page.resultHeartRateDelta, '-10 bpm'); }
      else { h.page.boxingTick(); assert.match(h.page.boxingResultHeartRate, /90 → 80/); }
      assert.equal(h.page.heartRate, 110, 'home display retains its own existing latest-sample policy');
      h.page.onDestroy();
    });
  }
  test(`${kind} finishes at the active-time boundary even when hide wins the timer race`, () => {
    const h = harness(); const duration = kind === 'breathing' ? 60000 : 30000;
    h.push(0, 90); h.push(9, 40);
    if (kind === 'breathing') h.page.startTraining(); else { h.page.startBoxing(); h.motion(0); }
    h.at(duration - 1); h.push(0, 80, duration - 1);
    h.at(duration); h.page.onHide(); h.at(duration + 40000); h.page.onShow();
    assert.equal(h.page.view, kind === 'breathing' ? 'result' : 'boxingResult');
    if (kind === 'breathing') assert.equal(h.page.resultHeartRateDelta, '-10 bpm');
    else assert.match(h.page.boxingResultHeartRate, /90 → 80/);
    assert.equal(h.audits.filter(a => a.event === 'complete').length, 1);
    assert.equal(h.motionCount(), 0); assert.equal(h.timers.size, 1);
    h.page.onDestroy();
  });
  test(`${kind} uses the real completion deadline when its timer callback arrives late`, () => {
    const h = harness(); const duration = kind === 'breathing' ? 60000 : 30000;
    h.push(0, 90); if (kind === 'breathing') h.page.startTraining(); else { h.page.startBoxing(); h.motion(0); }
    h.at(duration - 10000); h.push(0, 80, duration - 10000);
    h.at(duration + 50); if (kind === 'breathing') h.page.tick(); else h.page.boxingTick();
    if (kind === 'breathing') assert.equal(h.page.resultHeartRateDelta, '-10 bpm');
    else assert.match(h.page.boxingResultHeartRate, /90 → 80/);
    h.page.onDestroy();
  });
}
