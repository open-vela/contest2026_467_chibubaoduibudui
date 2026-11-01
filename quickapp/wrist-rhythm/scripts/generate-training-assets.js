const fs = require('fs');
const path = require('path');
const {args}=require('./review-emulator');
const options=args(process.argv.slice(2));
if(!options.python)throw Error('Pass --python to an existing Python runtime with Pillow; transparent PNG8 optimization is required');
const {chromium}=require(options.playwright || 'playwright');
const cp=require('child_process');
const crypto=require('crypto');
const canonical=file=>fs.readFileSync(path.join(__dirname,file),'utf8').replace(/\r\n/g,'\n');
const assetTag=crypto.createHash('sha256').update(canonical('training-drawing.js'))
  .update(canonical('optimize-training-frame.py')).digest('hex').slice(0,12);
const folder='training-'+assetTag;
const output=path.resolve(__dirname,'../src/common',folder);
// LVGL keeps decoded images across reinstalls. Content paths avoid stale art.
const pageRoot=path.resolve(__dirname,'../src/pages/index');
for(const filename of ['training-visuals.js','index.ux','components/breathing.ux','components/boxing.ux']) {
  const file=path.join(pageRoot,filename);
  const current=fs.readFileSync(file,'utf8');
  const updated=current.replace(/\/common\/training(?:-[a-f0-9]{12})?(?=['/])/g,'/common/'+folder);
  if(current!==updated)fs.writeFileSync(file,updated);
}
(async()=>{
  const browser=await chromium.launch({headless:true,channel:options.channel || 'chrome'});
  try {
    const page=await browser.newPage({viewport:{width:300,height:300},deviceScaleFactor:1});
    await page.setContent('<style>html,body{margin:0;background:transparent}canvas{display:block}</style><canvas width="250" height="250"></canvas>');
    await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'training-drawing.js'),'utf8')});
    fs.mkdirSync(output,{recursive:true});
    const pngs=[];
    async function save(kind,frame) {
      const name=kind+'-'+String(frame).padStart(2,'0')+'.png';
      await page.locator('canvas').screenshot({path:path.join(output,name),omitBackground:true});pngs.push(name);
    }
    for(let frame=0;frame<=40;frame++) {
      await page.evaluate(frame=>TrainingDrawing.renderBreath(document.querySelector('canvas').getContext('2d'),frame/40),frame);
      await save('breath',frame);
    }
    await page.evaluate(()=>{const canvas=document.querySelector('canvas');canvas.width=210;canvas.height=180;});
    for(let frame=0;frame<8;frame++) {
      await page.evaluate(frame=>TrainingDrawing.renderFighter(document.querySelector('canvas').getContext('2d'),0,-1.4*(1+Math.sin(frame/8*Math.PI*2))/2),frame);
      await save('guard',frame);
    }
    for(let frame=0;frame<12;frame++) {
      await page.evaluate(frame=>TrainingDrawing.renderFighter(document.querySelector('canvas').getContext('2d'),TrainingDrawing.punchProfile(frame*0.05),-0.7),frame);
      await save('punch',frame);
    }
    if(options.python) for(const name of pngs) {
      cp.execFileSync(options.python,[path.join(__dirname,'optimize-training-frame.py'),path.join(output,name)],{stdio:'pipe',windowsHide:true});
    }
    const bytes=pngs.reduce((sum,name)=>sum+fs.statSync(path.join(output,name)).size,0);
    console.log(JSON.stringify({directory:output,assetTag,frames:pngs.length,bytes}));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
