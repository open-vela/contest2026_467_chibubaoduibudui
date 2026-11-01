// Device-only scenarios wait for audited transitions; absolute time is never a UI completion claim.
const enter=(boxing,name)=>({click:[boxing?325:145,360],audit:{event:'start',view:boxing?'boxing':'breathing'},render:true,shot:name});
const complete=(boxing,name)=>({audit:{event:'complete',view:boxing?'boxingResult':'result',timeout:75000},render:true,shot:name});
const home=(boxing,name)=>({click:[233,boxing?348:400],audit:{event:'home',view:'home'},render:true,shot:name});
function positivePlan(){return [
 {acceleration:[0,0,9.8],shot:'home'},enter(true,'boxing-start'),
 {sessionAt:2500,shot:'static-zero'},
 {sessionAt:3500,acceleration:[10,0,9.8]}, {sessionAt:3650,shot:'outside-window'},
 {sessionAt:3950,acceleration:[0,0,9.8]}, {sessionAt:4020,acceleration:[10,0,9.8]},
 {sessionAt:4200,shot:'hit-and-debounce'},
 {sessionAt:4450,acceleration:[20,0,9.8]}, {sessionAt:4600,shot:'outside-after-hit'},
 ...[4950,5950,6950,7950].map((sessionAt,i)=>({sessionAt,acceleration:[i%2?0:10,0,9.8]})),
 {sessionAt:8200,shot:'multiple-hits'},complete(true,'positive-result'),home(true,'home-after-positive')
 ];}
function roundsPlan(){const e=[{acceleration:[0,0,9.8],resources:'before-rounds'}];for(let n=1;n<=3;n++)e.push(
 {shot:`round-${n}-home`},enter(false,`round-${n}-breathing-start`),
 {after:29000,shot:`round-${n}-breathing-mid`},complete(false,`round-${n}-breathing-result`),home(false,`round-${n}-home-between`),
 enter(true,`round-${n}-boxing-start`),{after:14000,shot:`round-${n}-boxing-mid`},complete(true,`round-${n}-boxing-result`),home(true,`round-${n}-home-end`));
 e.push({resources:'after-rounds'});return e;}
function exitsPlan(){const e=[{resources:'before-exits'}];for(let n=1;n<=10;n++){const b=n%2===0;e.push(enter(b,`exit-${n}-training`),
 {after:600,click:[233,440],audit:{event:'exit',view:b?'boxing':'breathing'},render:true,shot:`exit-${n}-home`});}
 e.push({after:1500,resources:'after-exits'});return e;}
function backgroundPlan(){return [
 {acceleration:[0,0,9.8],resources:'before-background'},enter(false,'breathing-before-hide'),
 {background:true,settle:1200,shot:'breathing-background'},{after:10000,foreground:true,shot:'breathing-after-show'},
 {after:3000,shot:'breathing-resumed-ticking'},
 {click:[233,440],audit:{event:'exit',view:'breathing'},render:true,shot:'breathing-exit-home'},
 enter(true,'boxing-before-hide'),{background:true,settle:1200,shot:'boxing-background'},
 {after:10000,foreground:true,shot:'boxing-after-show'},
 {after:1300,acceleration:[10,0,9.8]},{after:1000,acceleration:[0,0,9.8],shot:'boxing-resumed-motion'},
 {click:[233,440],audit:{event:'exit',view:'boxing'},render:true,shot:'boxing-exit-home'},
 {resources:'after-background'}];}
function videoPlan(){return [{acceleration:[0,0,9.8],shot:'video-home'},{after:3000},enter(false,'video-breathing-start'),
 {after:29000,shot:'video-breathing-mid'},complete(false,'video-breathing-result'),{after:3500},home(false,'video-home-between'),
 enter(true,'video-boxing-start'),...Array.from({length:7},(_,i)=>({sessionAt:2950+i*1000,acceleration:[i%2?0:10,0,9.8]})),
 {shot:'video-boxing-hits'},complete(true,'video-boxing-result'),{after:3500},home(true,'video-final-home'),{after:2000}];}
if(require.main===module){const fs=require('fs');const plans={positive:positivePlan,rounds:roundsPlan,exits:exitsPlan,background:backgroundPlan,video:videoPlan};
 if(!plans[process.argv[2]])throw Error('Choose positive|rounds|exits|background|video');fs.writeFileSync(process.argv[3],JSON.stringify(plans[process.argv[2]](),null,2)+'\n');}
module.exports={positivePlan,roundsPlan,exitsPlan,backgroundPlan,videoPlan};
