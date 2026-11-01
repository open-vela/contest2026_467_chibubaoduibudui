const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const kit = require('../scripts/review-tools');

test('launch evidence accepts an actual onShow when the image loses its Page show line', () => {
  assert.equal(kit.pageShown('request am start; WRIST_VIEW {"view":"home"}'),false);
  assert.equal(kit.pageShown('Page show page_info:name:pages/index,component:index'),true);
  assert.equal(kit.pageShown('WRIST_AUDIT {"event":"show","view":"home","timestamp":1791781564049}'),true);
  assert.equal(kit.pageShown('WRIST_AUDIT {"event":"hide","view":"home"}'),false);
  assert.equal(kit.pageShown('WRIST_AUDIT {"event":"show"'),false);
});

test('background evidence requires a real lifecycle callback, not a key request or home render', () => {
  assert.equal(kit.pageHidden('send KEY_HOME; [home] on_resume'),false);
  assert.equal(kit.pageHidden('Page hide page_info:name:pages/index,component:index'),true);
  assert.equal(kit.pageHidden('WRIST_AUDIT {"event":"hide","view":"boxing","timestamp":1791782515000}'),true);
  assert.equal(kit.pageHidden('[AIOTJS] [onEvent:91] AppCallHook name:onHide\n[home] on_resume: page main: on resume.'),true);
  assert.equal(kit.pageHidden('[AIOTJS] AppCallHook name:onHide'),false);
});

test('466 training exit plans click inside the measured buttons with an inset', () => {
  const {exitsPlan,backgroundPlan}=require('../scripts/review-plans');
  // Breathing y426..466. Boxing reserves its 18px message row so that its
  // exit control remains at y427..461 before and after connection failure.
  // A breathing click at y426 intermittently missed at the rounded edge.
  for(const e of [...exitsPlan(),...backgroundPlan()].filter(e=>e.audit?.event==='exit')) {
    const [top,bottom]=e.audit.view==='breathing'?[426,466]:[427,461];
    assert(e.click[1]>=top+8&&e.click[1]<=bottom-8,'exit click needs an interior inset');
  }
});

test('scheduled sensor input uses host receipt time when device epoch is offset', async () => {
  const {ReviewDevice}=require('../scripts/review-emulator');const d=Object.create(ReviewDevice.prototype);
  d.logs='WRIST_AUDIT {"event":"target","view":"boxing","timestamp":10000,"elapsed":1000}';
  d.milestone=async(_offset,predicate)=>assert(predicate());d.record=()=>{};
  const received=Date.now();d.logChunks=[{start:0,end:d.logs.length,receivedAt:received}];
  await d.audit(0,'start','boxing');
  assert.equal(d.sessionStart,received-1000);
});

test('sensor evidence waits for asynchronous readback and rejects a non-delivered write', async () => {
  const {ReviewDevice}=require('../scripts/review-emulator');
  const d=Object.create(ReviewDevice.prototype);const records=[];let reads=0;
  d.record=e=>records.push(e);
  d.rpc=async method=>method==='setSensor'?{}:{status:'OK',value:{data:++reads<3?[0,0,9.8]:[4.5,0,9.80000019]}};
  await d.acceleration([4.5,0,9.8],{timeout:100,poll:1});
  assert.equal(reads,3);assert.equal(records.at(-1).delivered,true);
  d.rpc=async method=>method==='setSensor'?{}:{status:'OK',value:{data:[0,0,9.8]}};
  await assert.rejects(()=>d.acceleration([4.5,0,9.8],{timeout:10,poll:1}),/not delivered/);
  assert.equal(records.at(-1).delivered,false);
});

test('test evidence counts actual suites and rejects failed or incomplete output', () => {
  assert.equal(kit.testCounts('20 tests passed\n9 runtime tests passed\nℹ tests 3\nℹ pass 3\nℹ fail 0\n').passed, 32);
  assert.throws(() => kit.testCounts('20 tests passed\nℹ pass 2\nℹ fail 1\n'), /failed|incomplete/);
  assert.throws(() => kit.testCounts('20 tests passed\n'), /incomplete/);
});
test('install confirmation requires this package and final success, not a queued request', () => {
  assert.equal(kit.installState('request install com.openvela.wristrhythm', 'com.openvela.wristrhythm'), 'pending');
  assert.equal(kit.installState('install success: other.package', 'com.openvela.wristrhythm'), 'pending');
  assert.equal(kit.installState('install success: com.openvela.wristrhythm', 'com.openvela.wristrhythm'), 'success');
  assert.equal(kit.installState('install failed: com.openvela.wristrhythm', 'com.openvela.wristrhythm'), 'failed');
  assert.equal(kit.installState('renameDir install com.openvela.wristrhythm success !', 'com.openvela.wristrhythm'), 'pending');
  assert.equal(kit.installState('executeInstall: rpk install: /data/app/a.rpk com.openvela.wristrhythm success', 'com.openvela.wristrhythm'), 'success');
  assert.equal(kit.installState('executeInstall: rpk install: /data/app/com.openvela.wristrhythm.fault.rpk com.openvela.wristrhythm.fault success', 'com.openvela.wristrhythm'), 'pending');
});

test('source hash collection includes untracked source, configuration, signing and tests', () => {
  const {inputHashes}=require('../scripts/review-delivery');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'review-inputs-'));
  try {
    for(const name of ['src/new.js','test/new.test.js','sign/release/private.pem','config/device.json','babel.config.js','package.json']) {
      const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'baseline');
    }
    const first=inputHashes(root);
    assert.equal(first.length,6);
    assert(first.some(f=>f.name==='src/new.js'));
    fs.writeFileSync(path.join(root,'test/new.test.js'),'changed');
    assert.notDeepEqual(inputHashes(root),first);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('normal delivery rejects extra RPKs and noncanonical paths', () => {
  const {allowedDelivery}=require('../scripts/review-delivery');
  const artifacts=[{name:'release.rpk'}];
  assert(allowedDelivery('release.rpk',artifacts));
  assert.equal(allowedDelivery('extra-fault.rpk',artifacts),false);
  assert.equal(allowedDelivery('screenshots/../../extra-fault.rpk',artifacts),false);
  assert.equal(allowedDelivery('emulator-positive/screenshots/hit.png',artifacts),true);
  assert.equal(allowedDelivery('private-settings.json',artifacts),false);
});

test('delivery validation rejects missing links with spaces, titles and references', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'review-md-'));
  try {
    for(const md of ['[bad](<missing file.md>)','[bad](missing.md "title")','[bad][record]\n\n[record]: missing.md']) {
      fs.writeFileSync(path.join(root,'a.md'),md);
      assert.throws(()=>kit.checkLinks(root),/missing/);
    }
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test('delivery links must resolve inside delivery and exist', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-links-'));
  try {
    fs.writeFileSync(path.join(root, 'a.md'), '[evidence](evidence.json)');
    fs.writeFileSync(path.join(root, 'evidence.json'), '{}');
    kit.checkLinks(root);
    fs.writeFileSync(path.join(root, 'a.md'), '[missing](gone.md)');
    assert.throws(() => kit.checkLinks(root), /missing/i);
    fs.writeFileSync(path.join(root, 'a.md'), '[outside](../secret.txt)');
    assert.throws(() => kit.checkLinks(root), /outside/i);
  } finally { fs.rmSync(root, { recursive:true, force:true }); }
});
test('ZIP verification detects a different RPK even if name is equal', () => {
  const Zip = require('adm-zip');
  const zip = new Zip(); zip.addFile('release.rpk', Buffer.from('wrong'));
  assert.throws(() => kit.verifyZip(zip, [{name:'release.rpk',sha256:kit.hash(Buffer.from('accepted'))}]), /hash/i);
});

test('delivery includes the same acceptance file that was validated', () => {
  const {pack,source}=require('../scripts/review-delivery');
  const Zip=require('adm-zip');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'review-acceptance-'));
  try {
    const out=path.join(tmp,'out');fs.mkdirSync(out);
    const artifact={name:'release.rpk',mode:'release',sha256:kit.hash(Buffer.from('accepted artifact'))};
    fs.writeFileSync(path.join(out,artifact.name),'accepted artifact');
    const tests='1 tests passed\nℹ pass 1\nℹ fail 0\n';
    fs.writeFileSync(path.join(out,'tests.log'),tests);
    fs.writeFileSync(path.join(out,'build-receipt.json'),JSON.stringify({source:source(),artifacts:[artifact],tests:kit.testCounts(tests),runs:[{exitCode:0}]}));
    for(const name of ['build.log','release.log','现场操作.md','三分钟讲稿.md','故障应对.md','verification-matrix.md','后续任务.md','review-readiness.md']) fs.writeFileSync(path.join(out,name),'fixture');
    // An older default record must never replace the explicitly validated file.
    fs.writeFileSync(path.join(out,'acceptance.json'),JSON.stringify({releaseSha256:'old'}));
    const acceptance={releaseSha256:artifact.sha256,deliverables:[],notCovered:['real device']};
    const selected=path.join(tmp,'selected.json');fs.writeFileSync(selected,JSON.stringify(acceptance));
    pack(out,selected);
    const zip=new Zip(path.join(out,'腕上节律-评审可靠性交付.zip'));
    assert.deepEqual(JSON.parse(zip.readAsText('acceptance.json')),acceptance);
    assert.deepEqual(JSON.parse(zip.readAsText('evidence.json')).acceptance,acceptance);
  } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});

test('PowerShell entry selects one named instance when two are running', {skip:process.platform!=='win32'}, () => {
  const cp=require('child_process');const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'review-powershell-'));
  try {
    fs.writeFileSync(path.join(tmp,'node.cmd'),'@echo off\r\nif "%1"=="--version" (\r\n echo v24.19.0\r\n exit /b 0\r\n)\r\necho [{"avd.name":"chosen","port.serial":"5560","grpc.port":"8556"},{"avd.name":"unrelated","port.serial":"5554","grpc.port":"8558"}]\r\n');
    fs.writeFileSync(path.join(tmp,'adb.cmd'),'@echo off\r\nexit /b 0\r\n');fs.writeFileSync(path.join(tmp,'dummy.rpk'),'fixture');
    const env={...process.env,Path:tmp+';'+process.env.Path};
    const r=cp.spawnSync('powershell',['-NoProfile','-File',path.resolve(__dirname,'../scripts/start-review.ps1'),'-CheckOnly','-Serial','emulator-5560','-AdbPath',path.join(tmp,'adb.cmd'),'-Rpk',path.join(tmp,'dummy.rpk'),'-OutputDirectory',path.join(tmp,'out')],{env,encoding:'utf8',timeout:15000,windowsHide:true});
    assert.equal(r.status,0,r.stderr);assert(r.stdout.includes('chosen'));assert(!r.stdout.includes('unrelated'),r.stdout);
  } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});
