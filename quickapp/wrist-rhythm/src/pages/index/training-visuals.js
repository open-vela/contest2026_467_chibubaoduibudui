// Rendering uses the same foreground clocks as the sessions; no extra timers.
const ASSET_ROOT = '/common/training-8a8ab3423b8f';
const FEMALE_ASSET_ROOT = '/common/fighter-female-3283c8a4601e';
function framePath(name, frame, root = ASSET_ROOT) {
  return root + '/' + name + '-' + String(frame).padStart(2, '0') + '.png';
}

function breathFrame(cycleElapsed, pattern) {
  const cycle = pattern.inhaleMs + pattern.holdMs + pattern.exhaleMs;
  const at = Math.max(0, cycleElapsed) % cycle;
  let value;
  if (at < pattern.inhaleMs) value = (1 - Math.cos(Math.PI * at / pattern.inhaleMs)) / 2;
  else if (at < pattern.inhaleMs + pattern.holdMs) value = 1;
  else value = (1 + Math.cos(Math.PI * (at - pattern.inhaleMs - pattern.holdMs) / pattern.exhaleMs)) / 2;
  return framePath('breath', Math.round(value * 40));
}

function fighterFrame(elapsed, visualAt, gender = 'male') {
  const root = gender === 'female' ? FEMALE_ASSET_ROOT : ASSET_ROOT;
  const age = typeof visualAt === 'number' ? elapsed - visualAt : -1;
  if (age >= 0 && age < 600) return framePath('punch', Math.min(11, Math.floor(age / 50)), root);
  return framePath('guard', Math.floor(Math.max(0, elapsed) / 200) % 8, root);
}

module.exports = { breathFrame, fighterFrame };
