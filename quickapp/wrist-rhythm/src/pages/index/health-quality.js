// 原型策略，不是厂商更新周期或医学阈值。设备校准见 docs/review-readiness.md。
const MAX_AGE_MS = { heartRate: 60000, stress: 300000 };
// 结果比较专用的原型策略；不是设备更新周期或医学标准。
const END_WINDOW_MS = 10000;
const MIN_EPOCH_MS = 946684800000; // 2000-01-01，拒绝启动计时/未知单位。

function measuredTime(timestamp) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  const milliseconds = timestamp < 100000000000 ? timestamp * 1000 : timestamp;
  return milliseconds >= MIN_EPOCH_MS ? milliseconds : null;
}

function validValue(value, metric) {
  if (!Number.isFinite(value)) return false;
  return metric === 'heartRate' ? value > 0 : metric === 'stress' && value >= 0 && value <= 100;
}

function ingest(state, sample, metric, now) {
  if (!sample || !sample.ok || !validValue(sample.value, metric)) return state;
  const measuredAt = measuredTime(sample.timeStamp);
  if (measuredAt === null || measuredAt > now) return state;
  if (state && state.latest && measuredAt <= state.latest.measuredAt) return state;
  const latest = { value: sample.value, measuredAt, receivedAt: now, source: 'device' };
  const history = (state && state.history || []).concat([latest])
    .filter((item) => now - item.measuredAt <= MAX_AGE_MS[metric]).slice(-8);
  return { latest, history, error: null };
}

function fail(state, error) {
  return { latest: state && state.latest || null, history: [], error: error && error.unsupported ? 'unsupported' : 'unavailable' };
}

function status(state, metric, now) {
  if (state && state.error) return state.error;
  if (!state || !state.latest) return 'waiting';
  const age = now - state.latest.measuredAt;
  return age < 0 || age > MAX_AGE_MS[metric] ? 'stale' : 'ready';
}

function value(state, metric, now) {
  return status(state, metric, now) === 'ready' ? state.latest.value : null;
}

function values(state, metric, now) {
  if (status(state, metric, now) !== 'ready') return [];
  return state.history.filter((item) => item.measuredAt <= now && now - item.measuredAt <= MAX_AGE_MS[metric])
    .map((item) => item.value);
}

function baseline(state, metric, now) {
  return status(state, metric, now) === 'ready' ? { ...state.latest } : null;
}

function validBaseline(before, metric, startedAt) {
  return before && validValue(before.value, metric) && Number.isFinite(before.measuredAt)
    && before.measuredAt <= startedAt && startedAt - before.measuredAt <= MAX_AGE_MS[metric];
}

function inForeground(measuredAt, intervals, now) {
  return intervals.some((range) => measuredAt >= range.start
    && (range.end === null ? measuredAt <= now
      : range.inclusiveEnd ? measuredAt <= range.end : measuredAt < range.end));
}

// 本局候选独立于首页 history，防止后台/重连测量挤出有效前台样本。
function ingestSession(state, sample, metric, now, startedAt, intervals, deadline) {
  const next = ingest(state, sample, metric, now);
  if (next === state || next.latest.measuredAt <= startedAt || next.latest.measuredAt > deadline
    || !inForeground(next.latest.measuredAt, intervals, now)) return state;
  // 暂停边界与最新样本同刻时，该样本会被区间校验排除；保留前一条候选。
  return { latest: next.latest, history: next.history.slice(-2), error: null };
}

function endSample(before, state, metric, startedAt, now, options) {
  if (status(state, metric, now) !== 'ready') return null;
  const config = options || {};
  const windowMs = Number.isFinite(config.endWindowMs) && config.endWindowMs >= 0 ? config.endWindowMs : END_WINDOW_MS;
  const intervals = config.foregroundIntervals || [{ start: startedAt, end: now, inclusiveEnd: true }];
  const candidates = (state.history || [state.latest]).slice().reverse();
  return candidates.find((item) => validValue(item.value, metric) && Number.isFinite(item.measuredAt)
    && item.measuredAt > startedAt && (!before || item.measuredAt > before.measuredAt)
    && item.measuredAt >= now - windowMs && item.measuredAt <= now
    && now - item.measuredAt <= MAX_AGE_MS[metric]
    && inForeground(item.measuredAt, intervals, now)) || null;
}

function compare(before, state, metric, startedAt, now, options) {
  if (!validBaseline(before, metric, startedAt)) return null;
  const after = endSample(before, state, metric, startedAt, now, options);
  if (!after) return null;
  return { before: Math.round(before.value), after: Math.round(after.value), delta: Math.round(after.value - before.value) };
}

function comparisonReason(before, state, metric, startedAt, now, options) {
  const missingBaseline = !validBaseline(before, metric, startedAt);
  const missingEnd = !endSample(before, state, metric, startedAt, now, options);
  return missingBaseline && missingEnd ? '缺少有效基线和结束样本'
    : missingBaseline ? '缺少有效基线' : missingEnd ? '缺少有效结束样本' : '';
}

module.exports = { MAX_AGE_MS, END_WINDOW_MS, ingest, ingestSession, fail, status, value, values, baseline, compare, comparisonReason };
