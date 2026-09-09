const fs = require('fs');
const path = require('path');

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function listFiles(root, accept, options) {
  const config = options || {};
  const ignored = new Set(config.ignored || ['.git', 'node_modules', 'build', 'dist']);
  const found = [];
  if (!fs.existsSync(root)) return found;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) found.push(...listFiles(absolute, accept, config));
    else if (accept(absolute)) found.push(absolute);
  }
  return found;
}

function parseFrontmatter(source) {
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fields = {};
  match[1].split(/\r?\n/).forEach((line) => {
    const separator = line.indexOf(':');
    if (separator === -1) return;
    fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  });
  return fields;
}

function normalizeRelativePath(relativePath) {
  return path.normalize(relativePath).replace(/\\/g, '/');
}

function validateLogFile(root, relativePath, session, errors) {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized.startsWith('logs/') || normalized.includes('../')) {
    errors.push(`AI 日志 manifest 包含非法路径：${relativePath}`);
    return null;
  }

  const absolute = path.join(root, ...normalized.split('/'));
  if (!fs.existsSync(absolute)) {
    errors.push(`AI 日志 manifest 指向不存在的文件：${normalized}`);
    return normalized;
  }

  const lines = readText(absolute).split(/\r?\n/).filter((line) => line.trim() !== '');
  let expectedSeq = 0;
  lines.forEach((line, index) => {
    let event;
    try {
      event = JSON.parse(line);
    } catch (error) {
      errors.push(`${normalized} 第 ${index + 1} 行不是有效 JSON`);
      return;
    }
    if (event.seq !== expectedSeq) {
      errors.push(`${normalized} 第 ${index + 1} 行 seq 应为 ${expectedSeq}，实际为 ${event.seq}`);
    }
    expectedSeq += 1;
    if (session.session_id && event.session_id !== session.session_id) {
      errors.push(`${normalized} 第 ${index + 1} 行 session_id 与 manifest 不一致`);
    }
  });

  if (lines.length === 0) errors.push(`${normalized} 是空日志`);
  if (!Number.isInteger(session.event_count) || session.event_count !== lines.length) {
    errors.push(`${normalized} 的 manifest event_count 为 ${session.event_count}，实际为 ${lines.length}`);
  }
  return normalized;
}

function validateLogs(root, errors) {
  const logsRoot = path.join(root, 'logs');
  const logFiles = listFiles(logsRoot, (file) => file.endsWith('.jsonl'));
  if (logFiles.length === 0) {
    errors.push('logs/ 中没有 AI Coding JSONL 日志');
    return;
  }

  const manifestFiles = listFiles(logsRoot, (file) => path.basename(file) === 'manifest.json');
  if (manifestFiles.length === 0) {
    errors.push('logs/ 中没有 AI Coding manifest.json');
    return;
  }

  const listedFiles = new Set();
  manifestFiles.forEach((manifestFile) => {
    let manifest;
    try {
      manifest = JSON.parse(readText(manifestFile));
    } catch (error) {
      errors.push(`${normalizeRelativePath(path.relative(root, manifestFile))} 不是有效 JSON`);
      return;
    }
    if (!Array.isArray(manifest.sessions) || manifest.sessions.length === 0) {
      errors.push(`${normalizeRelativePath(path.relative(root, manifestFile))} 没有会话清单`);
      return;
    }
    manifest.sessions.forEach((session) => {
      if (!session || typeof session.file_path !== 'string') {
        errors.push(`${normalizeRelativePath(path.relative(root, manifestFile))} 包含缺少 file_path 的会话`);
        return;
      }
      const normalized = validateLogFile(root, session.file_path, session, errors);
      if (normalized) listedFiles.add(normalized);
    });
  });

  logFiles.forEach((file) => {
    const relative = normalizeRelativePath(path.relative(root, file));
    if (!listedFiles.has(relative)) errors.push(`${relative} 未登记到 manifest.json`);
  });
}

function validateSubmission(projectRoot) {
  const root = path.resolve(projectRoot);
  const errors = [];
  const warnings = [];

  const license = readText(path.join(root, 'LICENSE'));
  if (!license.includes('Apache License') || !license.includes('Version 2.0')) {
    errors.push('缺少有效的 Apache-2.0 LICENSE');
  }

  const readme = readText(path.join(root, 'README.md'));
  const requiredSections = ['作品简介', '选题方向', '目录结构', '运行方式', 'AI Coding 使用说明'];
  requiredSections.forEach((section) => {
    if (!readme.includes(section)) errors.push(`README 缺少“${section}”`);
  });

  const contestManifests = fs.existsSync(root)
    ? fs.readdirSync(root).filter((name) => /^contest2026_.+\.xml$/.test(name))
    : [];
  if (contestManifests.length !== 1) {
    errors.push('仓库根目录必须且只能有一个 contest2026_*.xml');
    return { ok: false, errors, warnings };
  }

  const contestManifest = readText(path.join(root, contestManifests[0]));
  const link = contestManifest.match(/<linkfile\s+src="(quickapp\/[^"]+)"\s+dest="(packages\/apps\/[^"]+)"\s*\/>/);
  if (!link) {
    errors.push('赛事 manifest 未把 quickapp 源码映射到 packages/apps');
    return { ok: false, errors, warnings };
  }

  const appRoot = path.join(root, ...link[1].split('/'));
  const packageJsonPath = path.join(appRoot, 'package.json');
  const appManifestPath = path.join(appRoot, 'src', 'manifest.json');
  let packageJson = null;
  let appManifest = null;
  try {
    packageJson = JSON.parse(readText(packageJsonPath));
  } catch (error) {
    errors.push(`无法读取 ${link[1]}/package.json`);
  }
  try {
    appManifest = JSON.parse(readText(appManifestPath));
  } catch (error) {
    errors.push(`无法读取 ${link[1]}/src/manifest.json`);
  }

  if (packageJson) {
    if (!packageJson.scripts || !packageJson.scripts.test) errors.push('快应用缺少 npm test');
    if (!packageJson.scripts || !packageJson.scripts['build:release']) {
      errors.push('快应用缺少 npm run build:release');
    }
  }

  if (appManifest) {
    if (!Array.isArray(appManifest.deviceTypeList) || !appManifest.deviceTypeList.includes('watch')) {
      errors.push('src/manifest.json 未声明 watch 设备');
    }
    const expectedArtifact = `${appManifest.package}.release.${appManifest.versionName}.rpk`;
    const artifactPath = path.join(root, 'artifacts', expectedArtifact);
    if (!fs.existsSync(artifactPath)) {
      errors.push(`缺少 artifacts/${expectedArtifact}`);
    } else {
      const artifact = fs.readFileSync(artifactPath);
      if (artifact.length < 1024 || artifact[0] !== 0x50 || artifact[1] !== 0x4b) {
        errors.push(`artifacts/${expectedArtifact} 不是有效的非空 RPK/ZIP`);
      }
    }
  }

  const skillFiles = listFiles(path.join(root, 'skills'), (file) => path.basename(file) === 'SKILL.md');
  const validSkill = skillFiles.some((file) => {
    const metadata = parseFrontmatter(readText(file));
    return /^[a-z0-9-]{1,64}$/.test(metadata.name || '')
      && /^Use when\b/.test(metadata.description || '');
  });
  if (!validSkill) errors.push('缺少带有效 frontmatter 的 skills/*/SKILL.md');

  validateLogs(root, errors);

  const privateKeys = listFiles(root, (file) => /(^|[\\/])private(?:key)?[^\\/]*\.pem$/i.test(file));
  if (privateKeys.length > 0) errors.push('仓库中包含私钥 PEM，必须移出提交目录');

  const presentationFiles = listFiles(root, (file) => /\.(?:pdf|pptx|docx)$/i.test(file));
  const videoFiles = listFiles(root, (file) => /\.(?:mp4|mov)$/i.test(file));
  if (presentationFiles.length === 0) warnings.push('未在仓库中发现作品介绍 PDF/PPTX/DOCX，请确认已在报名系统提交');
  if (videoFiles.length === 0) warnings.push('未在仓库中发现不超过 5 分钟的演示视频，请确认已在报名系统提交');

  return { ok: errors.length === 0, errors, warnings };
}

function runCli() {
  const projectRoot = process.argv[2] || process.cwd();
  const result = validateSubmission(projectRoot);
  result.errors.forEach((message) => console.error(`ERROR: ${message}`));
  result.warnings.forEach((message) => console.warn(`WARN: ${message}`));
  if (result.ok) console.log('Contest submission contract: PASS');
  process.exitCode = result.ok ? 0 : 1;
}

if (require.main === module) runCli();

module.exports = { validateSubmission };
