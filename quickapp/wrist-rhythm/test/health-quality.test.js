const assert = require('assert');
const { test } = require('node:test');
const core = require('../src/pages/index/health-core');
const steady = require('../src/pages/index/steady');
const quality = require('../src/pages/index/health-quality');
const NOW = 1791700000000;
const sample = (value, timeStamp = NOW) => ({ ok: true, value, timeStamp });

test('recent-query rejection is reported without an undefined per-metric variable', async () => {
  const errors = [];
  const lifecycle = require('../src/pages/index/page-lifecycle');
  const controller = lifecycle.createResourceController({
    healthTypes: [], getRecentHealth: () => Promise.reject(new Error('recent unavailable')),
    onHealthError: (error, type) => errors.push({ error, type }),
  });
  controller.enterForeground(); controller.startHealth(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(errors.length, 1);
  assert.equal(errors[0].type, undefined);
});

test('invalid numeric samples never reach the page', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.equal(core.normalizeSample(0, { value, timeStamp: NOW }), null);
    assert.equal(core.normalizeSample(0, { value: 72, timeStamp: value }), null);
  }
});

test('one available metric can independently trigger a suggestion', () => {
  assert.equal(steady.shouldSuggest([111, 112, 113, 114], []).reason, 'heart_rate_high');
  assert.equal(steady.shouldSuggest([], [41, 42, 43, 44]).reason, 'stress_high');
  assert.equal(steady.shouldSuggest([120], []).suggest, false);
});

test('duplicate/out-of-order samples do not accumulate evidence or overwrite newer values', () => {
  let state = quality.ingest(null, sample(80), 'heartRate', NOW);
  state = quality.ingest(state, sample(120), 'heartRate', NOW + 1000);
  state = quality.ingest(state, sample(130, NOW - 1000), 'heartRate', NOW + 1000);
  assert.equal(state.latest.value, 80);
  assert.equal(quality.values(state, 'heartRate', NOW + 1000).length, 1);
});

test('epoch seconds and milliseconds converge; unknown/future times are rejected', () => {
  assert.equal(quality.ingest(null, sample(72, NOW / 1000), 'heartRate', NOW).latest.measuredAt, NOW);
  for (const timestamp of [0, -1, NaN, Infinity, NOW + 1000]) {
    assert.equal(quality.ingest(null, sample(72, timestamp), 'heartRate', NOW), null);
  }
});

test('freshness expires without another callback and is independent by metric', () => {
  const hr = quality.ingest(null, sample(72), 'heartRate', NOW);
  const stress = quality.ingest(null, sample(25), 'stress', NOW);
  assert.equal(quality.status(hr, 'heartRate', NOW + 60001), 'stale');
  assert.equal(quality.status(stress, 'stress', NOW + 60001), 'ready');
  assert.deepEqual(quality.values(hr, 'heartRate', NOW + 60001), []);
  assert.equal(quality.value(hr, 'heartRate', NOW + 60001), null);
});

test('new samples prune stale history and retain at most eight distinct measurements', () => {
  let state = quality.ingest(null, sample(130), 'heartRate', NOW);
  state = quality.ingest(state, sample(70, NOW + 61000), 'heartRate', NOW + 61000);
  assert.deepEqual(quality.values(state, 'heartRate', NOW + 61000), [70]);
  for (let i = 1; i <= 10; i++) state = quality.ingest(state, sample(70 + i, NOW + 61000 + i), 'heartRate', NOW + 61000 + i);
  assert.deepEqual(quality.values(state, 'heartRate', NOW + 61010), [73, 74, 75, 76, 77, 78, 79, 80]);
});

test('comparison needs a valid baseline and a newer measurement made after session start', () => {
  const before = quality.ingest(null, sample(90, NOW - 1000), 'heartRate', NOW);
  const baseline = quality.baseline(before, 'heartRate', NOW);
  assert.equal(quality.compare(baseline, before, 'heartRate', NOW, NOW + 30000), null);
  const old = quality.ingest(before, sample(80, NOW - 500), 'heartRate', NOW + 1000);
  assert.equal(quality.compare(baseline, old, 'heartRate', NOW, NOW + 30000), null);
  const after = quality.ingest(before, sample(80, NOW + 50000), 'heartRate', NOW + 50000);
  assert.deepEqual(quality.compare(baseline, after, 'heartRate', NOW, NOW + 60000), { before: 90, after: 80, delta: -10 });
  assert.equal(quality.compare(null, after, 'heartRate', NOW, NOW + 60000), null);
  assert.equal(quality.compare(baseline, after, 'heartRate', NOW, NOW + 70001), null);
});

test('end window is independently configurable without changing metric freshness', () => {
  const state = quality.ingest(null, sample(80, NOW + 1000), 'heartRate', NOW + 1000);
  const before = { value: 90, measuredAt: NOW };
  assert.equal(quality.status(state, 'heartRate', NOW + 60000), 'ready');
  assert.equal(quality.compare(before, state, 'heartRate', NOW, NOW + 60000), null);
  assert.deepEqual(quality.compare(before, state, 'heartRate', NOW, NOW + 60000, { endWindowMs: 60000 }),
    { before: 90, after: 80, delta: -10 });
  assert.deepEqual(quality.MAX_AGE_MS, { heartRate: 60000, stress: 300000 });
});

test('per-metric errors do not disappear when another metric succeeds', () => {
  const hr = quality.fail(null, { unsupported: true });
  assert.equal(quality.status(hr, 'heartRate', NOW), 'unsupported');
  const recovered = quality.ingest(hr, sample(72), 'heartRate', NOW);
  assert.equal(quality.status(recovered, 'heartRate', NOW), 'ready');
  assert.equal(quality.value(quality.fail(recovered, {}), 'heartRate', NOW), null);
});
