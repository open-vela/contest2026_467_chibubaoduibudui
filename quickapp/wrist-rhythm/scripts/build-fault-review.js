// Generates separately named review fixtures in an isolated staging tree.
// The release runner has no flag that can enable this source in the normal package.
const fs=require('fs');const path=require('path');
const {runRelease}=require('./release-runner');const {args}=require('./review-emulator');
const o=args(process.argv.slice(2));
const scenarios=['hr-missing','stress-missing','both-missing','stale','no-update','motion-failure','large-values'];
if(!scenarios.includes(o.scenario)) throw Error('Choose --scenario '+scenarios.join('|'));
const root=path.resolve(__dirname,'..');const out=path.resolve(o.output || 'output/fault-review');
fs.mkdirSync(out,{recursive:true});
const {copyFileSync}=fs;
const overrides={copyProjectInputs(projectRoot,stage){
 // Use the same narrow input policy; fault data exists only in this temporary tree.
 const {projectEntries}=require('./release-runner');fs.mkdirSync(stage,{recursive:true});
 for(const entry of projectEntries(projectRoot)) fs.cpSync(path.join(projectRoot,entry),path.join(stage,entry),{recursive:true});
 fs.symlinkSync(path.join(projectRoot,'node_modules'),path.join(stage,'node_modules'),'junction');
 const manifestPath=path.join(stage,'src/manifest.json');const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 manifest.package='com.openvela.wristrhythm.fault';manifest.name='故障注入·模拟';fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
 const pageDir=path.join(stage,'src/pages/index');copyFileSync(path.join(root,'test/fixtures/fault-source.js'),path.join(pageDir,'fault-source.js'));
 fs.writeFileSync(path.join(pageDir,'health.js'),`import factory from './fault-source.js';\nimport core from './health-core.js';\nimport adapter from './health-adapter.js';\nconst health=factory.createFaultSource('${o.scenario}');\nexport const DATA_TYPES=health.DATA_TYPES;\nexport function getRecent(types){return adapter.getRecent(health,core,types);}\nexport function subscribe(type,s,e){return adapter.subscribe(health,core,type,s,e);}\nexport function unsubscribe(type){return adapter.unsubscribe(health,core,type);}\n`);
 if(o.scenario==='motion-failure') fs.writeFileSync(path.join(pageDir,'motion.js'),"export function subscribeAccelerometer(sample,error){error({code:200,message:'fault injection'});}\nexport function unsubscribeAccelerometer(){}\n");
 const pagePath=path.join(pageDir,'index.ux');let page=fs.readFileSync(pagePath,'utf8');
 page=page.replace(/  <\/div>\s*<\/template>/,'    <text class="fault-label">故障注入·模拟</text>\n  </div>\n</template>');
 if(!page.includes('<text class="fault-label">')) throw Error('Fault watermark was not inserted');
 page=page.replace(/<style(?:\s+lang="scss")?>\s*(?:@use [^;]+;\s*)?/,m=>m+'\n.fault-label { position: absolute; top: 12px; left: 180px; width: 120px; height: 16px; font-size: 12px; color: #fbbf24; text-align: center; }\n');
 fs.writeFileSync(pagePath,page);
},};
const temp=fs.mkdtempSync(path.join(require('os').tmpdir(),'wristrhythm-fault-'));
try {
 overrides.copyProjectInputs(root,temp);
 const result=runRelease(temp);
 copyFileSync(result,path.join(out,`${o.scenario}.rpk`));
 console.log('Fault-only artifact: '+path.join(out,`${o.scenario}.rpk`));
} finally { fs.rmSync(temp,{recursive:true,force:true}); }
