// Local interactive mirror of the actual openvela emulator. No app state mocks.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { ReviewDevice, args, wait } = require('./review-emulator');
const options = args(process.argv.slice(2));
const port = Number(options.port || 8202);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid local port');
const origin = `http://127.0.0.1:${port}`;
const d = new ReviewDevice({ ...options, vvd: options.vvd || 'WristRhythm_Review_20261012', output: options.output || 'output/prism-live-demo' });
let framePromise;
let operations = Promise.resolve();
let restarting = false;
const viewers = new Set();
let streaming = false;
let activeStream = null;
let streamEpoch = 0;
let lastFrame = null;
let frameCount = 0;
function stopFrames() {
  const stream = activeStream;
  // Invalidate callbacks before cancel(), which emits an asynchronous error.
  streamEpoch += 1;
  activeStream = null;
  streaming = false;
  // grpc-js destroy() alone does not cancel the underlying screenshot RPC.
  stream?.cancel();
  stream?.destroy();
}
function endFrames(epoch, stream) {
  if (epoch !== streamEpoch || stream !== activeStream) return;
  const disconnected = [...viewers];
  viewers.clear();
  stopFrames();
  for (const viewer of disconnected) viewer.res.end();
}
async function startFrames() {
  if (streaming || !viewers.size) return;
  const epoch = ++streamEpoch;
  streaming = true;
  try {
    await d.client.waitForReady();
    if (epoch !== streamEpoch || !viewers.size) return;
    const stream = d.client.client.streamScreenshot(d.client.controller.Image, d.client.authMate);
    activeStream = stream;
    stream.on('data', response => {
      if (epoch !== streamEpoch || stream !== activeStream) return;
      const png = response.image;
      if (!png.length) return;
      frameCount += 1;
      lastFrame = 'data:image/png;base64,' + png.toString('base64');
      const event = `event: frame\ndata: ${lastFrame}\n\n`;
      for (const viewer of viewers) {
        // Drop intermediate frames for a slow tab instead of growing a queue.
        if (!viewer.blocked) viewer.blocked = !viewer.res.write(event);
      }
    });
    stream.on('error', () => endFrames(epoch, stream));
    stream.on('end', () => endFrames(epoch, stream));
  } catch (error) {
    if (epoch !== streamEpoch) return;
    endFrames(epoch, activeStream);
    console.error('Screenshot stream: ' + error.message);
  }
}
function queued(task) {
  const result = operations.then(task);
  operations = result.catch(() => {});
  return result;
}
function appStopped(log) {
  const prefix = 'quickapp_state_trans: ' + d.packageName + ':';
  const latest = log.split('\n').filter(line => line.includes(prefix)).at(-1) || '';
  return /-->\[stopped\]\s*$/.test(latest);
}
function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
async function body(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 1024) throw Error('Request too large');
  }
  return JSON.parse(text || '{}');
}
async function main() {
  await d.connect();
  await d.install(options.rpk || path.resolve(__dirname, '../dist/com.openvela.wristrhythm.release.1.0.0.rpk'));
  await d.launch();
  await wait(2000);
  await d.shot('demo-home');
  const html = fs.readFileSync(path.join(__dirname, 'prism-demo.html'));
  const server = http.createServer(async (req, res) => {
    try {
      if (req.headers.host !== `127.0.0.1:${port}`) return json(res, 403, { error: 'Use the local demo address' });
      const pathname = new URL(req.url, origin).pathname;
      if (req.method === 'GET' && pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(html);
      }
      if (req.method === 'GET' && pathname === '/api/status') {
        return json(res, 200, { device: d.status, artifact: d.artifact, restarting, streaming, frameCount });
      }
      if (req.method === 'GET' && pathname === '/api/stream') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Connection': 'keep-alive' });
        res.flushHeaders();
        const viewer = { res, blocked: false };
        viewers.add(viewer);
        res.on('drain', () => { viewer.blocked = false; });
        res.on('close', () => {
          viewers.delete(viewer);
          if (!viewers.size) stopFrames();
        });
        if (lastFrame) res.write(`event: frame\ndata: ${lastFrame}\n\n`);
        await startFrames();
        return;
      }
      if (req.method === 'GET' && pathname === '/api/frame') {
        framePromise ||= d.client.getScreenshot().finally(() => { framePromise = null; });
        const png = await framePromise;
        res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
        return res.end(png);
      }
      if (req.method === 'POST') {
        if (req.headers.origin !== origin) return json(res, 403, { error: 'Local page origin required' });
        if (pathname === '/api/activate') {
          await queued(async () => { d.shell(`am start ${d.packageName}`); await wait(800); });
          return json(res, 200, { ok: true });
        }
        if (pathname === '/api/tap') {
          if (restarting) return json(res, 409, { error: '应用正在重启，请稍候' });
          const point = await body(req);
          if (![point.x, point.y].every(Number.isFinite) || point.x < 0 || point.y < 0 || point.x >= d.status.width || point.y >= d.status.height) {
            return json(res, 400, { error: '点击坐标超出表盘' });
          }
          await queued(() => d.click(Math.min(d.status.width - 1, Math.round(point.x)), Math.min(d.status.height - 1, Math.round(point.y))));
          return json(res, 200, { ok: true });
        }
        if (pathname === '/api/restart') {
          if (restarting) return json(res, 409, { error: '应用正在重启，请稍候' });
          restarting = true;
          try {
            await queued(async () => {
              const alreadyStopped = appStopped(d.logs);
              const offset = d.logs.length;
              d.shell(`am stop ${d.packageName}`);
              // am stop returns before native teardown. Starting while closing
              // is ignored by this image, so wait for its actual stopped state.
              if (!alreadyStopped) await d.milestone(offset, appStopped, 'native application stopped before restart', 15000);
              await d.launch();
              await wait(2000);
            });
          } finally { restarting = false; }
          return json(res, 200, { ok: true });
        }
      }
      json(res, 404, { error: 'Unknown demo action' });
    } catch (error) {
      console.error(error.message);
      if (!res.headersSent) json(res, 503, { error: '模拟器暂时未响应，请重试或重启演示' });
      else res.end();
    }
  });
  server.on('error', error => { console.error(error.message); d.close(); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Live native demo: ${origin}`));
  const shutdown = () => {
    stopFrames();
    for (const viewer of viewers) viewer.res.end();
    server.close(() => { d.close(); process.exit(0); });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
main().catch(error => { console.error(error); d.close(); process.exitCode = 1; });
