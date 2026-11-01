const fs=require('fs');const path=require('path');const cp=require('child_process');const Zip=require('adm-zip');
const kit=require('./review-tools');const {args}=require('./review-emulator');
const root=path.resolve(__dirname,'..');
function git(...a){return cp.execFileSync('git',a,{cwd:root,encoding:'utf8'}).trim();}
function inputHashes(projectRoot) {
 const entries=[...new Set([...require('./release-runner').projectEntries(projectRoot),'scripts','test'])].filter(e=>fs.existsSync(path.join(projectRoot,e)));
 return entries.flatMap(entry=>{
  const p=path.join(projectRoot,entry);return fs.statSync(p).isDirectory()?kit.files(p):[p];
 }).map(p=>({name:path.relative(projectRoot,p).replace(/\\/g,'/'),sha256:kit.hash(fs.readFileSync(p))})).sort((a,b)=>a.name.localeCompare(b.name));
}
const documentNames=['现场操作.md','故障应对.md','verification-matrix.md','后续任务.md','review-readiness.md'];
const metadataNames=['build-receipt.json','tests.log','build.log','release.log','acceptance.json',...documentNames];
const scriptNames=['start-review.ps1','review-emulator.js','review-vvd.js','review-tools.js','review-plans.js','capture-review.js','review-delivery.js','release-runner.js','build-fault-review.js','accept-fault-review.js'];
function allowedDelivery(name,artifacts) {
 if(name.includes('\\') || path.posix.normalize(name)!==name || name.startsWith('/') || name.includes(':') || name.startsWith('../')) return false;
 if(name.endsWith('.rpk')) return artifacts.some(a=>a.name===name);
 if(metadataNames.includes(name)) return true;
 if(name.startsWith('scripts/')) return scriptNames.includes(name.slice(8));
 return /^(?:emulator-(?:positive|background|exits|rounds|video|480)|fault-evidence)\/[A-Za-z0-9_./-]+\.(?:log|json|jsonl|png|mp4|txt)$/.test(name) && !name.includes('/frames/');
}
function source() {
 const status=git('status','--porcelain=v1');
 return {branch:git('branch','--show-current'),commit:git('rev-parse','HEAD'),workingTreeDirty:Boolean(status),
  trackedDirty:git('status','--porcelain=v1','--untracked-files=no'),status,
  files:inputHashes(root)};
}
function build(out) {
 fs.mkdirSync(out,{recursive:true});
 const before=source();const commands=[['npm test','tests.log'],['npm run build','build.log'],['npm run build:release','release.log']];const records=[];
 for(const [command,log] of commands) {
  const started=new Date().toISOString();const args=command.split(' ');
  const result=cp.spawnSync(process.env.ComSpec || 'cmd.exe',['/d','/s','/c',command],{cwd:root,encoding:'utf8',windowsHide:true,timeout:240000,maxBuffer:8000000});
  fs.writeFileSync(path.join(out,log),(result.stdout||'')+(result.stderr||''));
  records.push({command,log,started,finished:new Date().toISOString(),exitCode:result.status});
  if(result.error || result.status!==0) throw Error(`${command} failed; inspect ${log}: ${result.error?.message || result.status}`);
 }
 const after=source();
 if(JSON.stringify(before.files)!==JSON.stringify(after.files) || before.commit!==after.commit) throw Error('Source changed during build; repeat the serialized build');
 const names=['com.openvela.wristrhythm.debug.1.0.0.rpk','com.openvela.wristrhythm.release.1.0.0.rpk'];
 const artifacts=names.map(name=>{
  const original=path.join(root,'dist',name);const zip=new Zip(original);
  if(zip.getEntries().some(e=>/(^|\/)(output|test|tools|sign|\.git|\.worktrees)\//.test(e.entryName)|| /\.pem$/i.test(e.entryName))) throw Error('Unexpected RPK contents');
  const data=fs.readFileSync(original);fs.writeFileSync(path.join(out,name),data);
  return {name,bytes:data.length,sha256:kit.hash(data),mode:name.includes('.debug.')?'debug':'release'};
 });
 const receipt={generatedAt:new Date().toISOString(),timezone:'Asia/Shanghai',source:before,commands,
  runs:records,tools:{node:process.version,npm:cp.execFileSync(process.env.ComSpec||'cmd.exe',['/d','/s','/c','npm --version'],{encoding:'utf8'}).trim(),aiotToolkit:require('aiot-toolkit/package.json').version,emulatorToolkit:require('@aiot-toolkit/emulator/package.json').version},
  tests:kit.testCounts(fs.readFileSync(path.join(out,'tests.log'),'utf8')),artifacts};
 fs.writeFileSync(path.join(out,'build-receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({source:before.commit,tests:receipt.tests,artifacts}));
}
function pack(out,acceptanceFile) {
 const receipt=JSON.parse(fs.readFileSync(path.join(out,'build-receipt.json'),'utf8'));
 if(source().branch!==receipt.source.branch) throw Error('Branch differs from the build receipt');
 if(JSON.stringify(source().files)!==JSON.stringify(receipt.source.files)) throw Error('Tracked build inputs changed after build');
 const acceptanceBytes=fs.readFileSync(acceptanceFile);
 const acceptance=JSON.parse(acceptanceBytes.toString('utf8'));
 const release=receipt.artifacts.find(a=>a.mode==='release');
 if(acceptance.releaseSha256!==release.sha256) throw Error('Acceptance Release hash differs from the build receipt');
 const counted=kit.testCounts(fs.readFileSync(path.join(out,'tests.log'),'utf8'));
 if(counted.passed!==receipt.tests.passed || receipt.runs.some(r=>r.exitCode!==0)) throw Error('Build/test evidence mismatch');
 const mandatory=['build-receipt.json','tests.log','build.log','release.log','acceptance.json','现场操作.md','故障应对.md','verification-matrix.md','后续任务.md','review-readiness.md',...receipt.artifacts.map(a=>a.name)];
 const include=[...new Set([...mandatory,...acceptance.deliverables])];
 const stage=fs.mkdtempSync(path.join(out,'delivery-'));
 try {
  for(const name of include) {
   if(!allowedDelivery(name,receipt.artifacts)) throw Error(`Not a normal delivery file: ${name}`);
   const dest=kit.inside(stage,name);fs.mkdirSync(path.dirname(dest),{recursive:true});
   if(name==='acceptance.json') fs.writeFileSync(dest,acceptanceBytes);
   else fs.copyFileSync(kit.inside(out,name),dest);
  }
  for(const a of receipt.artifacts) if(kit.hash(fs.readFileSync(path.join(stage,a.name)))!==a.sha256) throw Error('RPK changed after acceptance');
  const evidence={...receipt,deliveryHead:git('rev-parse','HEAD'),sourceInputsStillEqual:true,acceptance,notCovered:acceptance.notCovered,signing:'local review/development credentials; no distribution authorization'};
  fs.writeFileSync(path.join(stage,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');
  kit.checkLinks(stage);
  const zip=new Zip();for(const file of kit.files(stage)) zip.addLocalFile(file,path.relative(stage,path.dirname(file)).replace(/\\/g,'/'));
  kit.verifyZip(zip,receipt.artifacts);
  const destination=path.join(out,'腕上节律-评审可靠性交付.zip');zip.writeZip(destination);kit.verifyZip(new Zip(destination),receipt.artifacts);
  fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');
  fs.writeFileSync(path.join(out,'zip-verification.json'),JSON.stringify({zip:path.basename(destination),bytes:fs.statSync(destination).size,sha256:kit.hash(fs.readFileSync(destination)),releaseSha256:release.sha256,internalLinks:'passed',rpkHashEquality:'passed',files:include},null,2));
  console.log(JSON.stringify({zip:destination,tests:receipt.tests.passed,releaseSha256:release.sha256,files:include.length}));
 } finally {fs.rmSync(stage,{recursive:true,force:true});}
}
if(require.main===module) {const o=args(process.argv.slice(2));try{const out=path.resolve(o.output||'output/review-delivery');if(o.action==='build')build(out);else if(o.action==='pack')pack(out,path.resolve(o.acceptance||path.join(out,'acceptance.json')));else throw Error('--action build|pack required');}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={source,inputHashes,allowedDelivery,build,pack};
