const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { validateSubmission } = require('../scripts/verify-contest-submission.js');

function write(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function createValidFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openvela-contest-check-'));
  write(root, 'LICENSE', 'Apache License\nVersion 2.0, January 2004\n');
  write(root, 'README.md', '# Demo\n\n## 一、作品简介\n\n## 二、选题方向\n\n## 三、目录结构\n\n## 四、运行方式\n\n## 五、AI Coding 使用说明\n\nrelease.rpk\n');
  write(root, 'contest2026_001_demo.xml', '<linkfile src="quickapp/demo" dest="packages/apps/contest2026_001_demo"/>');
  write(root, 'quickapp/demo/package.json', '{"scripts":{"test":"node test.js","build:release":"aiot release"}}');
  write(root, 'quickapp/demo/src/manifest.json', JSON.stringify({
    package: 'com.example.demo',
    versionName: '1.0.0',
    deviceTypeList: ['watch'],
  }));
  write(root, 'skills/verifying-openvela-watch-submission/SKILL.md', [
    '---',
    'name: verifying-openvela-watch-submission',
    'description: Use when checking an openvela watch entry before contest submission.',
    '---',
    '',
    '# Verify an openvela watch submission',
  ].join('\n'));
  write(root, 'logs/demo/manifest.json', JSON.stringify({
    sessions: [{
      session_id: 'session',
      event_count: 2,
      file_path: 'logs/demo/2026-09-08/codex__session.jsonl',
    }],
  }));
  write(root, 'logs/demo/2026-09-08/codex__session.jsonl', [
    '{"session_id":"session","seq":0}',
    '{"session_id":"session","seq":1}',
    '',
  ].join('\n'));
  write(root, 'artifacts/com.example.demo.release.1.0.0.rpk', Buffer.concat([
    Buffer.from('PK\u0003\u0004'),
    Buffer.alloc(2048),
  ]));
  return root;
}

function test(name, run) {
  try {
    run();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test('完整赛事工程通过提交契约校验', () => {
  const fixture = createValidFixture();
  try {
    const result = validateSubmission(fixture);
    assert.deepStrictEqual(result.errors, []);
    assert.strictEqual(result.ok, true);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('缺少正式 RPK 时给出可执行的错误', () => {
  const fixture = createValidFixture();
  try {
    fs.rmSync(path.join(fixture, 'artifacts', 'com.example.demo.release.1.0.0.rpk'));
    const result = validateSubmission(fixture);
    assert(result.errors.includes('缺少 artifacts/com.example.demo.release.1.0.0.rpk'));
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('AI 日志包含损坏 JSON 或不连续序号时拒绝提交', () => {
  const fixture = createValidFixture();
  try {
    write(fixture, 'logs/demo/2026-09-08/codex__session.jsonl', [
      '{"session_id":"session","seq":0}',
      '{not-json}',
      '{"session_id":"session","seq":3}',
      '',
    ].join('\n'));
    const result = validateSubmission(fixture);
    assert(result.errors.some((message) => message.includes('第 2 行不是有效 JSON')));
    assert(result.errors.some((message) => message.includes('seq 应为 1，实际为 3')));
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('AI 日志必须与 manifest 清单及事件数一致', () => {
  const fixture = createValidFixture();
  try {
    write(fixture, 'logs/demo/manifest.json', JSON.stringify({
      sessions: [{
        session_id: 'session',
        event_count: 3,
        file_path: 'logs/demo/2026-09-08/codex__session.jsonl',
      }],
    }));
    write(fixture, 'logs/demo/2026-09-08/codex__extra.jsonl', '{"session_id":"extra","seq":0}\n');
    const result = validateSubmission(fixture);
    assert(result.errors.some((message) => message.includes('event_count 为 3，实际为 2')));
    assert(result.errors.some((message) => message.includes('未登记到 manifest.json')));
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('赛事最新分支自身满足提交契约', () => {
  const result = validateSubmission(path.resolve(__dirname, '..'));
  assert.deepStrictEqual(result.errors, []);
  assert.strictEqual(result.ok, true);
});

console.log('\n5 contest compliance tests passed');
