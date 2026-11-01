const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const runner = require('../scripts/release-runner.js');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

function withTempDirectory(fn) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openvela-release-runner-test-'));
  try {
    fn(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('非 ASCII 工作路径才启用发布暂存', () => {
  assert.strictEqual(runner.needsAsciiStaging('C:\\work\\openvela'), false);
  assert.strictEqual(runner.needsAsciiStaging('F:\\项目\\openvela'), true);
});

test('暂存输入保留源码、可选签名和根配置，跳过构建产物', () => {
  withTempDirectory((projectRoot) => {
    for (const entry of ['src', 'sign', 'config', 'build', 'dist', 'node_modules']) {
      fs.mkdirSync(path.join(projectRoot, entry));
    }
    for (const file of ['package.json', 'package-lock.json', '.npmrc', 'README.md']) {
      fs.writeFileSync(path.join(projectRoot, file), file);
    }

    assert.deepStrictEqual(runner.projectEntries(projectRoot), [
      '.npmrc',
      'README.md',
      'config',
      'package-lock.json',
      'package.json',
      'sign',
      'src',
    ]);
  });
});

test('仅接受非空正式 RPK 并排除 debug 包', () => {
  withTempDirectory((dist) => {
    fs.writeFileSync(path.join(dist, 'com.openvela.wristrhythm.debug.1.0.0.rpk'), 'debug');
    fs.writeFileSync(path.join(dist, 'com.openvela.wristrhythm.release.1.0.0.rpk'), 'release');

    assert.strictEqual(
      path.basename(runner.findReleaseArtifact(dist)),
      'com.openvela.wristrhythm.release.1.0.0.rpk',
    );

    fs.truncateSync(path.join(dist, 'com.openvela.wristrhythm.release.1.0.0.rpk'), 0);
    assert.throws(() => runner.findReleaseArtifact(dist), /non-empty release RPK/);
  });
});

test('发布前移除确切的旧正式 RPK，防止将其当作新产物', () => {
  withTempDirectory((projectRoot) => {
    const sourceDirectory = path.join(projectRoot, 'src');
    const distDirectory = path.join(projectRoot, 'dist');
    fs.mkdirSync(sourceDirectory);
    fs.mkdirSync(distDirectory);
    fs.writeFileSync(path.join(sourceDirectory, 'manifest.json'), JSON.stringify({
      package: 'com.openvela.wristrhythm',
      versionName: '1.0.0',
    }));
    const expectedArtifact = path.join(distDirectory, 'com.openvela.wristrhythm.release.1.0.0.rpk');
    fs.writeFileSync(expectedArtifact, 'stale-release');

    assert.strictEqual(runner.prepareReleaseArtifact(projectRoot), expectedArtifact);
    assert.strictEqual(fs.existsSync(expectedArtifact), false);
    assert.throws(() => runner.findExpectedReleaseArtifact(projectRoot), /non-empty expected release RPK/);

    fs.writeFileSync(expectedArtifact, 'fresh-release');
    assert.strictEqual(runner.findExpectedReleaseArtifact(projectRoot), expectedArtifact);
  });
});

test('实际暂存发布失败会清除真实 dist 中的旧目标产物', () => {
  withTempDirectory((directory) => {
    const projectRoot = path.join(directory, '项目');
    const sourceDirectory = path.join(projectRoot, 'src');
    const distDirectory = path.join(projectRoot, 'dist');
    fs.mkdirSync(sourceDirectory, { recursive: true });
    fs.mkdirSync(distDirectory);
    fs.mkdirSync(path.join(projectRoot, 'node_modules'));
    fs.writeFileSync(path.join(sourceDirectory, 'manifest.json'), JSON.stringify({
      package: 'com.openvela.wristrhythm',
      versionName: '1.0.0',
    }));
    const destination = path.join(distDirectory, 'com.openvela.wristrhythm.release.1.0.0.rpk');
    fs.writeFileSync(destination, 'stale-release');

    assert.throws(() => runner.runRelease(projectRoot, {
      runNativeRelease() {
        throw new Error('fixture staged failure');
      },
    }));
    assert.strictEqual(fs.existsSync(destination), false);
  });
});

test('工具链记录构建错误时发布失败，即使退出码为零', () => {
  assert.strictEqual(runner.hasReleaseFailure('ERROR:  build error , Error: signing failed'), true);
  assert.strictEqual(runner.hasReleaseFailure('✅ [toolkit]: build success'), false);
});

test('暂存构建只接收运行输入，不扫描历史录像、工作树和备份脚本', () => {
  withTempDirectory((root) => {
    for (const entry of ['src', 'sign', 'output', '.worktrees', 'tools', 'test', 'docs', '.codex-debug']) {
      fs.mkdirSync(path.join(root, entry));
    }
    fs.writeFileSync(path.join(root, 'package.json'), '{}');
    const inputs = runner.projectEntries(root);
    assert.deepStrictEqual(inputs, ['package.json', 'sign', 'src']);
  });
});

test('Debug 也通过隔离输入构建并只发布新的对应产物', () => {
  withTempDirectory((root) => {
    fs.mkdirSync(path.join(root, 'src'));
    fs.mkdirSync(path.join(root, 'node_modules'));
    fs.writeFileSync(path.join(root, 'src', 'manifest.json'), JSON.stringify({ package: 'test.app', versionName: '1.0.0' }));
    fs.mkdirSync(path.join(root, 'output'));
    fs.writeFileSync(path.join(root, 'output', 'old.js'), 'throw new Error("not a source")');
    const artifact = runner.runDebug(root, {
      runNativeRelease(stage, mode) {
        assert.notEqual(stage, root);
        assert.equal(mode, 'debug');
        assert.equal(fs.existsSync(path.join(stage, 'output')), false);
        fs.mkdirSync(path.join(stage, 'dist'));
        fs.writeFileSync(path.join(stage, 'dist', 'test.app.debug.1.0.0.rpk'), 'new-debug');
      },
    });
    assert.equal(fs.readFileSync(artifact, 'utf8'), 'new-debug');
    assert.equal(fs.readFileSync(path.join(root, 'output', 'old.js'), 'utf8'), 'throw new Error("not a source")');
  });
});

console.log(`\n${passed} release runner tests passed`);
