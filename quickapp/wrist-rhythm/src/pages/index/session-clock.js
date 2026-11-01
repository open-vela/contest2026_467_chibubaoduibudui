function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function createClock(durationMs, startedAt) {
  return {
    durationMs: Math.max(0, finite(durationMs) ? durationMs : 0),
    startedAt: finite(startedAt) ? startedAt : 0,
    pausedAt: null,
    pausedMs: 0,
  };
}

function pauseClock(clock, now) {
  if (!clock || clock.pausedAt !== null || !finite(now)) return clock;
  return { ...clock, pausedAt: now };
}

function resumeClock(clock, now) {
  if (!clock || clock.pausedAt === null || !finite(now)) return clock;
  return {
    ...clock,
    pausedAt: null,
    pausedMs: clock.pausedMs + Math.max(0, now - clock.pausedAt),
  };
}

function elapsedMs(clock, now) {
  if (!clock || !finite(now)) return 0;
  const effectiveNow = clock.pausedAt === null ? now : clock.pausedAt;
  return Math.max(0, effectiveNow - clock.startedAt - clock.pausedMs);
}

function remainingMs(clock, now) {
  return Math.max(0, clock.durationMs - elapsedMs(clock, now));
}

function remainingSeconds(clock, now) {
  return Math.ceil(remainingMs(clock, now) / 1000);
}

function isComplete(clock, now) {
  return remainingMs(clock, now) === 0;
}

function completionTime(clock, now) {
  return clock ? Math.min(now, clock.startedAt + clock.pausedMs + clock.durationMs) : now;
}

function shouldScheduleInterval(clock, now) {
  return Boolean(clock) && !isComplete(clock, now);
}

function nextBeatAfterResume(effectiveElapsed, interval) {
  const elapsed = Math.max(0, effectiveElapsed || 0);
  const beatInterval = Math.max(1, interval || 1);
  return (Math.floor(elapsed / beatInterval) + 1) * beatInterval;
}

module.exports = {
  createClock,
  pauseClock,
  resumeClock,
  elapsedMs,
  remainingMs,
  remainingSeconds,
  isComplete,
  completionTime,
  shouldScheduleInterval,
  nextBeatAfterResume,
};
