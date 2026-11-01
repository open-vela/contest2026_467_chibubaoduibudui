// Fault artifacts are separately named and visibly marked. Not system-health integration.
const fs=require('fs');const path=require('path');
const {ReviewDevice,args}=require('./review-emulator');
const o=args(process.argv.slice(2));
const scenarios=(o.scenarios||'hr-missing,stress-missing,both-missing,stale,no-update,motion-failure,large-values').split(',');
(async()=>{
 for(const scenario of scenarios) {
  const d=new ReviewDevice({...o,output:path.join(o.output,scenario)});
  try {
   await d.connect();await d.install(path.join(o.artifacts,scenario+'.rpk'));await d.launch();
   const enter=(boxing,shot)=>({click:[boxing?325:145,d.status.height>=480?390:365],audit:{event:'start',view:boxing?'boxing':'breathing'},render:true,shot});
   const result=(boxing,shot)=>({audit:{event:'complete',view:boxing?'boxingResult':'result'},render:true,shot});
   const exit=(boxing,shot)=>({click:[233,d.status.height>=480?445:440],audit:{event:'exit',view:boxing?'boxing':'breathing'},render:true,shot});
   const home=(boxing)=>({click:[233,boxing?348:400],audit:{event:'home',view:'home'},render:true,shot:'fault-exit-home'});
   const plan=[{after:1000,shot:'fault-home'}];
   if(scenario==='stale') plan.push({after:7000,shot:'fault-stale-home'},enter(false,'fault-stale-training'),exit(false,'fault-exit-home'));
   else if(['both-missing','no-update'].includes(scenario)) plan.push(enter(false,'fault-breathing'),result(false,'fault-breathing-result'),home(false));
   else if(scenario==='motion-failure') plan.push(enter(true,'fault-motion-unavailable'),result(true,'fault-zero-score-result'),home(true),enter(true,'fault-motion-reenter'),exit(true,'fault-active-exit-home'));
   else plan.push(enter(false,'fault-breathing'),exit(false,'fault-exit-home'));
   await d.timeline(plan);console.log(`Captured isolated ${scenario}: ${d.out}`);
  } finally {d.close();}
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
