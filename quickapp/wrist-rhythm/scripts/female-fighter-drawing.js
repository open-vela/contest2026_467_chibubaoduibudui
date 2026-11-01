// Code-drawn companion to the existing athlete. Rasterized at build time;
// the watch displays PNG frames and does not need Canvas support.
(() => {
  const co = { skin: '#e8b899', shade: '#bc8d73', hair: '#293b50', hairLight: '#46546c',
    vest: '#9c8ad1', vestShade: '#544575', shorts: '#3d506f', shoe: '#c5d6e5',
    glove: '#f8a5bf', gloveShade: '#bf728f', cyan: '#79dfee' };
  function limb(c, points, color, width) {
    c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); points.forEach((point, i) => i ? c.lineTo(...point) : c.moveTo(...point)); c.stroke();
  }
  function oval(c, x, y, rx, ry, color, angle = 0) {
    c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, angle, 0, 2 * Math.PI); c.fill();
  }
  function rounded(c, x, y, w, h, r, color) {
    c.fillStyle = color; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill();
  }
  function glove(c, x, y, angle, size) {
    c.save(); c.translate(x, y); c.rotate(angle); c.scale(size, size);
    rounded(c, -7, 5, 14, 11, 3, co.vestShade);
    rounded(c, -7, 8, 14, 5, 2, co.shoe);
    limb(c, [[-5, 10], [5, 10]], co.vestShade, 1);
    const fill = c.createLinearGradient(-7, -13, 7, 10);
    fill.addColorStop(0, co.glove); fill.addColorStop(1, co.gloveShade);
    c.fillStyle = fill; c.beginPath(); c.moveTo(-10, 4); c.quadraticCurveTo(-13, -12, -4, -15);
    c.quadraticCurveTo(10, -17, 11, -6); c.lineTo(9, 5); c.quadraticCurveTo(2, 10, -10, 4); c.fill();
    oval(c, 8, 2, 4, 6, co.gloveShade, -0.4);
    limb(c, [[-6, -8], [-2, -11], [4, -11]], co.shoe, 1.3); c.restore();
  }
  function render(c, p, bob) {
    c.clearRect(0, 0, 210, 180); c.save(); c.translate(105, 90);
    c.scale(1.3 * 0.86 * 1.06, 1.3 * 0.86 * 1.06); c.translate(0, bob - 1);
    c.save(); c.globalAlpha = 0.28; oval(c, 3, 58, 35, 3.5, '#455466'); c.restore();
    limb(c, [[-7, 17], [-18, 36], [-23, 53]], co.vestShade, 11);
    limb(c, [[7, 17], [19 + 3 * p, 34], [28 + 2 * p, 52 - 3 * p]], co.vestShade, 11);
    limb(c, [[-18, 39], [-23, 53]], co.skin, 7);
    limb(c, [[22 + 2 * p, 39], [28 + 2 * p, 51 - 3 * p]], co.skin, 7);
    rounded(c, -32, 50, 24, 8, 4, co.shoe);
    c.save(); c.translate(25 + 2 * p, 50 - 3 * p); c.rotate(-0.09 * p);
    rounded(c, -3, 0, 24, 8, 4, co.shoe); c.restore();
    limb(c, [[-26, 55], [-13, 55]], co.vestShade, 1.3);
    limb(c, [[29, 54 - 3 * p], [41, 54 - 3 * p]], co.vestShade, 1.3);
    c.save(); c.translate(3 * p, -p); c.rotate(-0.06 * p);
    // Tied high behind the head; hair follows the torso instead of the glove.
    const swing = 4 * p + 0.6 * bob;
    c.fillStyle = co.hair; c.beginPath(); c.moveTo(-12, -56);
    c.bezierCurveTo(-32, -65, -31 - swing, -38, -43 - swing, -25);
    c.quadraticCurveTo(-29 - swing, -26, -25, -38);
    c.quadraticCurveTo(-21, -53, -12, -51); c.closePath(); c.fill();
    limb(c, [[-22, -54], [-27, -44], [-31 - swing, -34]], co.hairLight, 1.6);
    limb(c, [[-16, -55], [-18, -50]], co.cyan, 3.5);
    limb(c, [[-15, -19], [-29, -6], [-23, -29]], co.shade, 9);
    limb(c, [[-27, -5], [-23, -29]], co.skin, 7.5);
    rounded(c, -6, -34, 11, 13, 4, co.skin);
    const vest = c.createLinearGradient(-17, -25, 16, 17);
    vest.addColorStop(0, co.vest); vest.addColorStop(1, co.vestShade);
    c.fillStyle = vest; c.beginPath(); c.moveTo(-7, -27);
    c.quadraticCurveTo(-16, -26, -19, -18); c.quadraticCurveTo(-13, -6, -10, 4);
    c.lineTo(-14, 13); c.quadraticCurveTo(0, 18, 14, 11);
    c.lineTo(10, 2); c.lineTo(16 - 3 * p, -16); c.quadraticCurveTo(11, -24, 4, -27);
    c.quadraticCurveTo(0, -18, -7, -27); c.closePath(); c.fill();
    limb(c, [[-7, -27], [-4, -23], [1, -23], [4, -27]], co.shoe, 1.3);
    limb(c, [[-13, -12], [-7, 5]], co.cyan, 1.9);
    rounded(c, -14, 9, 29, 15, 4, co.shorts);
    rounded(c, -14, 9, 29, 4, 1, co.shoe);
    limb(c, [[0, 14], [-1, 24]], co.vestShade, 1.4);
    limb(c, [[-11, 17], [-9, 22]], co.vest, 2.5);
    c.fillStyle = co.skin; c.beginPath(); c.moveTo(-12, -49);
    c.quadraticCurveTo(-10, -57, 0, -55); c.quadraticCurveTo(9, -54, 8, -45);
    c.lineTo(11, -39); c.lineTo(8, -37); c.quadraticCurveTo(7, -31, 2, -30);
    c.lineTo(-5, -33); c.quadraticCurveTo(-12, -37, -12, -49); c.fill();
    c.fillStyle = co.hair; c.beginPath(); c.moveTo(-13, -36);
    c.quadraticCurveTo(-22, -55, -7, -60); c.quadraticCurveTo(9, -63, 10, -51);
    c.quadraticCurveTo(1, -52, -6, -45); c.lineTo(-8, -37); c.closePath(); c.fill();
    limb(c, [[-12, -52], [-6, -56], [1, -56]], co.hairLight, 1.3);
    oval(c, -9, -38, 2.1, 3.3, co.skin);
    limb(c, [[1, -44], [5, -43]], co.hair, 1.2);
    oval(c, 4.5, -41, 1, 1, co.hair);
    limb(c, [[5, -35], [8, -35]], co.shade, 1.1);
    glove(c, -23, -29, -0.15, 0.96);
    const wx = 24 + 34 * p, wy = -20 - 3 * p, angle = 1.25 * p;
    const dx = wx - 11, dy = wy + 18, distance = Math.max(0.1, Math.hypot(dx, dy));
    const offset = Math.sqrt(Math.max(0, 24 * 24 - Math.min(distance, 47.9) ** 2 / 4));
    const elbow = [(11 + wx) / 2 - dy / distance * offset, (-18 + wy) / 2 + dx / distance * offset];
    limb(c, [[11, -18], elbow], co.shade, 9);
    limb(c, [elbow, [wx, wy]], co.skin, 8);
    oval(c, elbow[0], elbow[1], 4, 4, co.skin);
    glove(c, wx + Math.sin(angle) * 9, wy - Math.cos(angle) * 9, angle, 1.02);
    c.restore(); c.restore();
  }
  globalThis.FemaleFighterDrawing = { render };
})();
