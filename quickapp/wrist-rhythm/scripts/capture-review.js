const fs=require('fs');const path=require('path');const cp=require('child_process');
const {ReviewDevice,args,wait}=require('./review-emulator');
const o=args(process.argv.slice(2));
const d=new ReviewDevice(o);let recording=false;
(async()=>{
 if(!o.ffmpeg || !fs.existsSync(o.ffmpeg)) throw Error('Set --ffmpeg to an existing local encoder; no automatic download');
 await d.connect();if(o.rpk) await d.install(o.rpk);await d.launch(o.package);
 const frameDir=path.join(d.out,'frames');fs.mkdirSync(frameDir,{recursive:true});const frames=[];
 const start=Date.now();recording=true;
 const capture=(async()=>{
  while(recording) {
   const frame=await d.client.getScreenshot();const time=Date.now();
   const name=`frame-${String(frames.length).padStart(5,'0')}.png`;fs.writeFileSync(path.join(frameDir,name),frame);frames.push({name,time});
   await wait(Math.max(0,200-(Date.now()-time)));
  }
 })();
 try { await d.timeline(JSON.parse(fs.readFileSync(o.plan,'utf8'))); }
 finally { recording=false;await capture; }
 const end=Date.now();
 let concat='';for(let i=0;i<frames.length;i++) {const duration=((frames[i+1]?.time||end)-frames[i].time)/1000;concat+=`file '${frames[i].name}'\nduration ${Math.max(.001,duration).toFixed(3)}\n`;}
 concat+=`file '${frames.at(-1).name}'\n`;fs.writeFileSync(path.join(frameDir,'frames.txt'),concat);
 fs.writeFileSync(path.join(frameDir,'caption.txt'),'模拟器实录 · 传感器输入验证\n不代表真人动作识别准确率或健康效果');
 const video=path.join(d.out,'emulator-sensor-input-full.mp4');
 // Recorded frame durations retain wall time; no speed-up, no reordered scenes.
 const result=cp.spawnSync(o.ffmpeg,['-y','-f','concat','-safe','0','-i','frames.txt','-vf',"pad=iw:ih+60:0:0:black,drawtext=fontfile='C\\:/Windows/Fonts/msyh.ttc':textfile='caption.txt':fontcolor=white:fontsize=14:x=10:y=h-50",'-vsync','vfr','-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',video],{cwd:frameDir,encoding:'utf8',timeout:60000,maxBuffer:3000000,windowsHide:true});
 fs.writeFileSync(path.join(d.out,'encode.log'),(result.stdout||'')+(result.stderr||''));
 if(result.status!==0) throw Error('Encoder failed; retained raw frames and encode.log');
 const decode=cp.spawnSync(o.ffmpeg,['-v','error','-i',video,'-f','null','-'],{encoding:'utf8',timeout:60000,windowsHide:true});
 fs.writeFileSync(path.join(d.out,'offline-decode.log'),(decode.stderr||'')+(decode.stdout||''));
 if(decode.status!==0 || decode.stderr.trim()) throw Error('Offline decode failed; inspect offline-decode.log');
 fs.writeFileSync(path.join(d.out,'video.json'),JSON.stringify({video:path.basename(video),frames:frames.length,captureElapsedMs:end-start,firstFrame:frames[0].time,lastFrame:frames.at(-1).time,fullFlow:true,edited:false,spedUp:false,offlineFullDecode:'passed',sensorInput:true,scope:'Emulator sensor input, not human recognition accuracy or health effect'},null,2));
 console.log(JSON.stringify({video,frames:frames.length,elapsedMs:end-start,offlineDecode:'passed'}));
})().catch(e=>{recording=false;console.error(e.message);process.exitCode=1;}).finally(()=>d.close());
