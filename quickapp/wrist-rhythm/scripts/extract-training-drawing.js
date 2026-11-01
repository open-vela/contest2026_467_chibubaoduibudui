// One-time import of the user-approved, code-drawn preview. The resulting
// training-drawing.js is self-contained and stays reproducible in this repo.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const source = fs.readFileSync(process.argv[2], 'utf8');
const names = ['circle','glow','dot','limb','oval','rounded','elbowJoint','refinedGlove','refinedFighter','punchProfile'];
const helpers = names.map(name => {
  const found = source.match(new RegExp('  function ' + name + '\\([\\s\\S]*?\\n  }\\n'));
  if (!found) throw Error('Missing approved drawing function: ' + name);
  return found[0];
}).join('\n');
const prefix = "// Imported from the approved refined-athlete preview. Native assets use this\n// renderer at build time; the Vela app does not require Canvas.\n(() => {\n  const settings = { fighterSize: 1.06 };\n  const clamp = (n,a,b) => Math.min(b,Math.max(a,n));\n  const ease = n => (1-Math.cos(Math.PI*clamp(n,0,1)))/2;\n";
const suffix = `
  const colors = { cyan:'#79dfee', violet:'#a898d7', amber:'#f5c16a', hit:'#f8a5bf', border:'#455466',
    skin:'#e8b899',hair:'#233445',shoe:'#c5d6e5',vest:'#427c92','vest-shade':'#244657',
    shorts:'#384b6b','glove-shade':'#bf728f','skin-shade':'#bc8d73' };
  function renderBreath(c,value) {
    c.clearRect(0,0,250,250);c.save();c.translate(125,125);
    c.beginPath();c.arc(0,0,124,0,Math.PI*2);c.clip();c.scale(1.5,1.5);
    const r=32+32*value;
    glow(c,0,0,103,colors.cyan,0.1+0.14*value);
    circle(c,0,0,68,colors.border,0.45);
    for(let i=0;i<3;i++){circle(c,0,0,r-i*10,colors.cyan,0.55-i*0.16,1.25);glow(c,0,0,r-i*7,colors.cyan,0.04);}
    glow(c,0,0,39,colors.cyan,0.55+0.15*value);dot(c,0,0,12+8*value,colors.cyan,0.7+0.3*value);
    c.restore();
  }
  function renderFighter(c,punch,bob) {
    c.clearRect(0,0,210,180);c.save();c.translate(105,90);c.scale(1.3,1.3);
    refinedFighter(c,0,0,punch,bob,colors,0);c.restore();
  }
  globalThis.TrainingDrawing={renderBreath,renderFighter,punchProfile};
})();
`;
fs.writeFileSync(path.join(__dirname,'training-drawing.js'), prefix + helpers + suffix);
console.log(JSON.stringify({functions:names.length,approvedPreviewSha256:crypto.createHash('sha256').update(source).digest('hex')}));
