const assert = require('node:assert/strict');
const { test } = require('node:test');
const profile = require('../src/pages/index/fighter-profile');
const visuals = require('../src/pages/index/training-visuals');

function memoryStorage(initial = '') {
  let value = initial;
  return {
    get({ success }) { success(value); },
    set({ value: next, success }) { value = next; success(); },
    value: () => value,
  };
}

test('female selection uses its own complete guard and punch sequence', () => {
  for (const [elapsed, visualAt, suffix] of [[0, null, '/guard-00.png'], [1400, null, '/guard-07.png'],
    [0, 0, '/punch-00.png'], [550, 0, '/punch-11.png'], [600, 0, '/guard-03.png']]) {
    const female = visuals.fighterFrame(elapsed, visualAt, 'female');
    assert(female.includes('/fighter-female-'), female);
    assert(female.endsWith(suffix), female);
    assert.notEqual(female, visuals.fighterFrame(elapsed, visualAt, 'male'));
  }
});

test('gender parsing rejects unknown numeric encodings and malformed profiles', () => {
  for (const [input, want] of [['female', 'female'], [' 男 ', 'male'], [{ gender: '女' }, 'female'],
    [{ sex: 'male' }, 'male'], [{ userInfo: { gender: 'female' } }, 'female'],
    [0, null], [1, null], [2, null], [{ gender: 1 }, null], [true, null], [null, null],
    ['', null], [{ gender: 'unknown' }, null]]) assert.equal(profile.normalizeGender(input), want);
});

test('valid owner profile takes priority over a saved manual choice', async () => {
  const storage = memoryStorage('male');
  const service = profile.createPreferences({ getUserInfo: () => Promise.resolve({ gender: 'female' }) }, storage);
  assert.deepEqual(await service.load().promise, { gender: 'female', source: 'profile' });
  assert.equal(storage.value(), 'male', 'automatic data must not overwrite the manual fallback');
});

test('unsupported or denied profile falls back to the saved choice', async () => {
  for (const provider of [{}, { getUserInfo({ fail }) { fail('denied', 201); } },
    { getUserInfo() { throw Error('unavailable'); } }, { getUserInfo: () => Promise.reject(Error('denied')) }]) {
    assert.deepEqual(await profile.createPreferences(provider, memoryStorage('female')).load().promise,
      { gender: 'female', source: 'saved' });
  }
});

test('first choice is saved and restored by a new preferences instance', async () => {
  const storage = memoryStorage();
  const first = profile.createPreferences({}, storage);
  assert.deepEqual(await first.load().promise, { gender: null, source: 'choice' });
  assert.equal(await first.save('female').promise, true);
  assert.equal(storage.value(), 'female');
  assert.deepEqual(await profile.createPreferences({}, storage).load().promise, { gender: 'female', source: 'saved' });
});

test('storage failure is reported instead of claiming the choice was remembered', async () => {
  const service = profile.createPreferences({}, { get({ fail }) { fail(); }, set({ fail }) { fail(); } });
  assert.deepEqual(await service.load().promise, { gender: null, source: 'choice' });
  assert.equal(await service.save('female').promise, false);
  assert.equal(await service.save('unknown').promise, false);
});

test('silent native callbacks time out and cancellation clears every pending timer', async () => {
  const timers = new Map(); let id = 0;
  const clock = { setTimeout(fn) { timers.set(++id, fn); return id; }, clearTimeout(key) { timers.delete(key); } };
  const service = profile.createPreferences({ getUserInfo() {} }, memoryStorage('female'), clock);
  const request = service.load();
  for (const callback of [...timers.values()]) callback();
  assert.deepEqual(await request.promise, { gender: 'female', source: 'saved' });
  assert.equal(timers.size, 0);
  const canceled = service.load(); canceled.cancel();
  await canceled.promise;
  assert.equal(timers.size, 0);
});
