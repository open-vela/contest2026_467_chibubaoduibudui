// 稳态训练纯逻辑层。无框架和系统 API 依赖，可直接在 Node.js 中测试。

const SESSION_MS = 60000;
const SAMPLE_WINDOW = 8;

const PATTERNS = {
  standard: {
    name: 'standard',
    inhaleMs: 4000,
    holdMs: 2000,
    exhaleMs: 4000,
  },
  calming: {
    name: 'calming',
    inhaleMs: 4000,
    holdMs: 2000,
    exhaleMs: 6000,
  },
};
function isValidNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function pushWindow(values, value, max) {
  const source = Array.isArray(values) ? values : [];
  if (!isValidNumber(value)) return source.slice();
  const next = source.concat([value]);
  const limit = Math.max(1, max || SAMPLE_WINDOW);
  return next.length > limit ? next.slice(next.length - limit) : next;
}

function average(values) {
  if (!values || values.length === 0) return null;
  let total = 0;
  for (let i = 0; i < values.length; i += 1) total += values[i];
  return total / values.length;
}

function recentAverage(values, start, count) {
  return average(values.slice(start, start + count));
}

function shouldSuggest(heartRates, stresses) {
  const hr = Array.isArray(heartRates) ? heartRates : [];
  const stress = Array.isArray(stresses) ? stresses : [];
  if (hr.length < 4 || stress.length < 4) return { suggest: false, reason: 'stable' };

  const recentHr = average(hr.slice(-4));
  const recentStress = average(stress.slice(-4));
  if (recentStress >= 40) return { suggest: true, reason: 'stress_high' };
  if (recentHr >= 110) return { suggest: true, reason: 'heart_rate_high' };

  if (stress.length >= 8) {
    const previousStress = recentAverage(stress, stress.length - 8, 4);
    if (recentStress - previousStress >= 6) return { suggest: true, reason: 'stress_rising' };
  }
  if (hr.length >= 8) {
    const previousHr = recentAverage(hr, hr.length - 8, 4);
    if (recentHr - previousHr >= 10) {
      return { suggest: true, reason: 'heart_rate_rising' };
    }
  }
  return { suggest: false, reason: 'stable' };
}

function selectPattern(stress, currentHr, baselineHr) {
  if (isValidNumber(stress) && stress >= 40) return PATTERNS.calming;
  if (isValidNumber(currentHr) && isValidNumber(baselineHr) && currentHr - baselineHr >= 5) {
    return PATTERNS.calming;
  }
  return PATTERNS.standard;
}

function phaseAt(elapsedMs, pattern) {
  const elapsed = Math.max(0, elapsedMs || 0);
  if (elapsed >= SESSION_MS) {
    return { phase: 'complete', label: '完成', progress: 1, complete: true };
  }

  const rhythm = pattern || PATTERNS.standard;
  const cycleMs = rhythm.inhaleMs + rhythm.holdMs + rhythm.exhaleMs;
  const inCycle = elapsed % cycleMs;
  if (inCycle < rhythm.inhaleMs) {
    return {
      phase: 'inhale',
      label: '慢慢吸气',
      progress: inCycle / rhythm.inhaleMs,
      complete: false,
    };
  }
  if (inCycle < rhythm.inhaleMs + rhythm.holdMs) {
    return {
      phase: 'hold',
      label: '轻轻停留',
      progress: (inCycle - rhythm.inhaleMs) / rhythm.holdMs,
      complete: false,
    };
  }
  return {
    phase: 'exhale',
    label: '缓缓呼气',
    progress: (inCycle - rhythm.inhaleMs - rhythm.holdMs) / rhythm.exhaleMs,
    complete: false,
  };
}

function delta(before, after) {
  if (!isValidNumber(before) || !isValidNumber(after)) return null;
  return Math.round(after - before);
}

function clean(value) {
  return isValidNumber(value) ? Math.round(value) : null;
}

function buildResult(baseline, latest) {
  const before = baseline || {};
  const after = latest || {};
  return {
    beforeHeartRate: clean(before.heartRate),
    afterHeartRate: clean(after.heartRate),
    heartRateDelta: delta(before.heartRate, after.heartRate),
    beforeStress: clean(before.stress),
    afterStress: clean(after.stress),
    stressDelta: delta(before.stress, after.stress),
  };
}

module.exports = {
  SESSION_MS,
  SAMPLE_WINDOW,
  PATTERNS,
  pushWindow,
  shouldSuggest,
  selectPattern,
  phaseAt,
  buildResult,
};
