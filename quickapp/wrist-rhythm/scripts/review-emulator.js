// Official emulator RPC/ADB only. No access to application scoring or health values.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const Zip = require('adm-zip');
const { createGrpcClient } = require('@aiot-toolkit/emulator/lib/vvd/grpc');
const emulator = require('@aiot-toolkit/emulator/lib/emulatorutil');
const { hash, pageShown, pageHidden, installState } = require('./review-tools');
const wait = ms => new Promise(r=>setTimeout(r,ms));

function args(argv) {
  const o = {};
  for(let i=0;i<argv.length;i+=2) { if(!argv[i].startsWith('--') || argv[i+1]===undefined) throw Error('Use --option value'); o[argv[i].slice(2)] = argv[i+1]; }
  return o;
}
class ReviewDevice {
  constructor(options = {}) {
    this.options = options;
    this.out = path.resolve(options.output || 'output/review-session');
    fs.mkdirSync(this.out,{recursive:true});
    this.adb = path.resolve(options.adb || 'node_modules/@miwt/adb/bin/win/adb.exe');
    if(!fs.existsSync(this.adb)) throw Error(`ADB missing: ${this.adb}; set --adb`);
    this.events = [];
    this.logs = '';
    this.logChunks = [];
  }
  async connect() {
    let configs = emulator.getRunningAvdConfig();
    const config = this.options.serial ? configs.find(c=>`emulator-${c['port.serial']}`===this.options.serial)
      : this.options.vvd ? configs.find(c=>c['avd.name']===this.options.vvd) : configs.length===1 ? configs[0] : null;
    if (!config && !this.options.port) throw Error('No unambiguous running VVD. Run start-review.ps1 with -SdkHome and -VvdName, or specify --serial/--port.');
    this.serial = this.options.serial || (config && `emulator-${config['port.serial']}`);
    if (!this.serial) throw Error('--serial is required with --port');
    this.client = createGrpcClient(config || {'grpc.port':+this.options.port});
    this.client.deadline = new Date(Date.now()+30000);
    await this.client.waitForReady();
    const readyDeadline=Date.now()+60000;let status,ready=false;
    while(Date.now()<readyDeadline) {
      status=await this.client.getStatus();
      try { ready=status.booted && this.shell('true').trim()===''; } catch { ready=false; }
      if(ready) break;
      await wait(500);
    }
    if(!ready) throw Error('Device not booted or ADB shell unavailable after 60 seconds; inspect emulator-stdout/stderr.log and ADB devices');
    this.status = { version:status.version, booted:status.booted, vvd:config?.['avd.name'], serial:this.serial,
      width:+status.hardwareConfig['hw.lcd.width'],height:+status.hardwareConfig['hw.lcd.height'],density:+status.hardwareConfig['hw.lcd.density'],
      image:status.hardwareConfig['kernel.path'],grpcPort:config?.['grpc.port'] || this.options.port };
    this.logProcess = cp.spawn(this.adb,['-s',this.serial,'logcat'],{windowsHide:true});
    const logPath = path.join(this.out,'device.log');
    this.logProcess.stdout.on('data',b=>{
      const start=this.logs.length;fs.appendFileSync(logPath,b);this.logs+=b.toString();
      this.logChunks.push({start,end:this.logs.length,receivedAt:Date.now()});
    });
    this.logProcess.stderr.on('data',b=>fs.appendFileSync(logPath,b));
    this.logProcess.on('error',e=>{this.logError=e;});
    await wait(1000); // Drain historical log buffer; installation gate uses only later bytes.
    fs.writeFileSync(path.join(this.out,'device.json'),JSON.stringify(this.status,null,2));
    return this;
  }
  shell(command) {
    // NuttX ADB requires the complete command as one argument.
    return cp.execFileSync(this.adb,['-s',this.serial,'shell',command],{encoding:'utf8',timeout:10000,windowsHide:true});
  }
  rpc(method, message) {
    return new Promise((resolve,reject)=>this.client.client[method](message,this.client.authMate,{deadline:Date.now()+5000},(e,r)=>e?reject(e):resolve(r)));
  }
  record(event) { const entry={utc:new Date().toISOString(),elapsedMs:this.started?Date.now()-this.started:null,...event};this.events.push(entry);fs.appendFileSync(path.join(this.out,'timeline.jsonl'),JSON.stringify(entry)+'\n');return entry; }
  async click(x,y) { await this.rpc('sendMouse',{x,y,buttons:1}); await wait(70); await this.rpc('sendMouse',{x,y,buttons:0});this.record({action:'click',x,y}); }
  async key(keyCode) { await this.rpc('sendKey',{codeType:'Evdev',eventType:'keydown',keyCode}); await wait(100);await this.rpc('sendKey',{codeType:'Evdev',eventType:'keyup',keyCode}); this.record({action:'key',keyCode}); }
  async acceleration(data, options={}) {
    const requestedAt=Date.now();await this.rpc('setSensor',{target:'ACCELERATION',value:{data}});
    const until=Date.now()+(options.timeout??1500);let readback,delivered=false;
    do {
      readback=await this.rpc('getSensor',{target:'ACCELERATION'});
      delivered=readback.status==='OK' && data.every((v,i)=>Math.abs(v-readback.value?.data?.[i])<0.00001);
      if(delivered) break;await wait(options.poll??10);
    } while(Date.now()<until);
    this.record({action:'system_sensor_input',requestedAt,data,readback,delivered,scope:'emulator sensor input; not human recognition accuracy'});
    if(!delivered) throw Error('Sensor write not delivered within deadline; inspect timeline and system topic, do not treat as app input');
  }
  auditEntries(offset=0) {
    return [...this.logs.slice(offset).matchAll(/WRIST_AUDIT (\{[^\r\n]+\})/g)].flatMap(m=>{
      try {const end=offset+m.index+m[0].length;const chunk=this.logChunks?.find(c=>c.end>=end);
        return [{...JSON.parse(m[1]),hostReceivedAt:chunk?.receivedAt||Date.now()}];}catch{return [];}
    });
  }
  viewEntries(offset=0) {
    return [...this.logs.slice(offset).matchAll(/WRIST_VIEW (\{[^\r\n]+\})/g)].flatMap(m=>{try{return [JSON.parse(m[1])];}catch{return [];}});
  }
  async audit(offset,event,view,timeout=70000) {
    const find=()=>this.auditEntries(offset).find(a=>a.event===event && (!view||a.view===view))
      || (event==='start' && this.auditEntries(offset).find(a=>a.view===view && ['progress','target','motion-connected'].includes(a.event)))
      || (['complete','home','exit'].includes(event) && this.viewEntries(offset).find(a=>a.view===(event==='exit'?'home':view)));
    await this.milestone(offset,()=>Boolean(find()),`${event} ${view||''}`,timeout);
    const a=find();
    if(event==='start') {this.sessionStart=a.hostReceivedAt-a.elapsed;this.sessionLogOffset=offset;}
    this.record({action:'observed_audit',audit:a});return a;
  }
  async shot(name) { if(!/^[a-zA-Z0-9_-]+$/.test(name)) throw Error('Screenshot name must be a basename');fs.mkdirSync(path.join(this.out,'screenshots'),{recursive:true});fs.writeFileSync(path.join(this.out,'screenshots',name+'.png'),await this.client.getScreenshot()); this.record({action:'screenshot',path:`screenshots/${name}.png`}); }
  async milestone(offset, predicate, description, timeout=30000) {
    const until=Date.now()+timeout;
    while(Date.now()<until) {
      if(this.logError) throw this.logError;
      const fresh=this.logs.slice(offset);
      if(predicate(fresh)) return;
      await wait(200);
    }
    throw Error(`Timed out: ${description}; inspect device.log. Recheck image/package, then rerun.`);
  }
  async install(rpk) {
    const absolute=path.resolve(rpk);
    const manifest=JSON.parse(new Zip(absolute).readAsText('manifest.json'));
    if(!/^[A-Za-z0-9._-]+$/.test(manifest.package)) throw Error('Invalid RPK package');
    this.packageName=manifest.package;
    this.artifact={name:path.basename(absolute),bytes:fs.statSync(absolute).size,sha256:hash(fs.readFileSync(absolute)),package:manifest.package};
    // Stop is used only to replace installed binaries, never to test background behavior.
    this.shell(`am stop ${manifest.package}`); await wait(500);
    const remote=`/data/app/${manifest.package}.rpk`;
    cp.execFileSync(this.adb,['-s',this.serial,'push',absolute,remote],{timeout:30000,windowsHide:true,stdio:'pipe'});
    const offset=this.logs.length;
    this.shell(`pm install ${remote}`);
    await this.milestone(offset,log=>installState(log,manifest.package)!=='pending','new installation completion');
    if(installState(this.logs.slice(offset),manifest.package)!=='success') throw Error('Installation failed; inspect device.log, verify image compatibility and RPK');
    const installed=JSON.parse(this.shell(`cat /data/app/${manifest.package}/manifest.json`));
    if(installed.packageInfo?.timeStamp!==manifest.packageInfo?.timeStamp) throw Error('Installed manifest is from another build');
    this.record({action:'install_complete',artifact:this.artifact,installedBuild:installed.packageInfo});
    fs.writeFileSync(path.join(this.out,'installed.json'),JSON.stringify({...this.artifact,installedBuild:installed.packageInfo},null,2));
  }
  async launch(packageName) {
    this.packageName=packageName || this.packageName || 'com.openvela.wristrhythm';
    if(!/^[A-Za-z0-9._-]+$/.test(this.packageName)) throw Error('Invalid package name');
    const offset=this.logs.length;this.shell(`am start ${this.packageName}`);
    await this.milestone(offset,log=>pageShown(log),'page show/onShow after launch');
    await wait(800); await this.shot('launched');this.record({action:'launch_page_shown',package:this.packageName});
  }
  async background() {
    const offset=this.logs.length;await this.key(102);
    await this.milestone(offset,log=>pageHidden(log),'real page/application hide with watchface resumed');
    this.record({action:'background_page_hidden',method:'Evdev KEY_HOME; application process retained'});
  }
  resources(name) { const data={free:this.shell('free'),ps:this.shell('ps')};fs.writeFileSync(path.join(this.out,`resources-${name}.json`),JSON.stringify(data,null,2)); this.record({action:'resource_snapshot',name}); }
  async timeline(plan) {
    this.started=Date.now();
    for(const e of plan) {
      if(e.after) await wait(e.after);
      else if(e.sessionAt!==undefined) { if(!this.sessionStart) throw Error('sessionAt requires an observed start');await wait(Math.max(0,this.sessionStart+e.sessionAt-Date.now())); }
      else if(e.at!==undefined) await wait(Math.max(0,this.started+e.at-Date.now()));
      const offset=this.logs.length;
      if(e.acceleration) await this.acceleration(e.acceleration);
      if(e.click) await this.click(...e.click);
      if(e.background) await this.background();
      if(e.foreground) await this.launch(this.packageName);
      if(e.audit) {
        const auditOffset=e.audit.event==='complete'?this.sessionLogOffset:offset;
        await this.audit(auditOffset,e.audit.event,e.audit.view,e.audit.timeout);
        if(e.render) {
          const expected=e.audit.event==='exit'?'home':e.audit.view;
          await this.milestone(auditOffset,()=>this.viewEntries(auditOffset).some(a=>a.view===expected),'component ready: '+expected,15000);
          await wait(150);
        }
      }
      if(e.settle) await wait(e.settle);
      if(e.shot) await this.shot(e.shot);
      if(e.resources) this.resources(e.resources);
      if(e.topic) { const text=this.shell(`uorb_listener -n 2 -t 1 ${e.topic}`);fs.writeFileSync(path.join(this.out,`topic-${e.at}.txt`),text);this.record({action:'uorb_snapshot',topic:e.topic,path:`topic-${e.at}.txt`}); }
    }
  }
  close() { this.logProcess?.kill();this.client?.close(); }
}
if(require.main===module) {
  const o=args(process.argv.slice(2));const d=new ReviewDevice(o);
  (async()=>{await d.connect();if(o.rpk) await d.install(o.rpk);if(o.package || o.rpk) await d.launch(o.package);
    if(o.plan) await d.timeline(JSON.parse(fs.readFileSync(o.plan,'utf8')));
    console.log(JSON.stringify({output:d.out,device:d.status,artifact:d.artifact}));
  })().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>d.close());
}
module.exports={ReviewDevice,args,wait};
