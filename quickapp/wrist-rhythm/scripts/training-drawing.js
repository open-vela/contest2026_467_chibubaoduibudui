// Imported from the approved refined-athlete preview. Native assets use this
// renderer at build time; the Vela app does not require Canvas.
(() => {
  const settings = { fighterSize: 1.06 };
  const clamp = (n,a,b) => Math.min(b,Math.max(a,n));
  const ease = n => (1-Math.cos(Math.PI*clamp(n,0,1)))/2;
  function circle(c,x,y,r,color,alpha=1,width=1) {
    c.save();c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.arc(x,y,Math.max(0.1,r),0,Math.PI*2);c.stroke();c.restore();
  }

  function glow(c,x,y,r,color,opacity=0.2) {
    c.save();c.globalAlpha=opacity;
    const gradient=c.createRadialGradient(x,y,0,x,y,r);
    gradient.addColorStop(0,color);gradient.addColorStop(0.52,color+'80');gradient.addColorStop(1,color+'00');
    c.fillStyle=gradient;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.restore();
  }

  function dot(c,x,y,r,color,alpha=1) {
    c.save();c.globalAlpha=alpha;c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.restore();
  }

  function limb(c,points,color,width) {
    c.save();c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();
    points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.stroke();c.restore();
  }

  function oval(c,x,y,rx,ry,fill,angle=0,alpha=1) {
    c.save();c.globalAlpha=alpha;c.fillStyle=fill;c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fill();c.restore();
  }

  function rounded(c,x,y,width,height,radius,fill,stroke=null) {
    c.fillStyle=fill;c.beginPath();c.roundRect(x,y,width,height,radius);c.fill();
    if(stroke){c.strokeStyle=stroke;c.lineWidth=1.2;c.stroke();}
  }

  function elbowJoint(sx,sy,wx,wy) {
    const dx=wx-sx,dy=wy-sy,d=Math.max(0.1,Math.hypot(dx,dy));
    const reach=Math.min(d,47.9),offset=Math.sqrt(Math.max(0,24*24-reach*reach/4));
    return [(sx+wx)/2-dy/d*offset,(sy+wy)/2+dx/d*offset];
  }

  function refinedGlove(c,x,y,angle,co,charge,size=1) {
    c.save();c.translate(x,y);c.rotate(angle);c.scale(size,size);
    rounded(c,-7,5,14,11,3,co['vest-shade']);
    rounded(c,-7,8,14,5,2,co.shoe);limb(c,[[-5,10],[5,10]],co['vest-shade'],1);
    const fill=c.createLinearGradient(-7,-13,7,10);fill.addColorStop(0,co.hit);fill.addColorStop(1,co['glove-shade']);
    c.fillStyle=fill;c.beginPath();c.moveTo(-10,4);c.quadraticCurveTo(-13,-12,-4,-15);
    c.quadraticCurveTo(10,-17,11,-6);c.lineTo(9,5);c.quadraticCurveTo(2,10,-10,4);c.fill();
    oval(c,8,2,4,6,co['glove-shade'],-0.4);
    limb(c,[[-6,-8],[-2,-11],[4,-11]],co.shoe,1.3);
    if(charge>0){c.save();c.globalAlpha=charge*0.85;limb(c,[[-9,-2],[-8,-8],[-2,-13]],co.amber,1.8);c.restore();}
    c.restore();
  }

  function refinedFighter(c,x,y,p,breathBob,co,charge) {
    c.save();c.translate(x,y+breathBob-1);c.scale(0.86*settings.fighterSize,0.86*settings.fighterSize);
    oval(c,3,58,35,3.5,co.border,0,0.28);
    limb(c,[[-8,17],[-18,36],[-23,53]],co['vest-shade'],12);
    limb(c,[[7,17],[19+3*p,34],[28+2*p,52-3*p]],co['vest-shade'],12);
    limb(c,[[-18,39],[-23,53]],co.skin,7);
    limb(c,[[22+2*p,39],[28+2*p,51-3*p]],co.skin,7);
    rounded(c,-32,50,24,8,4,co.shoe);
    c.save();c.translate(25+2*p,50-3*p);c.rotate(-0.09*p);rounded(c,-3,0,24,8,4,co.shoe);c.restore();
    limb(c,[[-26,55],[-13,55]],co['vest-shade'],1.3);limb(c,[[29,54-3*p],[41,54-3*p]],co['vest-shade'],1.3);
    c.save();c.translate(3*p,-p);c.rotate(-0.06*p);
    limb(c,[[-17,-19],[-30,-6],[-23,-29]],co['skin-shade'],10);
    limb(c,[[-28,-5],[-23,-29]],co.skin,8);
    rounded(c,-7,-33,12,12,4,co.skin);
    const vest=c.createLinearGradient(-18,-25,17,17);vest.addColorStop(0,co.vest);vest.addColorStop(1,co['vest-shade']);
    c.fillStyle=vest;c.beginPath();c.moveTo(-7,-27);c.quadraticCurveTo(-18,-27,-22,-16);
    c.quadraticCurveTo(-16,-5,-13,12);c.quadraticCurveTo(0,18,13,10);
    c.lineTo(18-4*p,-14);c.quadraticCurveTo(12,-25,4,-26);c.closePath();c.fill();
    limb(c,[[-8,-26],[-6,-21],[3,-22],[6,-26]],co.shoe,1.4);
    limb(c,[[-14,-13],[-8,6]],co.cyan,2);
    limb(c,[[9,-15],[7,5]],co['vest-shade'],2);
    rounded(c,-14,8,29,16,4,co.shorts);rounded(c,-14,8,29,4,1,co.shoe);
    limb(c,[[0,13],[-1,24]],co['vest-shade'],1.4);
    limb(c,[[-10,21],[-6,21]],co.cyan,1.7);
    c.fillStyle=co.skin;c.beginPath();c.moveTo(-13,-49);c.quadraticCurveTo(-11,-58,0,-55);
    c.quadraticCurveTo(10,-54,9,-45);c.lineTo(12,-39);c.lineTo(8,-37);
    c.quadraticCurveTo(8,-30,2,-29);c.lineTo(-7,-32);c.quadraticCurveTo(-13,-37,-13,-49);c.fill();
    c.fillStyle=co.hair;c.beginPath();c.moveTo(-13,-38);c.quadraticCurveTo(-21,-56,-6,-59);
    c.quadraticCurveTo(9,-62,11,-51);c.lineTo(4,-51);c.lineTo(-3,-49);c.lineTo(-9,-43);c.lineTo(-9,-37);c.closePath();c.fill();
    oval(c,-10,-38,2.3,3.5,co.skin);
    limb(c,[[2,-44],[6,-43]],co.hair,1.3);dot(c,5,-41,1.1,co.hair);
    limb(c,[[6,-34],[9,-34]],co['skin-shade'],1.1);
    refinedGlove(c,-23,-29,-0.15,co,charge,0.96);
    const wx=24+34*p,wy=-20-3*p,angle=1.25*p;
    const elbow=elbowJoint(12,-18,wx,wy);
    limb(c,[[12,-18],elbow],co['skin-shade'],10);
    limb(c,[elbow,[wx,wy]],co.skin,9);
    oval(c,elbow[0],elbow[1],4.3,4.3,co.skin);
    refinedGlove(c,wx+Math.sin(angle)*9,wy-Math.cos(angle)*9,angle,co,charge,1.02);
    c.restore();c.restore();
  }

  function punchProfile(age) {
    if(age<0||age>=0.54)return 0;
    if(age<0.12)return 1-Math.pow(1-age/0.12,3);
    if(age<0.19)return 1;
    return 1-ease((age-0.19)/0.35);
  }

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
