// Test environment only. Never copied into a normal Debug/Release build.
function createFaultSource(scenario, now) {
  const DATA_TYPES = { HEART_RATE: 0, STRESS: 9 };
  const readNow = now || (() => Date.now());
  const epoch = readNow();
  const enabled = type => scenario !== 'both-missing' && !(scenario === 'hr-missing' && type === 0) && !(scenario === 'stress-missing' && type === 9);
  const sample = type => ({value:type===0 ? scenario==='large-values'?220:80 : scenario==='large-values'?100:20,
    timeStamp:epoch-(scenario==='stale' ? type===0?55000:295000 : 0)});
  return {
    DATA_TYPES,
    getRecentSamples: () => Promise.resolve([0,9].filter(enabled).map(type=>({dataType:type,data:sample(type)}))),
    subscribeSample(options) { if(enabled(options.dataType)) options.callback(sample(options.dataType)); else options.fail('test fault injection',203); },
    unsubscribeSample() {},
  };
}
module.exports = { createFaultSource };
