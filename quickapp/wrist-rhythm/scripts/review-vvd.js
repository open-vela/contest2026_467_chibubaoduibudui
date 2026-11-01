const fs=require('fs');
const {VvdManager}=require('@aiot-toolkit/emulator/lib/vvd');
const {args}=require('./review-emulator');
const o=args(process.argv.slice(2));
const m=new VvdManager({sdkHome:o.sdk});
(async()=>{
 if(!fs.existsSync(o.sdk)) throw Error('SDK directory does not exist');
 const cmd=await m.getVvdStartCmd({vvdName:o.vvd,qtHideWindow:true,grpcPort:+o.grpc,debugPort:+o.debug});
 const suffix=cmd.indexOf(' -vela ');
 if(suffix<0) throw Error('Unexpected emulator command format');
 const executable=cmd.slice(0,suffix).replace(/^"|"$/g,'');
 // Use the same headless renderer as the existing review instance; no host microphone.
 const arguments=cmd.slice(suffix+1).replace(' -allow-host-audio','').replace(' -qt-hide-window',' -no-window -gpu swiftshader_indirect -no-snapshot');
 console.log(JSON.stringify({executable:fs.existsSync(executable)?executable:executable+'.exe',arguments}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
