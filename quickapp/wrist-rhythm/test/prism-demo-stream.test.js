const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Exercise the real HTTP handlers with a device-free gRPC transport. In grpc-js,
// destroying a readable is distinct from cancelling the underlying RPC.
async function demo({ readiness, stopWait } = {}) {
  let handler;
  const streams = [];
  let launches = 0;
  const client = {
    screenshotStream: null,
    controller: { Image: {} },
    authMate: {},
    waitForReady: () => readiness ? readiness() : Promise.resolve(),
    client: {
      streamScreenshot() {
        const stream = new EventEmitter();
        stream.cancellations = 0;
        stream.destructions = 0;
        stream.cancel = () => {
          stream.cancellations += 1;
          queueMicrotask(() => stream.emit('error', Error('CANCELLED')));
        };
        stream.destroy = () => { stream.destructions += 1; };
        streams.push(stream);
        return stream;
      }
    },
    async startStream(onFrame) {
      await this.waitForReady();
      this.screenshotStream?.destroy();
      this.screenshotStream = this.client.streamScreenshot();
      this.screenshotStream.on('data', response => onFrame(response.image));
    }
  };
  class Device {
    constructor() {
      this.client = client;
      this.status = { width: 466, height: 466 };
      this.packageName = 'com.openvela.wristrhythm';
      this.logs = '';
    }
    async connect() {}
    async install() {}
    async launch() {
      launches += 1;
      this.logs += '[qapp] quickapp_state_trans: com.openvela.wristrhythm: [stopped]-->[foreground]\n';
    }
    shell() {}
    async milestone(_offset, predicate) {
      await stopWait;
      assert.equal(predicate('[qapp] quickapp_state_trans: com.openvela.wristrhythm: [closing]-->[stopped]\n'), true);
    }
    async shot() {}
    close() {}
  }
  const server = new EventEmitter();
  server.listen = (_port, _host, ready) => ready();
  const context = {
    URL,
    require(name) {
      if (name === './review-emulator') return { ReviewDevice: Device, args: () => ({}), wait: async () => {} };
      if (name === 'http') return { createServer(fn) { handler = fn; return server; } };
      return require(name);
    },
    __dirname: path.resolve(__dirname, '../scripts'),
    process: { argv: [], on() {}, exit() {}, exitCode: 0 },
    console: { log() {}, error() {} }
  };
  const source = fs.readFileSync(path.resolve(__dirname, '../scripts/prism-demo-server.js'), 'utf8');
  vm.runInNewContext(source.replace('main().catch(', 'globalThis.startup = main().catch('), context);
  await context.startup;
  async function request(url, method = 'GET') {
    const req = new EventEmitter();
    Object.assign(req, { url, method, headers: { host: '127.0.0.1:8202', origin: 'http://127.0.0.1:8202' } });
    const res = new EventEmitter();
    Object.assign(res, {
      ended: false,
      messages: [],
      writeHead() {},
      flushHeaders() {},
      write(value) { this.messages.push(value); return true; },
      end(value) { this.ended = true; if (value) this.messages.push(value); this.emit('close'); }
    });
    const pending = handler(req, res);
    return { res, pending };
  }
  return { streams, request, client, launchCount: () => launches };
}

test('only the last viewer disconnect cancels the screenshot RPC', async () => {
  const app = await demo();
  const first = await app.request('/api/stream');
  await first.pending;
  const second = await app.request('/api/stream');
  await second.pending;
  assert.equal(app.streams.length, 1);
  first.res.end();
  assert.equal(app.streams[0].cancellations, 0);
  second.res.end();
  assert.equal(app.streams[0].cancellations, 1);
  assert.equal(app.streams[0].destructions, 1);
});

test('obsolete stream errors and frames cannot affect a new viewer', async () => {
  const app = await demo();
  const first = await app.request('/api/stream');
  await first.pending;
  const old = app.streams[0];
  first.res.end();
  const second = await app.request('/api/stream');
  await second.pending;
  old.emit('error', Error('late CANCELLED'));
  old.emit('data', { image: Buffer.from('obsolete') });
  assert.equal(second.res.ended, false);
  assert.equal(second.res.messages.length, 0);
  app.streams[1].emit('data', { image: Buffer.from('fresh') });
  assert.match(second.res.messages[0], /ZnJlc2g=/);
  second.res.end();
});

test('disconnect during readiness cannot start a screenshot RPC later', async () => {
  let ready;
  const app = await demo({ readiness: () => new Promise(resolve => { ready = resolve; }) });
  const first = await app.request('/api/stream');
  first.res.end();
  ready();
  await first.pending;
  assert.equal(app.streams.length, 0);
});

test('current stream error closes viewers and permits reconnect', async () => {
  const app = await demo();
  const first = await app.request('/api/stream');
  await first.pending;
  app.streams[0].emit('error', Error('transport unavailable'));
  assert.equal(first.res.ended, true);
  assert.equal(app.streams[0].cancellations, 1);
  const second = await app.request('/api/stream');
  await second.pending;
  assert.equal(app.streams.length, 2);
  assert.equal(second.res.ended, false);
  second.res.end();
});

test('current stream end closes subscribers instead of freezing the display', async () => {
  const app = await demo();
  const first = await app.request('/api/stream');
  await first.pending;
  app.streams[0].emit('end');
  assert.equal(first.res.ended, true);
  const status = await app.request('/api/status');
  await status.pending;
  assert.equal(JSON.parse(status.res.messages[0]).streaming, false);
});

test('restart waits for native stopped state before launching again', async () => {
  let finishStop;
  const stopWait = new Promise(resolve => { finishStop = resolve; });
  const app = await demo({ stopWait });
  const restart = await app.request('/api/restart', 'POST');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.launchCount(), 1);
  finishStop();
  await restart.pending;
  assert.equal(app.launchCount(), 2);
  assert.equal(JSON.parse(restart.res.messages[0]).ok, true);
});
