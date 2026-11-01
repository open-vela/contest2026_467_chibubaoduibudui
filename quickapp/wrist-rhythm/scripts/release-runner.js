const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RELEASE_ARGS = [
  'release',
  '--enable-jsc',
  // 大赛镜像 20260717 不识别缩写 CSS 键（w / h / foS 等）；保持完整属性名。
  '--enable-image-png8',
  '--drop-console',
  'false',
];

function needsAsciiStaging(projectRoot) {
  return /[^\x00-\x7f]/.test(path.resolve(projectRoot));
}

function projectEntries(projectRoot) {
  return fs.readdirSync(projectRoot, { withFileTypes: true })
    .filter((entry) => {
      if (entry.isDirectory()) return ['src', 'sign', 'config'].includes(entry.name);
      return entry.isFile() && /^(package(-lock)?\.json|\.npmrc|README\.md|(?:babel|webpack|aiot|config)[\w.-]*\.(?:json|js))$/.test(entry.name);
    })
    .map((entry) => entry.name)
    .sort();
}

function findReleaseArtifact(distDirectory) {
  const artifact = fs.readdirSync(distDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.includes('.release.') && entry.name.endsWith('.rpk'))
    .map((entry) => path.join(distDirectory, entry.name))
    .find((candidate) => fs.statSync(candidate).size > 0);
  if (!artifact) {
    throw new Error('AIoT release did not produce a non-empty release RPK');
  }
  return artifact;
}

function expectedReleaseArtifact(projectRoot, mode = 'release') {
  const manifestPath = path.join(projectRoot, 'src', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!/^[A-Za-z0-9._-]+$/.test(manifest.package || '') || !/^[A-Za-z0-9._-]+$/.test(manifest.versionName || '')) {
    throw new Error(`Invalid release artifact name in ${manifestPath}`);
  }
  return path.join(projectRoot, 'dist', `${manifest.package}.${mode}.${manifest.versionName}.rpk`);
}

function prepareReleaseArtifact(projectRoot, mode = 'release') {
  const artifact = expectedReleaseArtifact(projectRoot, mode);
  fs.rmSync(artifact, { force: true });
  return artifact;
}

function findExpectedReleaseArtifact(projectRoot, mode = 'release') {
  const artifact = expectedReleaseArtifact(projectRoot, mode);
  if (!fs.existsSync(artifact) || fs.statSync(artifact).size === 0) {
    throw new Error('AIoT release did not produce a non-empty expected release RPK');
  }
  return artifact;
}

function hasReleaseFailure(output) {
  return /(?:ERROR:\s+build error|Command failed:|Generate jsc bytecode error)/i.test(output);
}

function copyProjectInputs(projectRoot, stageProject) {
  fs.mkdirSync(stageProject, { recursive: true });
  for (const entry of projectEntries(projectRoot)) {
    fs.cpSync(path.join(projectRoot, entry), path.join(stageProject, entry), { recursive: true });
  }
  const nodeModules = path.join(projectRoot, 'node_modules');
  if (!fs.existsSync(nodeModules)) {
    throw new Error('node_modules is required for the AIoT release');
  }
  fs.symlinkSync(nodeModules, path.join(stageProject, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
}

function runNativeRelease(projectRoot, mode = 'release') {
  const aiotBin = path.join(projectRoot, 'node_modules', 'aiot-toolkit', 'lib', 'bin.js');
  if (!fs.existsSync(aiotBin)) {
    throw new Error(`AIoT toolkit binary not found: ${aiotBin}`);
  }
  const args = mode === 'debug' ? ['build'] : RELEASE_ARGS;
  console.log(`> aiot ${args.join(' ')}`);
  const result = childProcess.spawnSync(process.execPath, [aiotBin, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  process.stdout.write(output);
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 || hasReleaseFailure(output)) {
    throw new Error(`AIoT release failed${result.status === 0 ? ' despite a zero exit status' : ` with exit status ${result.status}`}`);
  }
}

function createStageRoot() {
  const temporaryDirectory = os.tmpdir();
  if (needsAsciiStaging(temporaryDirectory)) {
    throw new Error(`System temporary directory must be ASCII-only: ${temporaryDirectory}`);
  }
  return fs.mkdtempSync(path.join(temporaryDirectory, 'openvela-release-'));
}

function publishReleaseArtifact(source, destination) {
  const destinationDirectory = path.dirname(destination);
  fs.mkdirSync(destinationDirectory, { recursive: true });
  const publishDirectory = fs.mkdtempSync(path.join(destinationDirectory, '.release-publish-'));
  const temporaryDestination = path.join(publishDirectory, path.basename(destination));
  try {
    fs.copyFileSync(source, temporaryDestination);
    if (fs.statSync(temporaryDestination).size === 0) {
      throw new Error('Copied release RPK is empty');
    }
    fs.renameSync(temporaryDestination, destination);
    return destination;
  } finally {
    fs.rmSync(publishDirectory, { recursive: true, force: true });
  }
}

function runBuild(projectRoot, overrides, mode) {
  const resolvedRoot = path.resolve(projectRoot);
  const operations = {
    copyProjectInputs,
    createStageRoot,
    runNativeRelease,
    ...overrides,
  };
  const destination = prepareReleaseArtifact(resolvedRoot, mode);

  const stageRoot = operations.createStageRoot();
  const stageProject = path.join(stageRoot, 'project');
  try {
    operations.copyProjectInputs(resolvedRoot, stageProject);
    prepareReleaseArtifact(stageProject, mode);
    operations.runNativeRelease(stageProject, mode);
    const artifact = findExpectedReleaseArtifact(stageProject, mode);
    return publishReleaseArtifact(artifact, destination);
  } finally {
    fs.rmSync(stageRoot, { recursive: true, force: true });
  }
}

function runRelease(projectRoot = process.cwd(), overrides = {}) {
  return runBuild(projectRoot, overrides, 'release');
}

function runDebug(projectRoot = process.cwd(), overrides = {}) {
  return runBuild(projectRoot, overrides, 'debug');
}

if (require.main === module) {
  try {
    const artifact = process.argv.includes('--debug') ? runDebug() : runRelease();
    console.log(`Built RPK: ${artifact}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  expectedReleaseArtifact,
  findReleaseArtifact,
  findExpectedReleaseArtifact,
  hasReleaseFailure,
  needsAsciiStaging,
  prepareReleaseArtifact,
  publishReleaseArtifact,
  projectEntries,
  runRelease,
  runDebug,
};
