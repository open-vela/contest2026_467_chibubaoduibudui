// 节奏拳纯逻辑层。动作识别只依赖相邻加速度向量的变化。

const GAME_MS = 30000;
const HIT_WINDOW_MS = 350;

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validSample(sample) {
  return sample && finite(sample.x) && finite(sample.y) && finite(sample.z);
}

function vectorDelta(previous, current) {
  const dx = current.x - previous.x;
  const dy = current.y - previous.y;
  const dz = current.z - previous.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function createPunchDetector(options) {
  const config = options || {};
  const threshold = finite(config.threshold) ? config.threshold : 4.5;
  const cooldownMs = finite(config.cooldownMs) ? config.cooldownMs : 350;
  let previous = null;
  let lastPunchAt = -Infinity;

  return {
    push(sample, timestamp) {
      if (!validSample(sample) || !finite(timestamp)) return false;
      if (!previous) {
        previous = sample;
        return false;
      }
      const movement = vectorDelta(previous, sample);
      previous = sample;
      if (movement < threshold || timestamp - lastPunchAt < cooldownMs) return false;
      lastPunchAt = timestamp;
      return true;
    },
  };
}

function scorePunch(punchAt, beatAt) {
  const difference = Math.abs(punchAt - beatAt);
  if (difference <= 120) return { points: 100, grade: 'perfect' };
  if (difference <= 250) return { points: 70, grade: 'good' };
  if (difference <= HIT_WINDOW_MS) return { points: 40, grade: 'hit' };
  return { points: 0, grade: 'miss' };
}

function beatIntervalForHeartRate(heartRate) {
  if (!finite(heartRate) || heartRate < 120) return 1000;
  if (heartRate < 150) return 1200;
  return 1400;
}

function createStats() {
  return { score: 0, hits: 0, targets: 0, streak: 0, maxStreak: 0 };
}

function recordHit(stats, points) {
  const current = stats || createStats();
  const streak = current.streak + 1;
  return {
    score: current.score + points,
    hits: current.hits + 1,
    targets: current.targets + 1,
    streak,
    maxStreak: Math.max(current.maxStreak, streak),
  };
}

function recordMiss(stats) {
  const current = stats || createStats();
  return {
    score: current.score,
    hits: current.hits,
    targets: current.targets + 1,
    streak: 0,
    maxStreak: current.maxStreak,
  };
}

module.exports = {
  GAME_MS,
  HIT_WINDOW_MS,
  createPunchDetector,
  scorePunch,
  beatIntervalForHeartRate,
  createStats,
  recordHit,
  recordMiss,
};
