const clock = require('./session-clock.js');
const subscriptions = require('./subscription-lifecycle.js');

function createResourceController(options) {
  const config = options || {};
  const healthTypes = Array.isArray(config.healthTypes) ? config.healthTypes.slice() : [];
  let visible = false;
  let healthState = subscriptions.createSubscriptionState(healthTypes);
  let healthEpochs = {};
  let recentEpoch = 0;
  let recentPending = false;
  let motionEpoch = 0;
  let motionActive = false;

  function nextHealthEpoch(type) {
    const key = String(type);
    const next = (healthEpochs[key] || 0) + 1;
    healthEpochs = { ...healthEpochs, [key]: next };
    return next;
  }

  function isCurrentHealth(type, epoch) {
    return visible
      && healthEpochs[String(type)] === epoch
      && healthState.activeTypes.includes(type);
  }

  function startRecentHealth() {
    if (!visible || recentPending || typeof config.getRecentHealth !== 'function') return;
    const epoch = recentEpoch + 1;
    recentEpoch = epoch;
    recentPending = true;
    let request;
    try {
      request = config.getRecentHealth(healthTypes);
    } catch (error) {
      if (recentEpoch === epoch) recentPending = false;
      if (visible && recentEpoch === epoch && config.onHealthError) config.onHealthError(error);
      return;
    }
    Promise.resolve(request).then(
      (samples) => {
        if (recentEpoch !== epoch) return;
        recentPending = false;
        if (!visible || !Array.isArray(samples) || !config.onHealthSample) return;
        samples.forEach((sample) => config.onHealthSample(sample));
      },
      (error) => {
        if (recentEpoch !== epoch) return;
        recentPending = false;
        if (visible && config.onHealthError) config.onHealthError(error);
      },
    );
  }

  function startHealth(loadRecent) {
    if (!visible) return;
    if (loadRecent) startRecentHealth();
    subscriptions.typesToSubscribe(healthState).forEach((type) => {
      const epoch = nextHealthEpoch(type);
      healthState = subscriptions.markSubscribed(healthState, type);
      const onSample = (sample) => {
        if (isCurrentHealth(type, epoch) && config.onHealthSample) config.onHealthSample(sample);
      };
      const onError = (error) => {
        if (healthEpochs[String(type)] !== epoch) return;
        healthState = subscriptions.markUnsubscribed(healthState, type);
        if (visible && config.onHealthError) config.onHealthError(error, type);
      };
      try {
        config.subscribeHealth(type, onSample, onError);
      } catch (error) {
        onError(error);
      }
    });
  }

  function stopHealth() {
    const failures = [];
    subscriptions.typesToUnsubscribe(healthState).forEach((type) => {
      nextHealthEpoch(type);
      healthState = subscriptions.markUnsubscribed(healthState, type);
      try {
        const result = config.unsubscribeHealth(type);
        if (result && result.ok === false) failures.push({ type, error: result.error });
      } catch (error) {
        failures.push({ type, error });
      }
    });
    return failures;
  }

  function stopMotion() {
    const wasActive = motionActive;
    motionEpoch += 1;
    motionActive = false;
    if (!wasActive) return [];
    try {
      const result = config.unsubscribeMotion();
      return result && result.ok === false ? [result.error] : [];
    } catch (error) {
      return [error];
    }
  }

  function startMotion() {
    if (!visible || motionActive) return false;
    motionActive = true;
    const epoch = motionEpoch + 1;
    motionEpoch = epoch;
    const onSample = (sample) => {
      if (visible && motionActive && motionEpoch === epoch && config.onMotionSample) {
        config.onMotionSample(sample);
      }
    };
    const onError = (error) => {
      if (!visible || !motionActive || motionEpoch !== epoch) return;
      stopMotion();
      if (visible && config.onMotionError) config.onMotionError(error);
    };
    try {
      config.subscribeMotion(onSample, onError);
    } catch (error) {
      onError(error);
    }
    return motionActive;
  }

  function enterForeground() {
    visible = true;
  }

  function leaveForeground() {
    visible = false;
    recentEpoch += 1;
    recentPending = false;
    healthTypes.forEach((type) => nextHealthEpoch(type));
    motionEpoch += 1;
  }

  return {
    enterForeground,
    leaveForeground,
    startHealth,
    stopHealth,
    startMotion,
    stopMotion,
  };
}

function resumeSession(sessionClock, now, handlers) {
  const actions = handlers || {};
  const resumedClock = clock.resumeClock(sessionClock, now);
  if (actions.updateClock) actions.updateClock(resumedClock);
  if (clock.isComplete(resumedClock, now)) {
    if (actions.complete) actions.complete();
    return { clock: resumedClock, completed: true };
  }
  if (actions.rearm) actions.rearm(resumedClock);
  return { clock: resumedClock, completed: false };
}

module.exports = { createResourceController, resumeSession };
