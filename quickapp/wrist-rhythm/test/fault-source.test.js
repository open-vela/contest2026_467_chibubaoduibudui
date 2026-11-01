const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createFaultSource}=require('./fixtures/fault-source');
const adapter=require('../src/pages/index/health-adapter');
const core=require('../src/pages/index/health-core');
test('isolated source passes through real normalization without contaminating the other metric',async()=>{
 for(const [mode,good,bad] of [['hr-missing',9,0],['stress-missing',0,9]]) {
  const source=createFaultSource(mode,()=>1791700000000);
  const recent=await adapter.getRecent(source,core,[0,9]);
  assert.deepEqual(recent.map(s=>s.dataType),[good]);
  let observed,error;
  adapter.subscribe(source,core,good,s=>observed=s,e=>error=e);
  assert.equal(observed.ok,true);assert.equal(error,undefined);
  adapter.subscribe(source,core,bad,()=>assert.fail('unavailable metric succeeded'),e=>error=e);
  assert.equal(error.unsupported,true);
 }
});
test('frozen test measurements retain timestamps and stale source starts just inside each TTL',async()=>{
 let now=1791700000000;const source=createFaultSource('no-update',()=>now);
 const before=await source.getRecentSamples();now+=60000;
 assert.deepEqual(await source.getRecentSamples(),before);
 const stale=await createFaultSource('stale',()=>now).getRecentSamples();
 assert.equal(now-stale[0].data.timeStamp,55000);assert.equal(now-stale[1].data.timeStamp,295000);
});
