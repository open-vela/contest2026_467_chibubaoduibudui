const STORAGE_KEY = 'wristrhythm.fighter.gender.v1';
const TIMEOUT_MS = 1500;

function normalizeGender(value, depth = 0) {
  if (typeof value === 'string') {
    const gender = value.trim().toLowerCase();
    if (gender === 'male' || gender === '男') return 'male';
    if (gender === 'female' || gender === '女') return 'female';
  }
  if (value && typeof value === 'object' && depth < 2) {
    if (value.gender !== undefined) return normalizeGender(value.gender, depth + 1);
    if (value.sex !== undefined) return normalizeGender(value.sex, depth + 1);
    if (value.userInfo !== undefined) return normalizeGender(value.userInfo, depth + 1);
  }
  // Numeric gender enums differ between vendors. Do not guess their meaning.
  return null;
}

function createPreferences(provider, storage, timers = { setTimeout, clearTimeout }) {
  function operation(invoke, fallback) {
    let settled = false;
    let finish;
    let timer;
    const promise = new Promise((resolve) => {
      finish = (value) => {
        if (settled) return;
        settled = true;
        timers.clearTimeout(timer);
        resolve(value);
      };
      timer = timers.setTimeout(() => finish(fallback), TIMEOUT_MS);
      try { invoke(finish, () => finish(fallback)); } catch (error) { finish(fallback); }
    });
    return { promise, cancel: () => finish(fallback) };
  }

  function load() {
    const owner = operation((done, fail) => {
      // Optional vendor extension, NOT a guaranteed public Vela API. The
      // contest image has no confirmed owner-profile API and uses the picker.
      if (!provider || typeof provider.getUserInfo !== 'function') { done(null); return; }
      const result = provider.getUserInfo({ success: (value) => done(normalizeGender(value)), fail });
      if (result && typeof result.then === 'function') result.then((value) => done(normalizeGender(value)), fail);
      else if (result !== undefined) done(normalizeGender(result));
    }, null);
    const saved = operation((done, fail) => {
      storage.get({ key: STORAGE_KEY, default: '', success: (value) => done(normalizeGender(value)), fail });
    }, null);
    return {
      promise: Promise.all([owner.promise, saved.promise]).then(([automatic, manual]) => ({
        gender: automatic || manual,
        source: automatic ? 'profile' : manual ? 'saved' : 'choice',
      })),
      cancel() { owner.cancel(); saved.cancel(); },
    };
  }

  function save(value) {
    const gender = normalizeGender(value);
    return operation((done, fail) => {
      if (!gender) { done(false); return; }
      storage.set({ key: STORAGE_KEY, value: gender, success: () => done(true), fail });
    }, false);
  }

  return { load, save };
}

module.exports = { normalizeGender, createPreferences };
